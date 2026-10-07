// Servidor da Maison Lourée: entrega o site (pasta dist) e faz a ponte com o Asaas.
//
//   POST /api/checkout        cria o pedido e a cobrança no Asaas; devolve o link de pagamento
//   POST /api/asaas/webhook   o Asaas avisa aqui quando o pagamento é confirmado
//   GET  /api/config          informações públicas para a finalização (frete)
//   GET  /api/saude           verificação de saúde (Coolify)
//
// Variáveis de ambiente (configuradas no Coolify):
//   ASAAS_API_KEY          chave da conta Asaas (obrigatória)
//   ASAAS_AMBIENTE         "sandbox" para testes; vazio = produção
//   ASAAS_WEBHOOK_TOKEN    o mesmo token informado ao criar o webhook no painel do Asaas
//   SITE_URL               endereço público do site (ex.: https://maisonlouree.com.br)
//   FRETE_VALOR            valor fixo de frete em reais (opcional; vazio = frete a combinar)
//   PORT                   porta (padrão 3000)
//   DATA_DIR               pasta onde ficam os pedidos (padrão ./data — use um volume no Coolify)

import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGO } from './catalogo.js';
import { clienteAsaas, cobrancaAsaas, AsaasErro } from './asaas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
const DATA = path.resolve(process.env.DATA_DIR || path.join(RAIZ, 'data'));
const PEDIDOS = path.join(DATA, 'pedidos.json');
const PORT = Number(process.env.PORT || 3000);
const frete = () => {
  const v = Number(String(process.env.FRETE_VALOR || '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
};

/* ---------- pedidos (arquivo JSON simples; um volume no Coolify mantém entre deploys) ---------- */
let fila = Promise.resolve();
async function lerPedidos() {
  try { return JSON.parse(await readFile(PEDIDOS, 'utf8')); } catch { return []; }
}
function salvarPedido(alterar) {
  // gravações em fila para não perder pedidos simultâneos
  fila = fila.then(async () => {
    await mkdir(DATA, { recursive: true });
    const lista = await lerPedidos();
    alterar(lista);
    await writeFile(PEDIDOS, JSON.stringify(lista, null, 2));
  });
  return fila;
}

/* ---------- validação ---------- */
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(c[n])) return false;
  }
  return true;
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + Number(c[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

function validar(corpo) {
  const erros = [];
  const itens = [];
  for (const [id, qtd] of Object.entries(corpo?.itens || {})) {
    const q = Number(qtd);
    if (!CATALOGO[id]) { erros.push(`Produto desconhecido: ${id}`); continue; }
    if (!Number.isInteger(q) || q < 1 || q > 10) { erros.push(`Quantidade inválida de ${CATALOGO[id].nome}.`); continue; }
    itens.push({ id, nome: CATALOGO[id].nome, qtd: q, preco: CATALOGO[id].preco });
  }
  if (!itens.length) erros.push('A sacola está vazia.');
  const c = corpo?.cliente || {};
  const cliente = {
    nome: String(c.nome || '').trim().slice(0, 120),
    email: String(c.email || '').trim().slice(0, 160),
    celular: soDigitos(c.celular),
    cpfCnpj: soDigitos(c.cpfCnpj),
    cep: soDigitos(c.cep),
    rua: String(c.rua || '').trim().slice(0, 160),
    numero: String(c.numero || '').trim().slice(0, 20),
    complemento: String(c.complemento || '').trim().slice(0, 80),
    bairro: String(c.bairro || '').trim().slice(0, 80),
    cidade: String(c.cidade || '').trim().slice(0, 80),
    uf: String(c.uf || '').trim().toUpperCase().slice(0, 2),
  };
  if (cliente.nome.split(/\s+/).length < 2) erros.push('Informe o nome completo.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) erros.push('E-mail inválido.');
  if (cliente.celular.length < 10) erros.push('Celular inválido.');
  if (!(cpfValido(cliente.cpfCnpj) || cnpjValido(cliente.cpfCnpj))) erros.push('CPF ou CNPJ inválido.');
  if (cliente.cep.length !== 8) erros.push('CEP inválido.');
  for (const [k, rot] of [['rua', 'Endereço'], ['numero', 'Número'], ['bairro', 'Bairro'], ['cidade', 'Cidade']]) {
    if (!cliente[k]) erros.push(`${rot} é obrigatório.`);
  }
  if (!/^[A-Z]{2}$/.test(cliente.uf)) erros.push('UF inválida.');
  return { erros, itens, cliente };
}

/* ---------- limite simples de tentativas por IP (evita abuso criando cobranças) ---------- */
const tentativas = new Map();
function limitado(ip) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) || []).filter((t) => agora - t < 10 * 60e3);
  lista.push(agora);
  tentativas.set(ip, lista);
  return lista.length > 8;
}

