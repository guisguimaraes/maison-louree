# Efeito do mergulho: sequência de frames controlada pelo scroll

É a mesma técnica dos sites de referência (o pote de creme que abre e afunda na peônia): um **vídeo vira uma sequência de imagens**, e o scroll escolhe qual imagem aparece no `<canvas>`. O resultado parece 3D realista, roda liso no celular e dá controle total sobre a cena.

## 1. Gerar o vídeo do mergulho

O vídeo é a matéria-prima. Opções:
- **Gerar com IA de vídeo** (Veo, Kling, Runway, Sora etc.), partindo de uma foto do frasco. Exemplo de prompt:
  > Side view of a water tank against a flat solid warm ivory (#f6f2ec) background. The water surface is a thin horizontal line crossing the full frame. A luxury perfume bottle drops in from above, hits the surface with a slow-motion splash and an air pocket around it, then sinks slowly while rotating gently, leaving a trail of bubbles. The camera follows the bottle down so the water surface moves up and out of the top of the frame. Clear transparent water, studio lighting, product centered, no other objects, 8 seconds, slow motion.

  O fundo **tem que ser** uma cor lisa e igual à do CSS da página (estilo "Meet CropTab").
- **Renderizar em 3D** (Blender), com o modelo do frasco.
- **Filmar de verdade** em câmera lenta.

Regras do vídeo:
- **Câmera parada** e frasco centralizado (o texto vai por cima).
- 6–10 segundos, sem cortes.
- Começo e fim calmos, porque são as cenas em que a pessoa mais para.
- Gerar uma versão **vertical** para celular se o enquadramento horizontal cortar o frasco.

### Frasco viajando pela página (estilo Hungry Tiger)
Para o frasco atravessar várias seções (girar, perder a tampa etc.) antes do mergulho, gere um **segundo vídeo** só com o frasco **isolado em fundo preto liso**. Assim o canvas fica `position: fixed` por cima da página inteira, e as seções (com seus fundos e textos) passam por trás. O Hungry Tiger usa 342 frames de 1300×1350 para isso. Para nós, 150–250 frames bastam.

## 2. Transformar o vídeo em frames

```bash
# desktop: ~150 frames, 1920px
ffmpeg -i mergulho.mp4 -vf "fps=20,scale=1920:-1" -c:v libwebp -quality 78 public/frames/desktop/%04d.webp

# celular: menos frames, menor
ffmpeg -i mergulho-vertical.mp4 -vf "fps=12,scale=900:-1" -c:v libwebp -quality 72 public/frames/mobile/%04d.webp
```

Meta de peso: desktop até ~8 MB no total, celular até ~3 MB.

## 3. Estrutura HTML

A seção é alta (o "trilho" do scroll). Dentro dela, um bloco `sticky` fica preso na tela enquanto a pessoa rola.

```html
<section class="dive" data-frames="150">
  <div class="dive__sticky">
    <canvas class="dive__canvas"></canvas>

    <div class="dive__chapter" data-from="0" data-to="0.15">
      <h1>Lourée <em>Nº 1</em></h1>
    </div>
    <div class="dive__chapter" data-from="0.30" data-to="0.55">
      <p class="eyebrow">NOTAS DE TOPO</p>
      <h2>Bergamota, <em>luz da manhã.</em></h2>
    </div>
    <!-- ...coração, fundo... -->

    <span class="dive__depth mono">PROFUNDIDADE <b>000</b>M</span>
  </div>
</section>
```

```css
.dive { height: 600vh; position: relative; }
.dive__sticky { position: sticky; top: 0; height: 100svh; overflow: hidden; }
.dive__canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.dive__chapter { position: absolute; left: 8vw; bottom: 14vh; opacity: 0; pointer-events: none; }
@media (max-width: 768px) { .dive { height: 450vh; } }
```

## 4. JavaScript

```js
import Lenis from 'lenis';
import { animate } from 'animejs';

const section = document.querySelector('.dive');
const canvas = section.querySelector('.dive__canvas');
const ctx = canvas.getContext('2d');
const depthEl = section.querySelector('.dive__depth b');
const chapters = [...section.querySelectorAll('.dive__chapter')];

const isMobile = matchMedia('(max-width: 768px)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const total = isMobile ? 90 : Number(section.dataset.frames);
const folder = isMobile ? 'mobile' : 'desktop';

// --- carregar frames ---
const frames = Array.from({ length: total }, (_, i) => {
  const img = new Image();
  img.src = `/frames/${folder}/${String(i + 1).padStart(4, '0')}.webp`;
  return img;
});
// O loader (contador 000 → 100) espera os primeiros frames; o resto continua carregando.
export const firstFramesReady = Promise.all(
  frames.slice(0, 20).map((img) => img.decode().catch(() => {}))
);

// --- canvas no tamanho certo (DPR limitado a 2) ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  draw(Math.round(current));
}
addEventListener('resize', resize);

// desenha com "object-fit: cover"
function draw(index) {
  const img = frames[index];
  if (!img?.complete || !img.naturalWidth) return;
  const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

// --- progresso do scroll (0 → 1) dentro da seção ---
function progress() {
  const r = section.getBoundingClientRect();
  const p = -r.top / (r.height - innerHeight);
  return Math.min(Math.max(p, 0), 1);
}

// --- capítulos de texto ---
function updateChapters(p) {
  for (const el of chapters) {
    const on = p >= +el.dataset.from && p <= +el.dataset.to;
    if (on === el._on) continue;
    el._on = on;
    animate(el, {
      opacity: on ? 1 : 0,
      translateY: on ? [24, 0] : [0, -16],
      duration: on ? 1000 : 500,
      ease: on ? 'outQuart' : 'inQuad',
    });
  }
}

// --- loop: suaviza o frame atual em direção ao alvo (lerp) ---
let current = 0;
function tick() {
  const p = progress();
  const target = p * (total - 1);
  current += (target - current) * (reduceMotion ? 1 : 0.12);
  draw(Math.round(current));
  updateChapters(p);
  depthEl.textContent = String(Math.round(p * 40)).padStart(3, '0');
  requestAnimationFrame(tick);
}

// --- scroll suave ---
const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);

resize();
tick();
```

Dependências: `npm i lenis animejs`.

## 5. Checklist antes de dar como pronto

- [ ] Rolar para cima e para baixo é liso, sem pulos de frame.
- [ ] Funciona em 390px de largura com os frames de celular.
- [ ] O loader só some quando os primeiros frames estão prontos.
- [ ] Com `prefers-reduced-motion`, nada se mexe bruscamente.
- [ ] Os textos dos capítulos nunca se sobrepõem.
- [ ] Peso total dos frames dentro da meta.

## Alternativa: WebGL / Three.js

Use só se precisar de interação real (girar o frasco com o mouse, água reagindo ao cursor). Precisa de modelo 3D (`.glb`) do frasco e shader de água, e pesa bem mais no celular. Na dúvida, fique com a sequência de frames.
