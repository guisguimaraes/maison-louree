/* ------------------------------------------------------------------
   Sacola e finalização da compra.
   A sacola fica guardada no navegador da pessoa (localStorage).
   Ao finalizar, os dados vão para o nosso servidor (server/index.js), que
   recalcula o total, cria a cobrança no Asaas e devolve o link da página
   segura de pagamento (Pix, cartão ou boleto). Os preços que valem são os
   do servidor (server/catalogo.js); os daqui são só para mostrar.
------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL;

export const PRODUCTS = {
  rose: { nome: 'Rose Dorée', linha: 'Eau de Parfum · Feminino · 50 ml', preco: 349.97, img: `${BASE}img/rose.webp` },
  noir: { nome: 'Lourée Noir', linha: 'Eau de Parfum · Masculino · 50 ml', preco: 349.97, img: `${BASE}img/noir.webp` },
};

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const KEY = 'maison-louree-sacola';
// endereço da API relativo à página (funciona na raiz do domínio ou numa subpasta)
const API = (p) => new URL(`api/${p}`, location.origin + location.pathname.replace(/[^/]*$/, '')).href;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* navegador sem armazenamento */ }
}

export function initCart({ onOpen, onClose } = {}) {
  const $ = (s) => document.querySelector(s);
  let items = load(); // { rose: 2, noir: 1 }
  // o que o servidor informa: frete fixo e se o pagamento está ativo
  let cfg = { frete: 0, pagamento: false, online: false };
  fetch(API('config')).then((r) => (r.ok ? r.json() : null)).then((c) => {
    if (!c) return;
    cfg = { ...c, online: true };
    if (cfg.frete) {
      $('#ckFrete').textContent = `Frete fixo para todo o Brasil: ${brl(cfg.frete)}.`;
      $('#ckFreteV').textContent = brl(cfg.frete);
    }
    renderSummary();
  }).catch(() => {});

  const btn = $('#sacolaBtn'), count = $('#sacolaN');
  const drawer = $('#sacola'), list = $('#sacolaLista'), total = $('#sacolaTotal');
  const shade = $('#sacolaShade');
  const checkout = $('#checkout');

  const qty = () => Object.values(items).reduce((a, b) => a + b, 0);
  const sum = () => Object.entries(items).reduce((a, [k, q]) => a + PRODUCTS[k].preco * q, 0);

  function render() {
    const n = qty();
    count.textContent = n;
    count.hidden = n === 0;
    btn.setAttribute('aria-label', n ? `Abrir sacola, ${n} ${n > 1 ? 'itens' : 'item'}` : 'Abrir sacola');
    list.innerHTML = n ? '' : '<p class="sacola-vazia">Sua sacola está vazia.</p>';
    for (const [k, q] of Object.entries(items)) {
      const p = PRODUCTS[k];
      const li = document.createElement('div');
      li.className = 'sacola-item';
      li.innerHTML = `
        <img src="${p.img}" alt="" width="72" height="90" loading="lazy">
        <div class="sacola-info">
          <strong>${p.nome}</strong>
          <span>${p.linha}</span>
          <div class="sacola-qtd" role="group" aria-label="Quantidade de ${p.nome}">
            <button data-k="${k}" data-d="-1" aria-label="Diminuir">−</button>
            <output>${q}</output>
            <button data-k="${k}" data-d="1" aria-label="Aumentar">+</button>
          </div>
        </div>
        <div class="sacola-preco">
          <span>${brl(p.preco * q)}</span>
          <button class="sacola-rem" data-k="${k}">Remover</button>
        </div>`;
      list.append(li);
    }
    total.textContent = brl(sum());
    $('#sacolaFim').disabled = n === 0;
    renderSummary();
  }

  function renderSummary() {
    const box = $('#ckItens');
    box.innerHTML = '';
    for (const [k, q] of Object.entries(items)) {
      const p = PRODUCTS[k];
      const row = document.createElement('div');
      row.className = 'ck-item';
      row.innerHTML = `<img src="${p.img}" alt="" width="56" height="70"><span><strong>${p.nome}</strong><small>${q} × ${brl(p.preco)}</small></span><b>${brl(p.preco * q)}</b>`;
      box.append(row);
    }
    $('#ckSub').textContent = brl(sum());
    $('#ckTotal').textContent = brl(sum() + (cfg.frete || 0));
  }

  function add(k, q = 1) {
    items[k] = (items[k] || 0) + q;
    save(items);
    render();
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');
  }
  function change(k, d) {
    items[k] = (items[k] || 0) + d;
    if (items[k] <= 0) delete items[k];
    save(items);
    render();
  }

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    shade.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('on'); shade.classList.add('on'); });
    drawer.querySelector('.sacola-fechar').focus();
    onOpen?.();
  }
  function close() {
    drawer.classList.remove('on');
    shade.classList.remove('on');
    setTimeout(() => { drawer.hidden = true; shade.hidden = true; }, 500);
    lastFocus?.focus?.();
    onClose?.();
  }

  btn.addEventListener('click', open);
  shade.addEventListener('click', close);
  drawer.querySelector('.sacola-fechar').addEventListener('click', close);
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('sacola-rem')) { delete items[b.dataset.k]; save(items); render(); return; }
    change(b.dataset.k, Number(b.dataset.d));
  });

  /* ---------- finalização ---------- */
  function openCheckout() {
    drawer.classList.remove('on');
    shade.classList.remove('on');
    setTimeout(() => { drawer.hidden = true; shade.hidden = true; }, 500);
    checkout.hidden = false;
    $('#ckMsg').hidden = true;
    requestAnimationFrame(() => checkout.classList.add('on'));
    checkout.querySelector('input').focus();
    onOpen?.();
  }
  function closeCheckout() {
    checkout.classList.remove('on');
    setTimeout(() => { checkout.hidden = true; }, 500);
    onClose?.();
  }
  $('#sacolaFim').addEventListener('click', openCheckout);
  $('#ckVoltar').addEventListener('click', closeCheckout);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!checkout.hidden) closeCheckout();
    else if (!drawer.hidden) close();
  });

  // CEP: preenche o endereço automaticamente (consulta pública dos Correios via ViaCEP)
  const cep = $('#ckCep');
  cep.addEventListener('input', () => {
    const d = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    if (d.length === 8) {
      fetch(`https://viacep.com.br/ws/${d}/json/`).then((r) => r.json()).then((a) => {
        if (a.erro) return;
        $('#ckRua').value = a.logradouro || '';
        $('#ckBairro').value = a.bairro || '';
        $('#ckCidade').value = a.localidade || '';
        $('#ckUf').value = a.uf || '';
        $('#ckNum').focus();
      }).catch(() => {});
    }
  });
  const cpf = $('#ckCpf');
  cpf.addEventListener('input', () => {
    const d = cpf.value.replace(/\D/g, '').slice(0, 14);
    cpf.value = d.length <= 11
      ? d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      : d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  });
  const tel = $('#ckTel');
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  const msg = $('#ckMsg');
  const aviso = (t) => { msg.textContent = t; msg.hidden = false; msg.focus(); };
  $('#ckForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    if (!cfg.online || !cfg.pagamento) {
      aviso('O pagamento on-line está sendo configurado. Em breve você poderá concluir a compra por aqui.');
      return;
    }
    const botao = form.querySelector('.ck-pagar');
    const rotulo = botao.querySelector('.frame-btn');
    botao.disabled = true;
    rotulo.textContent = 'Gerando o pagamento…';
    msg.hidden = true;
    try {
      const r = await fetch(API('checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: items, cliente: Object.fromEntries(new FormData(form)) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.pagamento) throw new Error(d.erro || 'Não foi possível iniciar o pagamento.');
      location.href = d.pagamento; // página segura do Asaas
    } catch (err) {
      aviso(err.message);
      botao.disabled = false;
      rotulo.textContent = 'Ir para o pagamento';
    }
  });

  /* ---------- volta do pagamento: ?pedido=<id> ---------- */
  const pedido = new URLSearchParams(location.search).get('pedido');
  if (pedido) {
    const box = $('#obrigado');
    box.hidden = false;
    items = {};
    save(items);
    history.replaceState(null, '', location.pathname + location.hash);
    fetch(API(`pedido/${encodeURIComponent(pedido)}`)).then((r) => (r.ok ? r.json() : null)).then((p) => {
      if (!p) return;
      $('#obrigadoTxt').textContent = p.status === 'pago'
        ? `Pagamento confirmado (${brl(p.total)}). Você vai receber os detalhes por e-mail.`
        : 'Recebemos o seu pedido. Assim que o pagamento for confirmado, você recebe um e-mail.';
    }).catch(() => {});
    $('#obrigadoOk').addEventListener('click', () => { box.hidden = true; });
  }

  render();
  return { add, open };
}
