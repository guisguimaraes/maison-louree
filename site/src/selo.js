import { laurelSVG } from './laurel.js';
import { fly } from './fly.js';

/* ------------------------------------------------------------------
   Entrada: o selo da Maison Lourée sendo gravado em foil dourado.
   Os ramos se desenham e as folhas brotam conforme o site carrega;
   no fim o "L" é prensado, uma luz rasante corre pelo relevo, o nome
   se monta letra a letra e a câmera atravessa o "L".
------------------------------------------------------------------- */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const outBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function createSeal(root) {
  const mark = root.querySelector('.selo-mark');
  mark.innerHTML = `
  <svg viewBox="-10 -10 220 220" aria-hidden="true">
    <defs>
      <linearGradient id="seloGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e9cf95"/>
        <stop offset=".5" stop-color="#c39a58"/>
        <stop offset="1" stop-color="#8f6d3a"/>
      </linearGradient>
      <!-- foil prensado: relevo a partir da forma + luz que corre por cima + grão do metal -->
      <filter id="seloFoil" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="b"/>
        <feSpecularLighting in="b" surfaceScale="2.6" specularConstant="1.25" specularExponent="22" lighting-color="#fff3d2" result="s">
          <fePointLight id="seloLight" x="-80" y="-60" z="70"/>
        </feSpecularLighting>
        <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .7  0 0 0 .07 0" result="n2"/>
        <feComposite in="n2" in2="SourceAlpha" operator="in" result="grain"/>
        <feDiffuseLighting in="b" surfaceScale="1.6" diffuseConstant=".9" lighting-color="#ffffff" result="d">
          <feDistantLight azimuth="235" elevation="55"/>
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1=".9" k2=".25" k3="0" k4="0" result="lit"/>
        <feComposite in="lit" in2="s2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="shine"/>
        <feComposite in="shine" in2="grain" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
      </filter>
    </defs>
    <g filter="url(#seloFoil)" fill="url(#seloGold)" stroke="url(#seloGold)">
      <g class="selo-laurel">${laurelSVG()}</g>
      <text class="selo-L" x="100" y="128" text-anchor="middle">L</text>
    </g>
  </svg>`;
  const svg = mark.querySelector('svg');
  const paths = [...svg.querySelectorAll('.selo-laurel > path')];
  const stems = paths.filter((p) => p.getAttribute('fill') === 'none');
  const leaves = paths.filter((p) => p.getAttribute('fill') !== 'none');
  const L = svg.querySelector('.selo-L');
  const light = svg.querySelector('#seloLight');
  const word = root.querySelector('.selo-word');

  // cada folha cresce a partir da própria base, em ordem de baixo para cima, alternando os ramos
  const half = Math.floor(leaves.length / 2);
  const leafInfo = leaves.map((el, i) => {
    const m = el.getAttribute('d').match(/M([\d.]+) ([\d.]+)/);
    el.style.transformOrigin = `${m[1]}px ${m[2]}px`;
    const inBranch = i < half ? i : i - half;
    return { el, order: inBranch / half + (i < half ? 0 : 0.02) };
  });
  stems.forEach((s) => {
    const len = s.getTotalLength();
    s.style.strokeDasharray = len;
    s.style.strokeDashoffset = len;
    s.dataset.len = len;
  });
  L.style.opacity = 0;
  L.style.transformOrigin = '100px 100px';

  let grown = 0;      // 0..1: quanto do selo já foi gravado (segue o carregamento)
  let finishAt = null;
  let onDone = null;
  let wordDone = false;

  function draw(now) {
    const t = now / 1000;
    // ramos e folhas
    stems.forEach((s) => { s.style.strokeDashoffset = s.dataset.len * (1 - clamp(grown * 1.15)); });
    leafInfo.forEach(({ el, order }) => {
      const k = smooth(order * 0.85, order * 0.85 + 0.16, grown);
      el.style.opacity = k;
      el.style.transform = `scale(${0.2 + 0.8 * outBack(k)}) rotate(${(1 - k) * -18}deg)`;
    });
    // luz rasante: passeia devagar enquanto grava e cruza o selo no fim
    let lx = -80 + Math.sin(t * 0.6) * 30 + grown * 60;
    if (finishAt !== null) {
      const f = t - finishAt;
      // o L é prensado
      const p = smooth(0.0, 0.32, f);
      L.style.opacity = p;
      L.style.transform = `scale(${1.5 - 0.5 * outBack(p)})`;
      lx = -80 + ease(smooth(0.25, 1.9, f)) * 360;
      if (f > 0.55 && !wordDone) { wordDone = true; fly(word, { duration: 1500 }); }
      if (f > 2.6 && onDone) { const cb = onDone; onDone = null; cb(); }
    }
    light.setAttribute('x', lx);
    light.setAttribute('y', -60 + (finishAt !== null ? 30 : 0));
    raf = requestAnimationFrame(draw);
  }
  let raf = requestAnimationFrame(draw);

  return {
    setProgress(p) { grown = Math.max(grown, clamp(p)); },
    // prensa o L, monta o nome e chama `done` quando for hora de atravessar o selo
    finish(done) { grown = 1; finishAt = performance.now() / 1000; onDone = done; },
    stop() { cancelAnimationFrame(raf); },
  };
}
