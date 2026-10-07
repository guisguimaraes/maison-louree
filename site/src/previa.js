import * as THREE from 'three';
import { Stage } from './scene.js';
import { laurelSVG } from './laurel.js';
import { fly, splitChars } from './fly.js';

/* Prévia das 5 entradas propostas. Usa a mesma cena do site, mas controla
   câmera, luz e camadas por cima; no fim de cada uma a câmera se encaixa
   na posição que o site usa. Não altera o site. */

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const DEG = Math.PI / 180;

const NOIR = new THREE.Vector3(0.062, 0, -0.028);
const ROSE = new THREE.Vector3(-0.056, 0, 0.03);

const stage = new Stage($('#stage'));
const cam = stage.camera;
const fadeEl = $('#fade');
const title = $('#pvTitle');
splitChars(title);
title.setAttribute('data-fly', '');

/* ---------- auxiliares de câmera e luz ---------- */
// câmera auxiliar: lookAt de câmera olha por -z (um Object3D comum olharia ao contrário)
const dummy = new THREE.PerspectiveCamera();
function pose(tgt, az, el, dist) {
  const p = new THREE.Vector3(
    tgt.x + Math.sin(az * DEG) * Math.cos(el * DEG) * dist,
    tgt.y + Math.sin(el * DEG) * dist,
    tgt.z + Math.cos(az * DEG) * Math.cos(el * DEG) * dist,
  );
  dummy.position.copy(p);
  dummy.lookAt(tgt);
  return { pos: p, quat: dummy.quaternion.clone() };
}
function mixPose(a, b, k) {
  return { pos: a.pos.clone().lerp(b.pos, k), quat: a.quat.clone().slerp(b.quat, k) };
}
const endPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
let endOffset = 0;
// aplica uma pose; k = quanto já se encaixou na posição do site
function setCam(p, k) {
  const q = mixPose(p, endPose, k);
  cam.position.copy(q.pos);
  cam.quaternion.copy(q.quat);
  if (cam.view) { cam.view.offsetX = endOffset * k; cam.updateProjectionMatrix(); }
}

let envMats = [];
function collectEnv() {
  const seen = new Set();
  stage.scene.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => {
      if (seen.has(m) || !('envMapIntensity' in m)) return;
      seen.add(m);
      m.userData.envBase = m.envMapIntensity;
      envMats.push(m);
    });
  });
}
function setEnv(k) { envMats.forEach((m) => { m.envMapIntensity = m.userData.envBase * k; }); }
function lights(k) {
  stage.key.intensity *= k;
  stage.rim.intensity *= k;
  stage.hemi.intensity *= k;
  stage.front.intensity *= k;
  stage.scene.environmentIntensity *= k;
  stage.beam.material.uniforms.uOpacity.value *= k;
}

/* ---------- texto do fim ---------- */
let titleShown = false;
function showTitle(on) {
  $('#pvCopy').classList.toggle('on', on);
  $('#pvBrand').classList.toggle('on', on);
  if (on && !titleShown) { titleShown = true; fly(title, { duration: 2000 }); }
  if (!on) { titleShown = false; title.querySelectorAll('.ch').forEach((c) => { c.style.opacity = 0; }); }
}

/* ---------- som do borrifo (sintetizado, sem arquivo) ---------- */
let actx;
function psst() {
  try {
    actx = actx || new AudioContext();
    const len = actx.sampleRate * 0.9;
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.6;
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = actx.createGain();
    const t = actx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.03);
    g.gain.setValueAtTime(0.3, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    src.connect(bp).connect(hp).connect(g).connect(actx.destination);
    src.start();
  } catch { /* sem áudio */ }
}

/* ---------- textura de fumaça para o borrifo da entrada 4 ---------- */
function smokeCanvas() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const r = 20 + Math.random() * 60;
    const px = S / 2 + (Math.random() * 2 - 1) * (S / 2 - r) * 0.7;
    const py = S / 2 + (Math.random() * 2 - 1) * (S / 2 - r) * 0.7;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S / 2);
  m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m;
  x.fillRect(0, 0, S, S);
  return c;
}
const smoke = smokeCanvas();

