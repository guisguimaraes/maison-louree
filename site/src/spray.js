import * as THREE from 'three';

/* ------------------------------------------------------------------
   Borrifo de perfume dentro da cena 3D.
   Duas camadas, como num borrifo real fotografado em contraluz:
   - gotículas: milhares de pontos minúsculos saindo do bico num cone
     estreito, freando no ar (arrasto), com leve turbulência e brilho
     quando a luz as atravessa;
   - névoa: nuvens macias que nascem junto do bico, crescem, sobem um
     pouco e somem devagar.
------------------------------------------------------------------- */

const DROPS = 5200;
const PUFFS = 70;
const rand = (a, b) => a + Math.random() * (b - a);

function smokeTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  // várias manchas suaves sobrepostas: borda irregular, sem cara de círculo
  for (let i = 0; i < 26; i++) {
    const r = rand(14, 34);
    const px = S / 2 + rand(-1, 1) * (S / 2 - r) * 0.7;
    const py = S / 2 + rand(-1, 1) * (S / 2 - r) * 0.7;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }
  // apaga o quadrado nas bordas
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m;
  x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Spray {
  constructor(scene) {
    // gotículas
    this.pos = new Float32Array(DROPS * 3);
    this.vel = new Float32Array(DROPS * 3);
    this.life = new Float32Array(DROPS).fill(-1); // < 0 = inativa
    this.maxLife = new Float32Array(DROPS);
    const size = new Float32Array(DROPS), seed = new Float32Array(DROPS), alpha = new Float32Array(DROPS);
    for (let i = 0; i < DROPS; i++) { size[i] = Math.pow(Math.random(), 2.2) * 0.9 + 0.25; seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    this.alpha = alpha;
    this.uniforms = {
      uPx: { value: 800 }, uLight: { value: new THREE.Vector3(-0.6, 0.8, 0.2).normalize() },
      uColor: { value: new THREE.Color('#fff1d6') }, uTime: { value: 0 },
    };
    this.drops = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aSeed; attribute float aAlpha;
        uniform float uPx; uniform vec3 uLight; uniform float uTime;
        varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          // gotícula real: 0.03–0.1 mm, mas o brilho a faz parecer maior
          gl_PointSize = clamp(aSize * 0.00055 * uPx / d, 1.0, 7.0);
          // espalhamento para a frente: brilha mais quando a luz vem de trás
          vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
          float back = pow(max(dot(-viewDir, uLight) * 0.5 + 0.5, 0.0), 3.0);
          float twinkle = 0.75 + 0.25 * sin(uTime * 9.0 + aSeed * 60.0);
          vA = aAlpha * (0.35 + 1.4 * back) * twinkle;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          gl_FragColor = vec4(uColor * a * a * vA, 1.0);
        }`,
    }));
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 30;
    scene.add(this.drops);

    // névoa
    const tex = smokeTexture();
    this.puffs = [];
    for (let i = 0; i < PUFFS; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: '#ffe6bd', transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0, rotation: Math.random() * 6.28,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 29;
      scene.add(s);
      this.puffs.push({ s, vel: new THREE.Vector3(), life: -1, max: 1, grow: 1, spin: 0 });
    }

    this.emitting = 0;  // segundos restantes de jato
    this.origin = new THREE.Vector3();
    this.dir = new THREE.Vector3(1, 0, 0);
    this.next = 0;
    this.puffNext = 0;
  }

  resize(h, fovDeg) {
    this.uniforms.uPx.value = h / (2 * Math.tan((fovDeg / 2) * Math.PI / 180));
  }

  // um borrifo: jato de ~0,45 s, como uma apertada no pulverizador
  fire(origin, dir) {
    this.origin.copy(origin);
    this.dir.copy(dir).normalize();
    this.emitting = 0.5;
  }

  emitDrop(i) {
    // cone estreito (≈ 9°) com mais gotas no centro
    const d = this.dir;
    const up = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const a = new THREE.Vector3().crossVectors(d, up).normalize();
    const b = new THREE.Vector3().crossVectors(d, a).normalize();
    const ang = Math.random() * Math.PI * 2;
    const spread = Math.tan(9 * Math.PI / 180) * Math.pow(Math.random(), 0.7);
    const speed = rand(0.7, 1.45);
    const v = d.clone().addScaledVector(a, Math.cos(ang) * spread).addScaledVector(b, Math.sin(ang) * spread).normalize().multiplyScalar(speed);
    const k = i * 3;
    this.pos[k] = this.origin.x + rand(-0.0004, 0.0004);
    this.pos[k + 1] = this.origin.y + rand(-0.0004, 0.0004);
    this.pos[k + 2] = this.origin.z + rand(-0.0004, 0.0004);
    this.vel[k] = v.x; this.vel[k + 1] = v.y; this.vel[k + 2] = v.z;
    this.maxLife[i] = rand(2.6, 4.6);
    this.life[i] = 0;
  }

  emitPuff() {
    const p = this.puffs.find((q) => q.life < 0);
    if (!p) return;
    const t = rand(0.006, 0.1) * Math.random(); // ao longo do jato, mais perto do bico
    p.s.position.copy(this.origin).addScaledVector(this.dir, t);
    p.vel.copy(this.dir).multiplyScalar(rand(0.12, 0.4)).add(new THREE.Vector3(rand(-0.02, 0.02), rand(0, 0.03), rand(-0.02, 0.02)));
    p.life = 0;
    p.max = rand(3.5, 6);
    p.grow = rand(0.06, 0.15);
    p.spin = rand(-0.25, 0.25);
    p.s.visible = true;
  }

  update(dt, time) {
    this.uniforms.uTime.value = time;
    // emissão
    if (this.emitting > 0) {
      this.emitting -= dt;
      const rate = 9000; // gotas por segundo no pico
      this.next += rate * dt;
      while (this.next >= 1) {
        this.next -= 1;
        // reaproveita as gotas em anel (as mais antigas já sumiram)
        this.cursor = ((this.cursor || 0) + 1) % DROPS;
        this.emitDrop(this.cursor);
      }
      this.puffNext += 70 * dt;
      while (this.puffNext >= 1) { this.puffNext -= 1; this.emitPuff(); }
    }

    // gotículas: arrasto forte (freiam em ~15 cm), quase sem gravidade, ar mexendo
    const drag = Math.exp(-6.2 * dt);
    let live = 0;
    for (let i = 0; i < DROPS; i++) {
      if (this.life[i] < 0) { this.alpha[i] = 0; continue; }
      live++;
      const k = i * 3;
      this.life[i] += dt;
      const L = this.life[i] / this.maxLife[i];
      if (L >= 1) { this.life[i] = -1; this.alpha[i] = 0; continue; }
      const px = this.pos[k], py = this.pos[k + 1], pz = this.pos[k + 2];
      const swirl = 0.035;
      this.vel[k] = this.vel[k] * drag + Math.sin(py * 90 + time * 1.7) * swirl * dt;
      this.vel[k + 1] = this.vel[k + 1] * drag - 0.012 * dt + Math.sin(pz * 80 + time * 1.3) * swirl * dt;
      this.vel[k + 2] = this.vel[k + 2] * drag + Math.sin(px * 85 + time * 1.1) * swirl * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.alpha[i] = Math.min(1, this.life[i] * 30) * (1 - L) * (1 - L);
    }
    this.drops.visible = live > 0;
    this.drops.geometry.attributes.position.needsUpdate = true;
    this.drops.geometry.attributes.aAlpha.needsUpdate = true;

    // névoa
    for (const p of this.puffs) {
      if (p.life < 0) continue;
      p.life += dt;
      const L = p.life / p.max;
      if (L >= 1) { p.life = -1; p.s.visible = false; continue; }
      p.vel.multiplyScalar(Math.exp(-2.4 * dt));
      p.vel.y += 0.004 * dt; // o ar morno sobe devagar
      p.s.position.addScaledVector(p.vel, dt);
      const size = 0.01 + p.grow * (1 - Math.exp(-p.life * 0.9));
      p.s.scale.setScalar(size);
      p.s.material.rotation += p.spin * dt;
      p.s.material.opacity = 0.075 * Math.min(1, p.life * 3) * Math.pow(1 - L, 1.3);
    }
  }

  get active() {
    return this.emitting > 0 || this.drops.visible || this.puffs.some((p) => p.life >= 0);
  }
}
