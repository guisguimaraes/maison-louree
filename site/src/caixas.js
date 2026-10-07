/* As duas caixas (3D, na cena). Clicar num perfume: a câmera aproxima,
   a outra caixa sai de cena, o frasco se levanta e borrifa, e uma voz diz
   "Sinta a fragrância" (feminina no Rose Dorée, masculina no Lourée Noir). */

import { fly } from './fly.js';

const BASE = import.meta.env.BASE_URL;

const INFO = {
  rose: { nome: 'Rose Dorée', linha: 'Eau de Parfum · Feminino' },
  noir: { nome: 'Lourée Noir', linha: 'Eau de Parfum · Masculino' },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* música em laço sem emenda: o <audio> comum deixa um respiro a cada volta,
   então a faixa toca pelo Web Audio, com o volume controlado por rampas */
function createMusic(url) {
  let ctx = null, gain = null, playing = false, loading = null;
  async function start() {
    if (!ctx) {
      ctx = new AudioContext();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') await ctx.resume();
    loading = loading || fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
    const buffer = await loading;
    if (!playing) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start();
      playing = true;
    }
  }
  return {
    async fadeTo(v, ms) {
      if (v > 0) await start().catch(() => {});
      if (!ctx) return;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(v, t + ms / 1000);
    },
  };
}

export function initCaixas({ stage, cart }) {
  const $ = (s) => document.querySelector(s);
  const section = $('#detalhes');

  /* ---------- música e vozes ---------- */
  const VOL = 0.3;
  const music = createMusic(`${BASE}media/musica.mp3`);
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
    music.fadeTo(on ? VOL : 0, on ? 1800 : 700);
  }
  somBtn.addEventListener('click', () => { somMexido = true; setSom(!somOn); });
  // a música só pode começar depois de um toque (regra dos navegadores)
  const primeiro = (e) => {
    removeEventListener('pointerdown', primeiro, true);
    removeEventListener('keydown', primeiro, true);
    if (!somMexido && !e.target.closest?.('#som')) setSom(true);
  };
  addEventListener('pointerdown', primeiro, true);
  addEventListener('keydown', primeiro, true);

  /* ---------- foco e borrifo ---------- */
  let view = 'both';
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  // a cena avisa quando o jato sai do bico
  stage.onSpray = (p) => {
    section.classList.remove('borrifando');
    void section.offsetWidth;
    section.classList.add('borrifando');
    fly($('#sentirFrase'), { delay: 200, duration: 1700 });
    later(() => {
      const voz = vozes[p];
      voz.currentTime = 0;
      voz.play().catch(() => {});
      if (somOn) {
        music.fadeTo(VOL * 0.35, 400);
        voz.onended = () => { if (somOn) music.fadeTo(VOL, 1600); };
      }
    }, 450);
  };

  function borrifar() {
    if (view === 'both') return;
    clear();
    stage.sprayBottle(view);
  }

  function abrir(p) {
    if (view === p) { borrifar(); return; }
    clear();
    view = p;
    const nome = $('#sentirNome');
    nome.textContent = INFO[p].nome;
    delete nome.dataset.split;
    fly(nome, { delay: 1400, duration: 1700 });
    $('#sentirLinha').textContent = INFO[p].linha;
    stage.resetSpray();
    stage.focus = p;
    section.classList.remove('borrifando');
    section.classList.add('focado');
    $('#compraOk').textContent = '';
    // espera a câmera chegar e a outra caixa sair
    later(() => stage.sprayBottle(p), 1500);
  }

  function voltar() {
    clear();
    view = 'both';
    stage.resetSpray();
    stage.focus = 'both';
    section.classList.remove('focado', 'borrifando');
  }

  // clique e cursor sobre os objetos 3D
  const ndc = (e) => [(e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)];
  section.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    const hit = stage.pick(...ndc(e));
    if (hit) abrir(hit);
  });
  section.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.target.closest('button, a')) return;
    section.style.cursor = stage.pick(...ndc(e)) ? 'pointer' : '';
  });
  $('#borrifar').addEventListener('click', borrifar);
  // compra do perfume em foco
  const ok = $('#compraOk');
  $('#addCart').addEventListener('click', () => {
    if (view === 'both') return;
    cart.add(view);
    ok.innerHTML = 'Adicionado à sacola. <button type="button">Ver sacola</button>';
    ok.querySelector('button').addEventListener('click', () => cart.open());
  });
  $('#voltar').addEventListener('click', voltar);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && view !== 'both') voltar(); });

  return { abrir, voltar };
}
