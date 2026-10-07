// Cliente mínimo da API do Asaas (v3).
// A chave vem da variável de ambiente ASAAS_API_KEY, configurada no Coolify.
// ASAAS_AMBIENTE=sandbox usa o ambiente de testes; qualquer outro valor usa o de produção.

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

export function asaasBase() {
  return process.env.ASAAS_BASE_URL || (process.env.ASAAS_AMBIENTE === 'sandbox' ? BASES.sandbox : BASES.producao);
}

export class AsaasErro extends Error {
  constructor(status, corpo) {
    const msg = corpo?.errors?.map((e) => e.description).join(' ') || `Asaas respondeu ${status}`;
    super(msg);
    this.status = status;
    this.corpo = corpo;
  }
}

async function chamar(metodo, caminho, corpo) {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) throw new AsaasErro(500, { errors: [{ description: 'ASAAS_API_KEY não configurada no servidor.' }] });
  const r = await fetch(asaasBase() + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'maison-louree-site',
      access_token: chave,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { bruto: texto }; }
  if (!r.ok) throw new AsaasErro(r.status, json);
  return json;
}

// procura o cliente pelo CPF/CNPJ; se não existir, cria
export async function clienteAsaas(c) {
  const achados = await chamar('GET', `/customers?cpfCnpj=${encodeURIComponent(c.cpfCnpj)}`);
  const dados = {
    name: c.nome,
    cpfCnpj: c.cpfCnpj,
    email: c.email,
    mobilePhone: c.celular,
    postalCode: c.cep,
    address: c.rua,
    addressNumber: c.numero,
    complement: c.complemento || undefined,
    province: c.bairro,
    notificationDisabled: false,
  };
  if (achados?.data?.length) {
    const id = achados.data[0].id;
    await chamar('PUT', `/customers/${id}`, dados);
    return id;
  }
  const novo = await chamar('POST', '/customers', dados);
  return novo.id;
}

// cobrança em que a própria pessoa escolhe Pix, cartão ou boleto na página do Asaas
export async function cobrancaAsaas({ cliente, valor, descricao, referencia, vencimentoDias = 3, urlRetorno }) {
  const venc = new Date(Date.now() + vencimentoDias * 864e5);
  const corpo = {
    customer: cliente,
    billingType: 'UNDEFINED',
    value: Math.round(valor * 100) / 100,
    dueDate: venc.toISOString().slice(0, 10),
    description: descricao.slice(0, 500),
    externalReference: referencia,
  };
  // o retorno automático ao site só funciona com o domínio cadastrado na conta do Asaas
  if (urlRetorno) corpo.callback = { successUrl: urlRetorno, autoRedirect: true };
  return chamar('POST', '/payments', corpo);
}
