import { animate, stagger } from 'animejs';

/* Letras que entram pelas laterais da tela e se juntam formando a frase.
   As letras pares vêm da esquerda e as ímpares da direita; as mais
   distantes do centro da frase chegam por último. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// separa o texto em letras (.ch) dentro de palavras (.wrd), mantendo <em> e <br>
export function splitChars(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'wrd';
          for (const letter of part) {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = letter;
            w.append(s);
          }
          frag.append(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
  };
  walk(el);
}

export function fly(el, { delay = 0, duration = 1900 } = {}) {
  splitChars(el);
  const chars = [...el.querySelectorAll('.ch')];
  if (!chars.length) return;
  animate(chars, { opacity: 0, translateX: 0, duration: 0 });
  if (reduce) { animate(chars, { opacity: 1, duration: 0 }); return; }
  const far = innerWidth * 0.62;
  animate(chars, {
    translateX: (_t, i) => [(i % 2 ? 1 : -1) * (far + (i * 37) % 160), 0],
    opacity: [{ to: 1, duration: duration * 0.45, ease: 'outQuad' }],
    duration,
    delay: stagger(26, { start: delay, from: 'center' }),
    ease: 'outExpo',
  });
}

// mostra sem animar (ex.: quando a entrada é pulada)
export function showChars(el) {
  splitChars(el);
  el.querySelectorAll('.ch').forEach((c) => { c.style.opacity = 1; c.style.transform = 'none'; });
}

// títulos marcados com data-fly-view animam quando aparecem na tela
export function flyOnView() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    fly(e.target);
  }), { threshold: 0.35 });
  document.querySelectorAll('[data-fly-view]').forEach((el) => { splitChars(el); io.observe(el); });
}