/* ---------- ondulação dourada da gota ---------- */
const ripple = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: -1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform float uT; varying vec2 vUv;
    void main(){
      if (uT < 0.0) discard;
      float d = length(vUv - 0.5) * 0.7; // metros
      float c = 0.0;
      for (int i = 0; i < 3; i++) {
        float t = uT - float(i) * 0.35;
        if (t < 0.0) continue;
        float r = t * 0.085 + t * t * 0.01;
        float w = 0.0016 + t * 0.0012;
        c += exp(-pow((d - r) / w, 2.0)) * exp(-t * 0.9) * (1.0 - float(i) * 0.28);
      }
      c += exp(-d * 60.0) * exp(-uT * 2.5) * 1.5; // clarão no ponto de impacto
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * c * 1.4, 1.0);
    }`,
}));
ripple.rotation.x = -Math.PI / 2;
ripple.position.set(0.004, 0.0007, 0.006);
ripple.visible = false;

const drop = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 32, 24), new THREE.MeshPhysicalMaterial({
  color: '#ffcf7a', roughness: 0.03, metalness: 0, transmission: 0.85, thickness: 0.006,
  attenuationColor: new THREE.Color('#e08a1c'), attenuationDistance: 0.01, ior: 1.36,
  emissive: '#b5650f', emissiveIntensity: 0.35,
}));
drop.visible = false;

const sweep = new THREE.SpotLight('#ffdcae', 0, 0, 0.075, 0.85, 0);

/* ---------- as cinco entradas ---------- */
const lids = {};
function lidPose(n, e) {
  const box = stage.boxes[n];
  const L = lids[n];
  const p = L.closed.clone().lerp(L.open, e);
  p.y += Math.sin(Math.PI * e) * 0.07;
  box.lid.position.copy(p);
  box.lid.rotation.x = lerp(0, L.openRx, smooth(0.2, 1, e));
}

const INTROS = [
  {
    // 1. a caixa se abrindo
    track: 3, dur: 11,
    frame(t) {
      fadeEl.style.opacity = 1 - smooth(0.2, 1.6, t);
      const nb = stage.boxes.noir.group.position;
      const D = stage.boxes.noir.D;
      lidPose('noir', ease(clamp((t - 1.8) / 2.6)));
      lidPose('rose', ease(clamp((t - 3.6) / 2.6)));
      const a = pose(nb.clone().add(new THREE.Vector3(0, D, 0.004)), 4, 74, 0.16);
      const b = pose(nb.clone().add(new THREE.Vector3(0, D * 0.6, 0)), -12, 42, 0.24);
      const p = mixPose(a, b, ease(smooth(1.6, 5.2, t)));
      setCam(p, ease(smooth(5, 9, t)));
      const L = lerp(0.28, 1, smooth(2.2, 6, t));
      lights(L);
      setEnv(lerp(0.35, 1, smooth(2.2, 6, t)));
      showTitle(t > 8.2);
    },
  },
  {
    // 2. a luz desenhando o frasco
    track: 0, dur: 12,
    frame(t) {
      fadeEl.style.opacity = 1 - smooth(0.1, 0.6, t);
      const onNoir = 1 - smooth(4.4, 5.2, t);
      const subj = onNoir > 0.5 ? NOIR : ROSE;
      // faixa de luz atravessando o frasco da vez
      const local = onNoir > 0.5 ? clamp((t - 0.8) / 3.6) : clamp((t - 5.2) / 3.4);
      const sx = subj.x + lerp(-0.07, 0.07, ease(local));
      // contraluz: vem de trás e de cima, acende as bordas do vidro e o perfume
      sweep.position.set(sx, 0.2, subj.z - 0.26);
      sweep.target.position.set(sx, 0.045, subj.z + 0.02);
      const win = Math.sin(Math.PI * local);
      sweep.intensity = 70 * win * (1 - smooth(8.4, 9.6, t));
      const pass = Math.exp(-Math.pow((sx - subj.x) / 0.04, 2));
      const open = smooth(8.2, 10.2, t);
      lights(open);
      stage.rim.intensity = Math.max(stage.rim.intensity, 2.6 * pass * win);
      setEnv(Math.max(open, 0.1 + 1.1 * pass * win));
      const pn = pose(NOIR.clone().add(new THREE.Vector3(0, 0.05, 0)), 30 + t * 1.5, 3, 0.2);
      const pr = pose(ROSE.clone().add(new THREE.Vector3(0, 0.045, 0)), -26 + (t - 5) * 1.5, 3, 0.19);
      const p = mixPose(pn, pr, ease(smooth(4.3, 5.4, t)));
      setCam(p, ease(smooth(8.2, 11.4, t)));
      showTitle(t > 9.6);
    },
  },
  {
    // 3. a gota
    track: 0, dur: 11,
    frame(t, dt, st) {
      fadeEl.style.opacity = 1 - smooth(0.1, 0.9, t);
      const impact = 2.9;
      const ip = ripple.position;
      if (t < impact) {
        const k = clamp((t - 0.7) / (impact - 0.7));
        drop.visible = t > 0.7;
        drop.position.set(ip.x, lerp(0.15, 0.0036, k * k), ip.z);
        drop.scale.set(1, 1 + k * 0.35, 1);
      } else if (!st.hit) {
        st.hit = true;
        drop.visible = false;
        ripple.visible = true;
        stage.spray.fire(new THREE.Vector3(ip.x, 0.002, ip.z), new THREE.Vector3(0, 1, 0), { speed: 0.2, spread: 38, duration: 0.07, mist: false });
      }
      ripple.material.uniforms.uT.value = t < impact ? -1 : t - impact;
      const L = lerp(0.1, 1, smooth(impact + 0.2, impact + 2.8, t));
      lights(L);
      setEnv(lerp(0.45, 1, smooth(impact, impact + 2.5, t)));
      const a = pose(new THREE.Vector3(ip.x, 0.022, ip.z), 2, 7, 0.23);
      setCam(a, ease(smooth(impact + 1.2, impact + 5.4, t)));
      showTitle(t > impact + 4.6);
    },
    end() { ripple.visible = false; drop.visible = false; },
  },
  {
    // 4. o borrifo que revela
    track: 0, dur: 9.5,
    frame(t, dt, st) {
      fadeEl.style.opacity = 0;
      const mask = st.mask, mist = st.mist;
      const W = mask.width, H = mask.height;
      if (!st.init) {
        st.init = true;
        st.blobs = [];
        const m = mask.getContext('2d');
        m.globalCompositeOperation = 'source-over';
        m.fillStyle = '#0a0908';
        m.fillRect(0, 0, W, H);
        mask.style.opacity = 1;
      }
      if (t > 0.6 && !st.fired) {
        st.fired = true;
        psst();
        stage.spray.fire(new THREE.Vector3(-0.2, 0.075, 0.12), new THREE.Vector3(1, 0.04, -0.28), { speed: 1.5, spread: 11, duration: 1.4 });
      }
      // cabeça da névoa atravessando a tela da esquerda para a direita
      const head = smooth(0.6, 3.4, t);
      if (t > 0.6 && t < 3.6) {
        for (let i = 0; i < 3; i++) {
          const hx = lerp(-0.15, 1.15, head) * W - Math.random() * W * 0.12;
          const hy = H * (0.42 + Math.sin(hx / W * 4) * 0.07) + (Math.random() - 0.5) * H * 0.25;
          st.blobs.push({ x: hx, y: hy, born: t, r0: H * (0.05 + Math.random() * 0.08), rot: Math.random() * 6.28 });
        }
      }
      const m = mask.getContext('2d');
      m.globalCompositeOperation = 'destination-out';
      const g = mist.getContext('2d');
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const b of st.blobs) {
        const age = t - b.born;
        if (age > 3.2) continue;
        const r = b.r0 + age * H * 0.16;
        m.globalAlpha = 0.07;
        m.save(); m.translate(b.x, b.y); m.rotate(b.rot + age * 0.3);
        m.drawImage(smoke, -r, -r, r * 2, r * 2);
        m.restore();
        g.globalAlpha = 0.07 * Math.exp(-age * 1.4);
        g.save(); g.translate(b.x + age * W * 0.03, b.y - age * H * 0.02); g.rotate(b.rot);
        g.drawImage(smoke, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        g.restore();
      }
      g.globalAlpha = 1;
      // tinge a névoa de dourado
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(236,206,150,.85)';
      g.fillRect(0, 0, W, H);
      mask.style.opacity = 1 - smooth(3.8, 5.2, t);
      const a = pose(new THREE.Vector3(0.004, 0.045, 0), 4, 8, 0.5);
      setCam(a, ease(smooth(1.5, 7, t)));
      showTitle(t > 5.6);
    },
    end(st) {
      st.mask.style.opacity = 0;
      st.mist.getContext('2d').clearRect(0, 0, st.mist.width, st.mist.height);
    },
  },
  {
    // 5. o selo dourado
    track: 0, dur: 11,
    frame(t, dt, st) {
      const selo = $('#selo'), sv = $('#selo .sv');
      fadeEl.style.opacity = 0;
      if (!st.init) {
        st.init = true;
        sv.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="pvGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#8a6d3f"/><stop offset=".42" stop-color="#d8b874"/>
              <stop offset=".5" stop-color="#fff2cc"/><stop offset=".58" stop-color="#d8b874"/>
              <stop offset="1" stop-color="#7a5f36"/>
            </linearGradient>
          </defs>
          <g fill="url(#pvGold)" stroke="url(#pvGold)">${laurelSVG()}</g>
          <text x="100" y="124" text-anchor="middle" font-family="Cormorant Garamond" font-weight="500" font-size="92" fill="url(#pvGold)" id="pvL">L</text>
        </svg>`;
        st.leaves = [...sv.querySelectorAll('g > *')];
        st.grad = sv.querySelector('#pvGold');
        st.L = sv.querySelector('#pvL');
      }
      selo.style.opacity = 1 - smooth(4.9, 5.9, t);
      const n = st.leaves.length;
      st.leaves.forEach((el, i) => {
        // as folhas brotam da base para o alto, alternando os dois ramos
        const order = (i % (n / 2)) / (n / 2);
        const k = smooth(0.4 + order * 1.8, 0.7 + order * 1.8, t);
        el.style.opacity = k;
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = 'center';
        el.style.transform = `scale(${lerp(0.4, 1, k)})`;
      });
      const press = smooth(2.5, 2.75, t);
      st.L.style.opacity = press;
      st.L.style.transformBox = 'fill-box';
      st.L.style.transformOrigin = 'center';
      st.L.style.transform = `scale(${lerp(1.35, 1, ease(smooth(2.5, 3.1, t)))})`;
      // brilho metálico correndo pelo dourado
      const sh = lerp(-1, 1.2, smooth(1, 4.4, t));
      st.grad.setAttribute('gradientTransform', `translate(${sh} ${sh})`);
      // atravessa o L
      const z = ease(smooth(4.2, 5.9, t));
      sv.style.transform = `scale(${1 + z * 28})`;
      sv.style.transformOrigin = '50% 58%';
      const cap = pose(NOIR.clone().add(new THREE.Vector3(0, 0.088, 0)), 38, 3, 0.11);
      setCam(cap, ease(smooth(4.6, 9.6, t)));
      lights(smooth(4.4, 7, t));
      setEnv(lerp(0.3, 1, smooth(4.4, 7, t)));
      showTitle(t > 8.4);
    },
    end() { $('#selo').style.opacity = 0; },
  },
];

