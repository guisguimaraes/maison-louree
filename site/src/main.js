import Lenis from 'lenis';
import { animate, stagger } from 'animejs';
import { Stage } from './scene.js';
import { initCaixas } from './caixas.js';
import { fly, showChars, splitChars, flyOnView } from './fly.js';
import { createSeal } from './selo.js';
import { initCart } from './cart.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// modo de teste: #t=1.5 congela a câmera naquele ponto, #skip pula a entrada
const params = new URLSearchParams(location.hash.slice(1));
const forcedT = params.has('t') ? Number(params.get('t')) : null;
const skipIntro = reduce || params.has('skip') || forcedT !== null;


/* ---------- textos: palavras ---------- */
function splitWords(el, cls) {
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = cls;
          if (cls === 'w') { const inner = document.createElement('span'); inner.textContent = part; w.append(inner); }
          else w.textContent = part;
          frag.append(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
  };
  walk(el);
}
$$('[data-fly]').forEach((el) => splitChars(el));
flyOnView();
$$('.words').forEach((el) => splitWords(el, 'wd'));

/* ---------- rolagem suave ---------- */
const lenis = new Lenis({ lerp: reduce ? 1 : 0.085, wheelMultiplier: 0.9 });
lenis.stop();
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  const focus = a.dataset.focus;
  lenis.scrollTo(id, {
    duration: 2.2, easing: (k) => 1 - Math.pow(1 - k, 4),
    onComplete: () => { if (focus) caixas.abrir(focus); },
  });
}));

/* ---------- menu ---------- */
const toggle = $('#menuToggle'), menu = $('#menu');
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Abrir menu');
  lenis.start();
}
toggle.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  open ? lenis.stop() : lenis.start();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ---------- cena 3D ---------- */
let realProgress = 0;
const stage = new Stage($('#stage'), { onProgress: (p) => { realProgress = p; } });
if (import.meta.env.DEV) window.__stage = stage;
// modo de teste: #f=0.4 congela a câmera naquele ponto do túnel
if (params.has('f')) Object.assign(stage.flight, { f: Number(params.get('f')), frozen: true });

/* ---------- carregamento: o selo é gravado conforme o site carrega ---------- */
stage.skipTunnel();
const seal = skipIntro ? null : createSeal($('#loader'));
let shown = 0;
const loadStart = performance.now();
function tickLoader() {
  const minTime = skipIntro ? 0 : 2600;
  const timeCap = minTime ? clamp((performance.now() - loadStart) / minTime) : 1;
  const target = Math.min(realProgress, timeCap);
  shown += (target - shown) * 0.12;
  if (target === 1 && shown > 0.995) shown = 1;
  seal?.setProgress(shown);
  return shown;
}

/* ---------- posições das seções ---------- */
let S = {};
function measure() {
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const c = $('#colecao');
  S = {
    vh: innerHeight,
    manifesto: top($('#manifesto')),
    col: top(c), colH: c.offsetHeight,
    maison: top($('#maison')),
    details: top($('#detalhes')),
  };
  stage.resize();
}

function trackFor(y) {
  const { vh, manifesto, col, colH, details } = S;
  const pin = colH - vh;
  if (y < col) return smooth(manifesto - vh * 0.4, col, y);
  if (y < col + pin) {
    const p = (y - col) / pin;
    return 1 + smooth(0.4, 0.6, p);
  }
  return 2 + smooth(col + pin, details, y);
}

/* ---------- coleção: textos que trocam ---------- */
const copyRose = $('#copyRose'), copyNoir = $('#copyNoir');
const giantRose = $('#giantRose'), giantNoir = $('#giantNoir');
const collectionIndex = $('#collectionIndex');
const window4 = (p, a, b, c, d) => Math.min(smooth(a, b, p), 1 - smooth(c, d, p));
function updateCollection(y) {
  const pin = S.colH - S.vh;
  const p = (y - S.col) / pin;
  const ra = window4(p, -0.18, 0.04, 0.3, 0.42);
  const na = window4(p, 0.58, 0.7, 0.98, 1.12);
  copyRose.style.opacity = ra;
  copyNoir.style.opacity = na;
  const lift = (a) => (1 - a) * 30;
  const base = innerWidth > 860 ? 'translateY(-50%) ' : '';
  copyRose.style.transform = `${base}translateY(${p < 0.2 ? lift(ra) : -lift(ra)}px)`;
  copyNoir.style.transform = `${base}translateY(${p < 0.8 ? lift(na) : -lift(na)}px)`;
  for (const [el, a] of [[copyRose, ra], [copyNoir, na]]) {
    const on = a > 0.5;
    // o nome do perfume se monta letra a letra toda vez que entra
    if (on && !el.classList.contains('active')) fly(el.querySelector('h2'), { duration: 1600 });
    el.classList.toggle('active', on);
  }
  giantRose.style.opacity = ra;
  giantNoir.style.opacity = na;
  giantRose.style.transform = `translateX(${(p - 0.15) * -30}vw)`;
  giantNoir.style.transform = `translateX(${(p - 0.85) * -30}vw)`;
  const idx = p > 0.5 ? '02' : '01';
  if (collectionIndex.textContent !== idx) collectionIndex.textContent = idx;
  $('#collectionBar').style.transform = `scaleX(${clamp(p)})`;
}

/* ---------- manifesto: palavras acendem com a rolagem ---------- */
const mWords = $$('.manifesto .wd');
function updateManifesto() {
  const r = $('#manifesto h2').getBoundingClientRect();
  const p = clamp((S.vh * 0.85 - r.top) / (r.height + S.vh * 0.35));
  mWords.forEach((w, i) => { w.style.opacity = 0.13 + 0.87 * smooth(i / mWords.length - 0.05, (i + 1) / mWords.length, p); });
}

