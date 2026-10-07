/* As duas caixas abertas. Clicar num perfume aproxima a câmera nele,
   escurece o resto, borrifa (vídeo real de névoa) e uma voz diz "Sinta a fragrância".
   Coordenadas em pixels da imagem caixas.webp (899 × 1600). */

const BASE = import.meta.env.BASE_URL;

// região da imagem que cada vista enquadra (centro e altura)
const VIEWS = {
  both: { cx: 530, cy: 880, h: 1000 },
  noir: { cx: 345, cy: 930, h: 600 },
  rose: { cx: 730, cy: 760, h: 520 },
};
// centro do foco de luz em cada perfume
const SPOT = { noir: [350, 985], rose: [730, 790] };

const INFO = {
  rose: { nome: 'Rose Dorée', linha: 'Eau de Parfum · Feminino' },
  noir: { nome: 'Lourée Noir', linha: 'Eau de Parfum · Masculino' },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- som ---------- */
function fade(audio, to, ms = 900) {
  cancelAnimationFrame(audio._fade);
  const from = audio.volume, t0 = performance.now();
  const step = (now) => {
    const k = clamp((now - t0) / ms, 0, 1);
    audio.volume = from + (to - from) * k;
    if (k < 1) audio._fade = requestAnimationFrame(step);
    else if (to === 0) audio.pause();
  };
  audio._fade = requestAnimationFrame(step);
}

export function initCaixas({ reduce }) {
  const $ = (s) => document.querySelector(s);
  const section = $('#detalhes');
  const frame = $('#cofre');
  const luz = frame.querySelector('.cofre-luz');
  const nevoas = Object.fromEntries([...frame.querySelectorAll('.nevoa')].map((v) => [v.dataset.for, v]));
  $('.cofre-amb').style.backgroundImage = `url(${BASE}img/caixas.webp)`;

  // música (só começa depois de um toque: regra dos navegadores)
  const VOL = 0.3;
  const music = new Audio(`${BASE}media/musica.mp3`);
  music.loop = true;
  music.preload = 'none';
  music.volume = 0;
  const vozes = {
    rose: new Audio(`${BASE}media/voz-rose.mp3`),
    noir: new Audio(`${BASE}media/voz-noir.mp3`),
  };
  Object.values(vozes).forEach((a) => { a.preload = 'auto'; a.volume = 0.95; });

  const somBtn = $('#som');
  let somOn = false, somMexido = false;
  function setSom(on) {
    somOn = on;
    somBtn.classList.toggle('on', on);
    somBtn.setAttribute('aria-pressed', String(on));
    somBtn.setAttribute('aria-label', on ? 'Desligar música' : 'Ligar música');
    if (on) { music.play().catch(() => {}); fade(music, VOL, 1800); }
    else fade(music, 0, 700);
  }
  somBtn.addEventListener('click', () => { somMexido = true; setSom(!somOn); });
  // primeiro toque em qualquer lugar liga a música
  const primeiro = (e) => {
    removeEventListener('pointerdown', primeiro, true);
    removeEventListener('keydown', primeiro, true);
    if (!somMexido && !e.target.closest?.('#som')) setSom(true);
  };
  addEventListener('pointerdown', primeiro, true);
  addEventListener('keydown', primeiro, true);

  /* ---------- câmera sobre a imagem ---------- */
  let view = 'both';
  function layout(animate) {
    const W = section.clientWidth, H = section.clientHeight;
    const mobile = W <= 860;
    const v = VIEWS[view];
    let x0 = 0, x1 = W, y0 = 0, y1 = H;
    if (mobile) {
      if (view === 'both') { y0 = H * 0.3; y1 = H; } else { y0 = H * 0.06; y1 = H * 0.6; }
    } else {
      x0 = W * (view === 'both' ? 0.36 : 0.4);
    }
    const bw = x1 - x0, bh = y1 - y0;
    const k = Math.min(bh / v.h, bw / (v.h * (view === 'both' ? 0.95 : 0.9)));
    const tx = (x0 + x1) / 2 - v.cx * k;
    const ty = (y0 + y1) / 2 - v.cy * k;
    frame.classList.toggle('anima', !!animate && !reduce);
    frame.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  }

  /* ---------- foco e borrifo ---------- */
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function stopNevoas() {
    Object.values(nevoas).forEach((v) => { v.classList.remove('on', 'off'); v.pause(); });
  }

  function borrifar() {
    if (view === 'both') return;
    const p = view;
    const v = nevoas[p];
    clear();
    stopNevoas();
    section.classList.remove('borrifando');
    void section.offsetWidth;
    if (!reduce) {
      v.currentTime = 0;
      v.play().catch(() => {});
      v.classList.add('on');
      later(() => v.classList.add('off'), 2300);
      later(() => { v.classList.remove('on', 'off'); v.pause(); }, 3700);
    }
    later(() => section.classList.add('borrifando'), 350);
    later(() => {
      const voz = vozes[p];
      voz.currentTime = 0;
      voz.play().catch(() => {});
      if (somOn) {
        fade(music, VOL * 0.35, 400);
        voz.onended = () => { if (somOn) fade(music, VOL, 1600); };
      }
    }, 700);
  }

  function abrir(p) {
    if (view === p) { borrifar(); return; }
    clear();
    stopNevoas();
    view = p;
    const info = INFO[p];
    $('#sentirNome').textContent = info.nome;
    $('#sentirLinha').textContent = info.linha;
    luz.style.setProperty('--lx', `${SPOT[p][0] + 899 * 4}px`);
    luz.style.setProperty('--ly', `${SPOT[p][1] + 1600 * 4}px`);
    nevoas[p].preload = 'auto';
    section.classList.remove('borrifando');
    section.classList.add('focado');
    layout(true);
    later(borrifar, reduce ? 100 : 1900);
  }

  function voltar() {
    clear();
    stopNevoas();
    view = 'both';
    section.classList.remove('focado', 'borrifando');
    layout(true);
  }

  frame.querySelectorAll('.frasco').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.p)));
  $('#borrifar').addEventListener('click', borrifar);
  $('#voltar').addEventListener('click', voltar);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && view !== 'both') voltar(); });
  addEventListener('resize', () => layout(false));
  layout(false);

  return { abrir, voltar };
}