/* ---------- utilidades HTTP ---------- */
function json(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dados));
}
async function lerCorpo(req, limite = 64 * 1024) {
  let tam = 0;
  const partes = [];
  for await (const p of req) {
    tam += p.length;
    if (tam > limite) throw new Error('corpo grande demais');
    partes.push(p);
  }
  const texto = Buffer.concat(partes).toString('utf8');
  return texto ? JSON.parse(texto) : {};
}
const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ---------- rotas da API ---------- */
async function checkout(req, res) {
  if (limitado(ipDe(req))) return json(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  let corpo;
  try { corpo = await lerCorpo(req); } catch { return json(res, 400, { erro: 'Pedido inválido.' }); }
  const { erros, itens, cliente } = validar(corpo);
  if (erros.length) return json(res, 422, { erro: erros.join(' ') });

  const subtotal = Math.round(itens.reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;
  const valorFrete = frete();
  const total = Math.round((subtotal + valorFrete) * 100) / 100;
  const id = randomUUID();
  const descricao = `Maison Lourée — ${itens.map((i) => `${i.qtd}× ${i.nome}`).join(', ')}`
    + (valorFrete ? ` + frete ${brl(valorFrete)}` : '');
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');

  try {
    const idCliente = await clienteAsaas(cliente);
    const cobranca = await cobrancaAsaas({
      cliente: idCliente, valor: total, descricao, referencia: id,
      urlRetorno: site ? `${site}/?pedido=${id}` : undefined,
    });
    await salvarPedido((lista) => lista.push({
      id, criadoEm: new Date().toISOString(), status: 'aguardando pagamento',
      itens, subtotal, frete: valorFrete, total, cliente,
      asaas: { cobranca: cobranca.id, cliente: idCliente, link: cobranca.invoiceUrl },
    }));
    return json(res, 200, { pedido: id, pagamento: cobranca.invoiceUrl });
  } catch (e) {
    console.error('[checkout]', e instanceof AsaasErro ? `${e.status} ${e.message}` : e);
    const msg = e instanceof AsaasErro && e.status < 500 ? e.message : 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.';
    return json(res, 502, { erro: msg });
  }
}

// estados do Asaas que interessam ao pedido
const STATUS = {
  PAYMENT_CONFIRMED: 'pago',
  PAYMENT_RECEIVED: 'pago',
  PAYMENT_OVERDUE: 'vencido',
  PAYMENT_DELETED: 'cancelado',
  PAYMENT_REFUNDED: 'estornado',
  PAYMENT_CHARGEBACK_REQUESTED: 'contestado',
};

async function webhook(req, res) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const recebido = String(req.headers['asaas-access-token'] || '');
  const ok = esperado && recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!ok) return json(res, 401, { erro: 'token inválido' });
  let ev;
  try { ev = await lerCorpo(req, 256 * 1024); } catch { return json(res, 400, { erro: 'corpo inválido' }); }
  const novo = STATUS[ev?.event];
  const ref = ev?.payment?.externalReference;
  if (novo && ref) {
    await salvarPedido((lista) => {
      const p = lista.find((x) => x.id === ref);
      if (!p) return;
      p.status = novo;
      p.atualizadoEm = new Date().toISOString();
      p.historico = [...(p.historico || []), { evento: ev.event, em: p.atualizadoEm }];
    });
    console.log(`[webhook] pedido ${ref}: ${ev.event}`);
  }
  // o Asaas só precisa de um 200 para considerar o aviso entregue
  return json(res, 200, { recebido: true });
}

async function situacao(res, id) {
  const p = (await lerPedidos()).find((x) => x.id === id);
  if (!p) return json(res, 404, { erro: 'pedido não encontrado' });
  return json(res, 200, { status: p.status, total: p.total });
}

/* ---------- arquivos do site ---------- */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
};
async function estatico(req, res) {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const alvo = path.normalize(path.join(DIST, rel));
  if (!alvo.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  let arquivo = alvo;
  try { if (!(await stat(arquivo)).isFile()) throw 0; } catch { arquivo = path.join(DIST, 'index.html'); }
  try {
    const dados = await readFile(arquivo);
    const ext = path.extname(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      // arquivos com hash no nome podem ficar em cache por muito tempo; o resto, não
      'Cache-Control': arquivo.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(dados);
  } catch {
    res.writeHead(404); res.end('não encontrado');
  }
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/checkout' && req.method === 'POST') return await checkout(req, res);
    if (url.pathname === '/api/asaas/webhook' && req.method === 'POST') return await webhook(req, res);
    if (url.pathname === '/api/config' && req.method === 'GET') return json(res, 200, { frete: frete(), pagamento: !!process.env.ASAAS_API_KEY });
    if (url.pathname === '/api/saude') return json(res, 200, { ok: true });
    const m = url.pathname.match(/^\/api\/pedido\/([\w-]{36})$/);
    if (m && req.method === 'GET') return await situacao(res, m[1]);
    if (url.pathname.startsWith('/api/')) return json(res, 404, { erro: 'rota não encontrada' });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return await estatico(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { erro: 'erro interno' });
  }
}).listen(PORT, () => {
  console.log(`Maison Lourée no ar na porta ${PORT} (${process.env.ASAAS_AMBIENTE === 'sandbox' ? 'Asaas sandbox' : 'Asaas produção'})`);
  if (!process.env.ASAAS_API_KEY) console.warn('Atenção: ASAAS_API_KEY não configurada — a finalização vai avisar que o pagamento está indisponível.');
});