/* ---------- controle ---------- */
let cur = null, curI = -1, t0 = 0, st = {};
const maskEl = $('#mask'), mistEl = $('#mist');
function sizeCanvases() {
  for (const c of [maskEl, mistEl]) { c.width = innerWidth; c.height = innerHeight; }
}
sizeCanvases();
addEventListener('resize', () => { sizeCanvases(); stage.resize(); });

function play(i) {
  if (cur?.end) cur.end(st);
  curI = i;
  cur = INTROS[i];
  t0 = performance.now();
  st = { mask: maskEl, mist: mistEl };
  showTitle(false);
  // tampas fechadas no começo da entrada da caixa; abertas nas outras
  for (const n of ['rose', 'noir']) if (lids[n]) lidPose(n, i === 0 ? 0 : 1);
  sweep.intensity = 0;
  stage.spray.emitting = 0;
  document.querySelectorAll('.pv-bar [data-i]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
}
document.querySelectorAll('.pv-bar [data-i]').forEach((b) => b.addEventListener('click', () => play(+b.dataset.i)));
$('#pvRep').addEventListener('click', () => play(Math.max(0, curI)));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (stage.ready && cur) {
    const t = (now - t0) / 1000;
    stage.track = cur.track;
    stage.trackSmooth = cur.track;
    stage.update(dt);
    endPose.pos.copy(cam.position);
    endPose.quat.copy(cam.quaternion);
    endOffset = cam.view ? cam.view.offsetX : 0;
    cur.frame(Math.min(t, cur.dur + 30), dt, st);
    stage.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

stage.load().then(() => {
  stage.skipTunnel();
  stage.playing = true;
  stage.introT = 99;
  stage.scene.add(ripple, drop, sweep, sweep.target);
  for (const n of ['rose', 'noir']) {
    const box = stage.boxes[n];
    lids[n] = { open: box.lid.position.clone(), openRx: box.lid.rotation.x, closed: new THREE.Vector3(0, box.D + 0.0011, 0) };
  }
  collectEnv();
  stage.resize();
  stage.ready = true;
  $('#pvLoad').remove();
  play(0);
});

if (import.meta.env.DEV) window.__pv = { stage, get t() { return (performance.now() - t0) / 1000; }, get i() { return curI; } };
