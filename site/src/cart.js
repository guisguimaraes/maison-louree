/* ------------------------------------------------------------------
   Sacola e finalização da compra.
   A sacola fica guardada no navegador da pessoa (localStorage).
   O pagamento e o frete ainda serão ligados a um sistema (Mercado Pago,
   PagSeguro…): por enquanto a finalização coleta os dados e avisa que
   o pagamento está em configuração. Nada é enviado a lugar nenhum.
------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL;

export const PRODUCTS = {
  rose: { nome: 'Rose Dorée', linha: 'Eau de Parfum · Feminino · 50 ml', preco: 349.97, img: `${BASE}img/rose.webp` },
  noir: { nome: 'Lourée Noir', linha: 'Eau de Parfum · Masculino · 50 ml', preco: 349.97, img: `${BASE}img/noir.webp` },
};

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const KEY = 'maison-louree-sacola';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* navegador sem armazenamento */ }
}

export function initCart({ onOpen, onClose } = {}) {
  const $ = (s) => document.querySelector(s);
  let items = load(); // { rose: 2, noir: 1 }

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
    $('#ckTotal').textContent = brl(sum());
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
  const tel = $('#ckTel');
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  $('#ckForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    // aqui entrará a chamada ao sistema de pagamento escolhido
    const msg = $('#ckMsg');
    msg.hidden = false;
    msg.focus();
  });

  render();
  return { add, open };
}
