import Lenis from 'lenis';
import { animate, stagger } from 'animejs';
import { fly, splitChars, flyOnView } from './fly.js';
import { laurelSVG } from './laurel.js';

/* Página "A nossa história": capítulos que se revelam com a rolagem,
   o pulso que se desenha e as frases do "O que vendemos" trocando
   numa cena presa. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- selo de louros ao fundo da abertura ---------- */
// foil dourado prensado, como o selo da entrada da home: relevo, grão do metal
// e uma luz rasante que passa devagar por cima
$('.hs-selo').innerHTML = `
  <svg viewBox="-10 -10 220 220">
    <defs>
      <linearGradient id="hsGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f3dca4"/><stop offset=".45" stop-color="#d1a862"/><stop offset="1" stop-color="#9a7540"/>
      </linearGradient>
      <filter id="hsFoil" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="b"/>
        <feSpecularLighting in="b" surfaceScale="2.6" specularConstant="1.3" specularExponent="22" lighting-color="#fff3d2" result="s">
          <fePointLight id="hsLight" x="-80" y="-60" z="70"/>
        </feSpecularLighting>
        <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .7  0 0 0 .07 0" result="n2"/>
        <feComposite in="n2" in2="SourceAlpha" operator="in" result="grain"/>
        <feDiffuseLighting in="b" surfaceScale="1.6" diffuseConstant="1" lighting-color="#ffffff" result="d">
          <feDistantLight azimuth="235" elevation="55"/>
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1=".95" k2=".3" k3="0" k4="0" result="lit"/>
        <feComposite in="lit" in2="s2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="shine"/>
        <feComposite in="shine" in2="grain" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
      </filter>
    </defs>
    <g filter="url(#hsFoil)" fill="url(#hsGold)" stroke="url(#hsGold)"><g class="selo-laurel">${laurelSVG()}</g>
    <text class="selo-L" x="100" y="128" text-anchor="middle">L</text></g>
  </svg>`;
const hsLight = $('#hsLight');

/* ---------- textos ---------- */
$$('[data-fly]').forEach((el) => splitChars(el));
flyOnView();
// palavras que acendem com a rolagem
function splitWords(el) {
  const walk = (node) => [...node.childNodes].forEach((ch) => {
    if (ch.nodeType === 3) {
      const frag = document.createDocumentFragment();
      ch.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span');
        w.className = 'wd';
        w.textContent = part;
        frag.append(w);
      });
      ch.replaceWith(frag);
    } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
  });
  walk(el);
}
const wordBlocks = $$('.words').map((el) => { splitWords(el); return { el, words: $$('.wd', el) }; });

/* ---------- rolagem suave e menu ---------- */
const lenis = new Lenis({ lerp: reduce ? 1 : 0.085, wheelMultiplier: 0.9 });
const toggle = $('#menuToggle'), menu = $('#menu');
toggle.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  open ? lenis.stop() : lenis.start();
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || menu.hidden) return;
  toggle.click();
});

/* ---------- entrada ---------- */
$('#header').style.setProperty('--hl', 1);
animate('#header .brand, #header nav a, #menuToggle', { opacity: [0, 1], translateY: [-10, 0], duration: 1200, delay: stagger(90), ease: 'outQuart' });
animate('.hs-hero .eyebrow', { opacity: [0, 1], translateY: [12, 0], duration: 1000, delay: 200, ease: 'outQuart' });
fly($('.hs-hero h1'), { delay: 350, duration: 2200 });
animate('.hs-lugar', { opacity: [0, 1], translateY: [14, 0], duration: 1200, delay: stagger(200, { start: 1300 }), ease: 'outQuart' });
const selo = $('.hs-selo svg');
const leaves = $$('.selo-laurel > path', selo);
if (!reduce) {
  animate(leaves, { opacity: [0, 1], duration: 900, delay: stagger(40, { start: 300 }), ease: 'outQuad' });
  animate('.hs-selo .selo-L', { opacity: [0, 1], duration: 1600, delay: 1500, ease: 'outQuad' });
}

/* ---------- revelações ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  animate(e.target, { opacity: [0, 1], translateY: [26, 0], duration: 1100, ease: 'outQuart' });
}), { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
$$('.reveal').forEach((el) => io.observe(el));

// o retrato abre da esquerda para a direita, como a foto da maison na home
const retrato = $('.hs-retrato');
const ioRetrato = new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) return;
  ioRetrato.disconnect();
  const box = $('.hs-retrato-img', retrato);
  if (reduce) { box.style.clipPath = 'none'; return; }
  animate(box, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 1600, ease: 'inOutCubic' });
  animate($('img', box), { scale: [1.2, 1.06], duration: 2400, ease: 'outQuart' });
}, { threshold: 0.25 });
ioRetrato.observe(retrato);

/* ---------- a cada quadro ---------- */
const pulso = $('.pulso path');
const pulsoLen = pulso.getTotalLength();
pulso.style.strokeDasharray = pulsoLen;
const vend = $('#vendemos');
const linhas = $$('.hs-vend-linhas p');
const nao = $('.hs-vend-nao');
let vh = innerHeight;
addEventListener('resize', () => { vh = innerHeight; });

function frame(now) {
  lenis.raf(now);
  const y = lenis.scroll ?? scrollY;
  $('#header').classList.toggle('scrolled', y > 40);

  // o selo afasta devagar
  if (!reduce) {
    selo.parentElement.style.transform = `translateY(${y * 0.25}px) rotate(${y * 0.008}deg)`;
    // a luz atravessa o selo da esquerda para a direita a cada ~9 s
    const k = ((now / 9000) % 1);
    hsLight.setAttribute('x', -90 + k * 380);
    hsLight.setAttribute('y', -40 + Math.sin(k * Math.PI) * 60);
  }

  // o pulso se desenha enquanto atravessa a tela
  const pr = pulso.ownerSVGElement.getBoundingClientRect();
  pulso.style.strokeDashoffset = pulsoLen * (1 - smooth(vh * 0.95, vh * 0.35, pr.top));

  for (const { el, words } of wordBlocks) {
    const r = el.getBoundingClientRect();
    const p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.3));
    words.forEach((w, i) => { w.style.opacity = 0.13 + 0.87 * smooth(i / words.length - 0.05, (i + 1) / words.length, p); });
  }

  // "O que vendemos": a negação some e as quatro frases passam uma a uma
  const vr = vend.getBoundingClientRect();
  const p = clamp(-vr.top / (vend.offsetHeight - vh));
  nao.style.opacity = 1 - smooth(0.08, 0.16, p);
  nao.style.transform = `translateY(${-smooth(0.08, 0.16, p) * 30}px)`;
  const seg = 0.84 / linhas.length;
  linhas.forEach((el, i) => {
    const a = 0.16 + i * seg;
    const vis = i === linhas.length - 1
      ? smooth(a, a + seg * 0.3, p)
      : Math.min(smooth(a, a + seg * 0.3, p), 1 - smooth(a + seg * 0.75, a + seg, p));
    el.style.opacity = vis;
    el.style.transform = `translateY(${(1 - vis) * (p < a + seg * 0.5 ? 34 : -34)}px)`;
  });
  const idx = clamp(Math.floor((p - 0.16) / seg), 0, linhas.length - 1);
  $('#vendIdx').textContent = String(idx + 1).padStart(2, '0');
  $('#vendBar').style.transform = `scaleX(${smooth(0.16, 1, p)})`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