/* ---------- etiquetas da abertura ---------- */
const tagRose = $('.tag-rose'), tagNoir = $('.tag-noir');
let tagsOn = false;
function updateTags(t) {
  if (!tagsOn) return;
  const a = 1 - smooth(0.02, 0.18, t);
  for (const [el, name, side] of [[tagRose, 'rose', -1], [tagNoir, 'noir', 1]]) {
    const p = stage.project(name, name === 'rose' ? 0.05 : 0.085);
    if (!p) continue;
    const w = el.offsetWidth;
    const x = side < 0 ? p.x - w - 18 : p.x + 18;
    el.style.transform = `translate(${x}px, ${p.y - window.scrollY * 0}px)`;
    el.style.opacity = a;
  }
}

/* ---------- as caixas: foco, borrifo, voz e música ---------- */
const cart = initCart({ onOpen: () => lenis.stop(), onClose: () => lenis.start() });
const caixas = initCaixas({ stage, cart });
if (import.meta.env.DEV) window.__caixas = caixas;
addEventListener('pointermove', (e) => {
  stage.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
}, { passive: true });

/* ---------- revelações ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  if (e.target.classList.contains('maison-image')) {
    const frame = $('.maison-frame', e.target);
    animate(frame, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 1600, ease: 'inOutCubic' });
    animate($('img', frame), { scale: [1.25, 1.12], duration: 2200, ease: 'outQuart' });
    return;
  }
  const items = $$('.reveal', e.target);
  animate(items, { opacity: [0, 1], translateY: [26, 0], duration: 1100, delay: stagger(110), ease: 'outQuart' });
}), { threshold: 0.2 });
io.observe($('.maison-image'));
io.observe($('.maison-copy'));

const parallax = $$('[data-parallax]');

/* ---------- entrada da abertura ---------- */
function revealHero() {
  const header = $('#header');
  header.style.setProperty('--hl', 1);
  animate('#header .brand, #header nav a, #sacolaBtn, #menuToggle', { opacity: [0, 1], translateY: [-10, 0], duration: 1200, delay: stagger(90), ease: 'outQuart' });
  fly($('.hero h1'), { delay: 150, duration: 2200 });
  animate('.hero .eyebrow', { opacity: [0, 1], translateY: [12, 0], duration: 1000, ease: 'outQuart' });
  animate('.hero-description, .hero .line-link', { opacity: [0, 1], translateY: [16, 0], duration: 1200, delay: stagger(140, { start: 750 }), ease: 'outQuart' });
  animate('.tag', { opacity: [0, 1], duration: 1200, delay: stagger(200, { start: 1200 }), ease: 'outQuart', onBegin: () => { tagsOn = true; } });
  setTimeout(() => { tagsOn = true; }, 1200);
}

function instantHero() {
  $$('.fx-fade').forEach((el) => { el.style.opacity = 1; });
  showChars($('.hero h1'));
  $('#header').style.setProperty('--hl', 1);
  tagsOn = true;
}

/* ---------- laço principal ---------- */
let last = performance.now();
let phase = 'loading';
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lenis.raf(now);

  if (phase === 'loading') {
    const v = tickLoader();
    if (v === 1 && stage.ready) {
      phase = 'intro';
      if (skipIntro) leaveLoader();
      else {
        // prensa o L, monta o nome e atravessa o selo até a tampa do Lourée Noir
        $('#loader').classList.add('done');
        seal.finish(throughSeal);
      }
    }
  }

  const y = lenis.scroll ?? scrollY;
  const t = forcedT ?? trackFor(y);
  stage.track = t;
  if (forcedT !== null && !stage.snapped) { stage.trackSmooth = t; stage.snapped = true; }

  $('#header').classList.toggle('scrolled', y > 40);
  document.body.classList.toggle('scene-details', t > 2.6);
  updateCollection(y);
  updateManifesto();
  updateTags(t);
  if (!reduce) parallax.forEach((el) => {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom > 0 && r.top < S.vh) el.style.translate = `0 ${(r.top + r.height / 2 - S.vh / 2) * -Number(el.dataset.parallax)}px`;
  });

  // não desenha o 3D quando uma seção sólida cobre a tela inteira
  const covers = (sel) => { const r = $(sel).getBoundingClientRect(); return r.top <= 0 && r.bottom >= S.vh; };
  stage.active = !(covers('#manifesto') || covers('#maison'));

  stage.update(dt);
  stage.render();
  stage.adapt(dt);
  requestAnimationFrame(frame);
}

function leaveLoader(keep) {
  const loader = $('#loader');
  stage.playing = true;
  document.body.classList.remove('is-loading');
  lenis.start();
  if (!keep) loader.remove();
  if (skipIntro) { stage.introT = 99; instantHero(); return; }
  setTimeout(revealHero, 3600);
}

// a câmera atravessa o "L": o selo cresce a partir do centro da letra e some
function throughSeal() {
  const loader = $('#loader'), selo = $('#loader .selo');
  const m = $('#loader .selo-mark').getBoundingClientRect(), s = selo.getBoundingClientRect();
  selo.style.transformOrigin = `${m.left + m.width * 0.5 - s.left}px ${m.top + m.height * 0.53 - s.top}px`;
  leaveLoader(true);
  animate(selo, { scale: [1, 28], duration: 1800, ease: 'inQuart' });
  animate(loader, {
    opacity: [1, 0], duration: 900, delay: 950, ease: 'linear',
    onComplete: () => { seal.stop(); loader.remove(); },
  });
}

addEventListener('resize', measure);
measure();
requestAnimationFrame(frame);
stage.load().then(() => { stage.ready = true; measure(); }).catch((err) => {
  console.error(err);
});
