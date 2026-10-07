import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { makeLabel, makeMarble, LeafGobo } from './textures.js';
import { Tunnel } from './tunnel.js';
import { GiftBox } from './box.js';
import { Spray } from './spray.js';

const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const inOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const outQuart = (k) => 1 - Math.pow(1 - k, 4);

/* Posição dos frascos sobre o mármore (metros) */
const SPOTS = {
  rose: new THREE.Vector3(-0.056, 0, 0.03),
  noir: new THREE.Vector3(0.062, 0, -0.028),
};

/* Onde ficam as caixas sobre o mármore na seção "as caixas" (centro do fundo) */
const SLOTS = {
  rose: new THREE.Vector3(-0.07, 0, 0.012),
  noir: new THREE.Vector3(0.07, 0, 0.012),
};

/* Estados da câmera e da luz ao longo da página.
   0 = abertura · 1 = Rose Dorée · 2 = Lourée Noir · 3 = os frascos */
/* Túnel da entrada: termina no par de frascos e a câmera o atravessa
   até ficar colada na tampa do Lourée Noir (início da entrada da cena). */
const TUNNEL = { center: new THREE.Vector3(0.003, 0.05, 0), az: 16, el: 5, far: 6.2, dur: 5.2 };

const STATES = [
  { tgt: [0.0, 0.042, 0], az: 9, el: 10, dist: 0.6, shift: 0.25, key: '#ffd29a', keyI: 5.2, rim: '#ffb35c', rimI: 2.2, wall: '#3b2c1f', floor: '#21180f' },
  { tgt: [SPOTS.rose.x, 0.036, SPOTS.rose.z], az: -16, el: 6, dist: 0.37, shift: 0.24, key: '#ffcfb0', keyI: 5.0, rim: '#ff9f8a', rimI: 2.4, wall: '#3e2125', floor: '#221012' },
  { tgt: [SPOTS.noir.x, 0.04, SPOTS.noir.z], az: 22, el: 7, dist: 0.4, shift: 0.24, key: '#ffcf8a', keyI: 4.6, rim: '#ffb050', rimI: 2.8, wall: '#1f1b1c', floor: '#141011' },
  { tgt: [0.0, 0.012, 0.0], az: -3, el: 38, dist: 0.56, shift: 0.21, key: '#ffd8a8', keyI: 5.2, rim: '#ffb35c', rimI: 2.3, wall: '#33271c', floor: '#1d150e' },
];

export class Stage {
  constructor(canvas, { onProgress } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress || (() => {});
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.track = 0;          // posição alvo na página (0..3)
    this.trackSmooth = 0;    // posição suavizada
    this.focus = 'both';     // foco na seção "os frascos"
    this.focusMix = { rose: 0, noir: 0 };
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.drag = 0;           // giro extra vindo do arraste
    this.dragVel = 0;
    this.intro = this.reduce ? 1 : 0; // 0..1
    this.introT = 0;
    this.time = 0;
    this.active = true;
    this.angles = { rose: -0.5, noir: 0.4 };
    this.flight = { f: 0, f0: 0, t: 0, flying: false, done: false, speed: 0 };
    this.preLight = 0;       // luz que acende nos frascos no fundo do túnel
    this.boxes = {};
    this.up = { rose: 0, noir: 0 }; // 0 = deitado na caixa, 1 = de pé para borrifar
    this.upWant = null;
    this.sprayReq = null;

    this.initRenderer();
    this.initScene();
  }

  initRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' }));
    this.maxDpr = Math.min(devicePixelRatio, 1.5);
    r.setPixelRatio(this.maxDpr);
    // o vidro calcula o que está atrás dele em meia resolução (bem mais leve)
    r.transmissionResolutionScale = 0.5;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.reduce ? 1.05 : 0.2;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false; // atualizada em quadros alternados (os frascos giram devagar)
    this.aniso = r.capabilities.getMaxAnisotropy();

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#120e0a');

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.12;
    // estúdio só para os reflexos do vidro e do dourado
    this.studio = pmrem.fromScene(studioScene(), 0.02).texture;

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.14, 0.45, 0.96);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finish = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          vec2 q = vUv - 0.5;
          float v = smoothstep(0.85, 0.2, length(q * vec2(1.0, 1.2)));
          c.rgb *= mix(1.0 - uVig, 1.0, v);
          c.rgb += (h(vUv * 1000.0 + uTime) - 0.5) * 0.028;
          gl_FragColor = c;
        }`,
    });
    this.composer.addPass(this.finish);
  }

  initScene() {
    const s = this.scene;

    // parede e chão
    this.wallMat = new THREE.MeshStandardMaterial({ color: STATES[0].wall, roughness: 0.96 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), this.wallMat);
    wall.position.set(0, 1.2, -0.34);
    wall.receiveShadow = true;
    s.add(wall);
    this.floorMat = new THREE.MeshStandardMaterial({ color: STATES[0].floor, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.14;
    floor.receiveShadow = true;
    s.add(floor);

    // pedestal de mármore branco
    const marble = makeMarble(this.aniso);
    const geo = new RoundedBoxGeometry(0.42, 0.14, 0.24, 5, 0.006);
    boxUV(geo, 1 / 0.62);
    this.marbleMat = new THREE.MeshPhysicalMaterial({
      map: marble.map, roughnessMap: marble.rough, roughness: 1, metalness: 0,
      clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 1.6,
    });
    const ped = new THREE.Mesh(geo, this.marbleMat);
    ped.position.set(0.0, -0.07, 0);
    ped.castShadow = ped.receiveShadow = true;
    s.add(ped);

    // luz principal: sol entrando pelas folhas
    this.gobo = new LeafGobo(256);
    const key = (this.key = new THREE.SpotLight(STATES[0].key, 0, 0, 0.36, 0.5, 0));
    key.position.set(-0.8, 1.3, 0.22);
    key.target.position.set(0.08, 0.0, -0.2);
    key.map = this.gobo.texture;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.006;
    key.shadow.camera.near = 0.6;
    key.shadow.camera.far = 3;
    key.shadow.radius = 3;
    s.add(key, key.target);

    // contraluz quente: faz o perfume acender por dentro
    const rim = (this.rim = new THREE.SpotLight(STATES[0].rim, 0, 0, 0.6, 1, 0));
    rim.position.set(0.45, 0.32, -0.3);
    rim.target.position.set(0, 0.04, 0);
    s.add(rim, rim.target);

    this.hemi = new THREE.HemisphereLight('#ffe7c9', '#1a110a', 0);
    s.add(this.hemi);
    this.front = new THREE.DirectionalLight('#fff0dc', 0);
    this.front.position.set(0.2, 0.25, 1);
    s.add(this.front);

    // feixe de luz no ar
    this.beam = makeBeam(key.position, key.target.position);
    s.add(this.beam);

    this.bottles = {};

    this.tunnel = new Tunnel(TUNNEL.center, TUNNEL.az, TUNNEL.el);
    s.add(this.tunnel.points);
    this.spray = new Spray(s);
  }

  // atravessa o túnel até a tampa do Lourée Noir
  startFlight(onArrive) {
    const F = this.flight;
    if (F.frozen) return;
    F.flying = true; F.t = 0; F.f0 = F.f;
    this.onArrive = onArrive;
  }

  skipTunnel() {
    this.flight.done = true;
    this.tunnel.points.visible = false;
  }

  async load() {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => this.onProgress(loaded / total);
    const loader = new GLTFLoader(manager);
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('500 74px "Cormorant Garamond"'),
      document.fonts.load('italic 400 36px "Cormorant Garamond"'),
      document.fonts.load('400 62px "Manrope"'),
    ]).catch(() => {});

    const [rose, noir] = await Promise.all([
      loader.loadAsync(`${import.meta.env.BASE_URL}modelos/rose-doree.glb`),
      loader.loadAsync(`${import.meta.env.BASE_URL}modelos/louree-noir.glb`),
    ]);
    this.addBottle('rose', rose.scene);
    this.addBottle('noir', noir.scene);
    for (const n of ['rose', 'noir']) {
      const box = new GiftBox(n, this.bottles[n].size, this.aniso, this.studio);
      box.group.position.copy(SLOTS[n]);
      box.group.visible = false;
      this.scene.add(box.group);
      this.boxes[n] = box;
    }
    this.resize();
    // primeira compilação antes de mostrar
    this.renderer.compile(this.scene, this.camera);
  }

  addBottle(name, model) {
    const box = new THREE.Box3().setFromObject(model);
    const pivot = new THREE.Group();
    pivot.position.copy(SPOTS[name]);
    model.position.y = -box.min.y + 0.0004;
    // eixo do frasco no centro (para girar e deitar sem deslocar)
    const ctr = box.getCenter(new THREE.Vector3());
    model.position.x = -ctr.x;
    model.position.z = -ctr.z;
    pivot.add(model);
    this.scene.add(pivot);

    const label = makeLabel(name, this.aniso);
    const backs = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      o.castShadow = true;
      o.receiveShadow = true;
      if (m.name === 'Vidro') {
        o.castShadow = false;
        m.roughness = 0.04;
        m.thickness = 0.012;
        m.attenuationColor = new THREE.Color(0.98, 0.95, 0.85);
        m.attenuationDistance = 0.4;
        m.envMap = this.studio;
        m.envMapIntensity = 1.1;
        m.specularIntensity = 1;
        m.clearcoat = 1;
        m.clearcoatRoughness = 0.03;
      } else if (m.name === 'Perfume') {
        m.thickness = 0.02;
        m.attenuationColor = new THREE.Color(1.0, 0.66, 0.16);
        m.attenuationDistance = 0.022;
        m.color = new THREE.Color(1.0, 0.86, 0.5);
        m.emissive = new THREE.Color('#d98a1e');
        m.emissiveIntensity = 0.32;
        m.roughness = 0.06;
        m.envMap = this.studio;
        m.envMapIntensity = 0.7;
      } else if (m.name === 'Metal dourado') {
        m.roughness = 0.3; // dourado escovado: brilho mais contido
        m.envMap = this.studio;
        m.envMapIntensity = 0.75;
        m.color = new THREE.Color(0.7, 0.5, 0.22);
      } else if (m.name.startsWith('Rotulo')) {
        o.position.z += 0.0006;
        m.map = label.map;
        m.metalnessMap = label.mr;
        m.roughnessMap = label.mr;
        m.metalness = 1;
        m.roughness = 1;
        m.side = THREE.FrontSide;
        m.envMap = this.studio;
        m.envMapIntensity = 0.9;
        m.needsUpdate = true;
        // verso do rótulo (visto através do vidro)
        const back = new THREE.Mesh(o.geometry, new THREE.MeshStandardMaterial({
          color: name === 'rose' ? '#c9b48e' : '#bfae8c', roughness: 0.8, side: THREE.BackSide,
        }));
        back.position.copy(o.position);
        back.position.z -= 0.0002;
        backs.push([o.parent, back]);
      }
    });
    backs.forEach(([parent, b]) => parent.add(b));

    // luz âmbar atravessando o perfume e pintando o mármore
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshBasicMaterial({
      map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      color: '#ffb54a',
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.rotation.z = -0.55;
    glow.position.copy(SPOTS[name]).add(new THREE.Vector3(0.062, 0.0008, -0.05));
    this.scene.add(glow);

    this.bottles[name] = { pivot, model, glow, height: box.max.y - box.min.y, size: box.getSize(new THREE.Vector3()) };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.mobile = w / h < 0.85;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 3, h / 3);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.tunnel.resize(h, this.camera.fov, w / h, this.renderer.getPixelRatio());
    this.spray.resize(h * this.renderer.getPixelRatio(), this.camera.fov);
  }

  /* estado interpolado para a posição t (0..3) */
  stateAt(t) {
    const i = clamp(Math.floor(t), 0, STATES.length - 2);
    const k = inOutCubic(clamp(t - i));
    const a = STATES[i], b = STATES[i + 1];
    const col = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    return {
      tgt: new THREE.Vector3(...a.tgt).lerp(new THREE.Vector3(...b.tgt), k),
      az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), dist: lerp(a.dist, b.dist, k),
      shift: lerp(a.shift, b.shift, k),
      key: col(a.key, b.key), keyI: lerp(a.keyI, b.keyI, k),
      rim: col(a.rim, b.rim), rimI: lerp(a.rimI, b.rimI, k),
      wall: col(a.wall, b.wall), floor: col(a.floor, b.floor),
    };
  }

  setPointer(x, y) { this.pointer.set(x, y); }
  dragBy(dx) { this.dragVel += dx * 0.012; }

  update(dt) {
    this.time += dt;
    const T = this.time;

    // entrada (≈5,5 s)
    if (this.intro < 1 && this.playing) {
      this.introT += dt;
      this.intro = clamp(this.introT / 5.4);
    }
    const iT = this.introT;
    if (this.bottles.noir) this.preLight = Math.min(1, this.preLight + dt / 2.8);
    const pre = outCubic(this.preLight);
    const lightOpen = this.reduce ? 1 : Math.max(pre * 0.45, outCubic(clamp((iT - 0.3) / 2.6)));
    const camK = this.reduce ? 1 : inOutCubic(clamp((iT - 0.5) / 4.4));
    const spinK = this.reduce ? 0 : clamp((iT - 1.2) / 3);

    this.trackSmooth = lerp(this.trackSmooth, this.track, this.reduce ? 1 : 1 - Math.pow(0.0015, dt));
    const t = this.trackSmooth;
    const S = this.stateAt(t);

    // foco escolhido na seção "os frascos"
    const inDetails = clamp(t - 2);
    for (const n of ['rose', 'noir']) {
      const want = this.focus === n ? 1 : 0;
      this.focusMix[n] = lerp(this.focusMix[n], want, 1 - Math.pow(0.02, dt));
    }
    // frasco que sai da caixa para borrifar
    for (const n of ['rose', 'noir']) {
      const want = this.upWant === n && this.focus === n ? 1 : 0;
      this.up[n] = clamp(this.up[n] + (want ? dt : -dt) / 1.5);
    }
    for (const n of ['rose', 'noir']) {
      const f = this.focusMix[n] * inDetails;
      if (f > 0.001) {
        const box = this.boxes[n];
        const u = inOutCubic(this.up[n]);
        const ft = SLOTS[n].clone().add(new THREE.Vector3(0, lerp(0.012, (box ? box.D : 0.03) + 0.06, u), lerp(0.035, 0.0, u)));
        S.tgt.lerp(ft, f);
        S.az = lerp(S.az, n === 'rose' ? -8 : 8, f);
        S.el = lerp(S.el, lerp(34, 10, u), f);
        S.dist = lerp(S.dist, lerp(0.27, 0.34, u), f);
        S.shift = lerp(S.shift, 0.2, f);
      }
    }

    // celular: cena centralizada na parte de cima da tela
    let shiftX = S.shift, shiftY = 0;
    if (this.mobile) {
      shiftX = 0;
      shiftY = lerp(-0.2, -0.04, inDetails);
      S.dist *= 1.55;
      if (t > 0.5 && t < 2.5) { shiftY = -0.13; S.dist *= 1.12; }
    }

    // câmera: começa colada na tampa do Lourée Noir e se afasta
    this.pointerSmooth.lerp(this.pointer, 1 - Math.pow(0.04, dt));
    const startTgt = SPOTS.noir.clone().add(new THREE.Vector3(0, 0.088, 0));
    const tgt = startTgt.lerp(S.tgt, camK);
    const az = lerp(38, S.az, camK) + this.pointerSmooth.x * 3.2;
    const el = lerp(3, S.el, camK) + this.pointerSmooth.y * 1.6;
    const dist = lerp(0.11, S.dist, camK) * (1 + Math.sin(T * 0.21) * 0.006);
    this.camera.position.set(
      tgt.x + Math.sin(az * DEG) * Math.cos(el * DEG) * dist,
      tgt.y + Math.sin(el * DEG) * dist,
      tgt.z + Math.cos(az * DEG) * Math.cos(el * DEG) * dist,
    );
    if (!this.flight.done) this.flyTunnel(dt, T);
    else this.camera.lookAt(tgt);
    const sx = lerp(0, shiftX, camK), sy = lerp(0, shiftY, camK);
    this.camera.setViewOffset(this.w, this.h, -sx * this.w, -sy * this.h, this.w, this.h);

    // luzes
    const breathe = 1 + Math.sin(T * 0.4) * 0.04 + Math.sin(T * 1.13) * 0.015;
    this.key.color.copy(S.key);
    this.key.intensity = S.keyI * lightOpen * breathe;
    this.rim.color.copy(S.rim);
    this.rim.intensity = S.rimI * (this.reduce ? 1 : Math.max(pre * 0.9, clamp((iT - 1.4) / 2.2) ** 1.5));
    this.hemi.intensity = 0.07 * lightOpen;
    this.front.intensity = 0.12 * lightOpen;
    this.scene.environmentIntensity = 0.03 + 0.09 * lightOpen;
    this.wallMat.color.copy(S.wall);
    this.floorMat.color.copy(S.floor);
    this.renderer.toneMappingExposure = this.reduce ? 1.05 : Math.max(lerp(0.25, 0.8, pre), lerp(0.25, 1.05, outQuart(clamp(iT / 3))));
    this.beam.material.uniforms.uOpacity.value = 0.05 * lightOpen * breathe * (1 - inDetails * 0.4);
    this.beam.material.uniforms.uTime.value = T;
    this.beam.material.uniforms.uColor.value.copy(S.key);
    this.frameN = (this.frameN || 0) + 1;
    if (this.frameN % 2 === 0 || this.frameN < 3) this.renderer.shadowMap.needsUpdate = true;
    if (!this.reduce && (this.frameN % 2 === 1 || lightOpen < 1)) {
      this.gobo.draw(T, lightOpen, Math.sin(T * 0.05) * 0.03);
    }

    // giro dos frascos
    this.dragVel *= Math.pow(0.04, dt);
    this.drag += this.dragVel;
    const fronts = { rose: bump(t, 1, 0.75), noir: bump(t, 2, 0.75) };
    for (const n of ['rose', 'noir']) {
      const b = this.bottles[n];
      if (!b) continue;
      const speed = (n === 'rose' ? 0.11 : 0.09) * spinK * (1 - clamp((t - 2) * 4));
      let a = this.angles[n] + speed * dt * (1 - fronts[n]);
      // na coleção, o frasco da vez vira de frente e balança devagar
      if (fronts[n] > 0.01) {
        const goal = Math.round(a / (Math.PI * 2)) * Math.PI * 2 + Math.sin(T * 0.45) * 0.42;
        a += (goal - a) * (1 - Math.pow(0.25, dt)) * fronts[n];
      }
      this.angles[n] = a;
      b.pivot.rotation.y = a + this.drag;
      const other = n === 'rose' ? fronts.noir : fronts.rose;
      const away = n === 'rose' ? -0.3 : 0.3;
      b.pivot.position.x = SPOTS[n].x + away * other;
      b.pivot.position.z = SPOTS[n].z - 0.05 * other;
      b.glow.position.x = b.pivot.position.x + 0.062;
      b.glow.position.z = b.pivot.position.z - 0.05;
      // leve flutuação durante a entrada
      const settle = 1 - outCubic(clamp((iT - 0.2) / 3.2));
      b.pivot.position.y = SPOTS[n].y + (this.reduce ? 0 : settle * 0.012 * (n === 'rose' ? 1 : 0.6));
      b.glow.material.opacity = 0.55 * lightOpen * (1 - settle);
      this.placeInBox(n, b, t, T);
    }
    this.updateSpray(dt, T);

    this.finish.uniforms.uTime.value = (T * 60) % 1000;
  }

  /* Seção "as caixas": as caixas entram pelas laterais, os frascos sobem,
     deitam e descem para dentro delas. No foco, o outro sai de cena e o
     escolhido se levanta da caixa para borrifar. */
  placeInBox(n, b, t, T) {
    const box = this.boxes[n];
    if (!box) return;
    const d2 = clamp(t - 2);
    const lift = smoothstep(0.02, 0.35, d2);
    const boxIn = smoothstep(0.15, 0.6, d2);
    const put = smoothstep(0.5, 0.95, d2);
    const side = n === 'rose' ? -1 : 1;
    const other = n === 'rose' ? 'noir' : 'rose';
    const away = inOutCubic(clamp(this.focusMix[other] * 1.15)) * clamp(d2 * 2);
    const offX = side * (0.42 * (1 - inOutCubic(boxIn)) + 0.32 * away);
    box.group.visible = boxIn > 0.001 && away < 0.999;
    box.group.position.set(SLOTS[n].x + offX, 0, SLOTS[n].z);
    if (lift <= 0) return;

    const size = b.size, h = b.height;
    const base = box.group.position;
    const rest = box.restPoint(size).add(base);
    const hover = new THREE.Vector3(base.x, box.D + 0.035 + Math.sin(T * 0.8) * 0.002 * (1 - put), base.z);
    const u = inOutCubic(this.up[n]);
    const stand = new THREE.Vector3(base.x, box.D + 0.01 + Math.sin(T * 0.9) * 0.0015, base.z + 0.01);

    const p = b.pivot.position.clone().lerp(hover, lift).lerp(rest, put).lerp(stand, u);
    b.pivot.position.copy(p);
    // de frente para a câmera, deita (rótulo para cima) e, ao borrifar, se levanta
    const cur = b.pivot.rotation.y;
    const front = Math.round(cur / (Math.PI * 2)) * Math.PI * 2;
    b.pivot.rotation.y = lerp(lerp(cur, front, lift), front + (n === 'rose' ? -0.62 : -0.62), u);
    b.pivot.rotation.x = lerp(-Math.PI / 2 * put, 0, u);
    b.glow.material.opacity *= 1 - lift;
  }

  // pede o borrifo: o frasco se levanta e, de pé, borrifa
  sprayBottle(n) {
    this.upWant = n;
    this.sprayReq = n;
  }

  resetSpray() {
    this.upWant = null;
    this.sprayReq = null;
  }

  updateSpray(dt, T) {
    const n = this.sprayReq;
    if (n && this.up[n] >= 1 && this.bottles[n]) {
      const b = this.bottles[n];
      b.pivot.updateMatrixWorld();
      // orifício do pulverizador: topo da tampa, voltado para a frente do frasco
      const origin = b.pivot.localToWorld(new THREE.Vector3(0, b.height - 0.006, 0.007));
      const dir = new THREE.Vector3(0, 0.06, 1).applyQuaternion(b.pivot.getWorldQuaternion(new THREE.Quaternion()));
      this.spray.uniforms.uLight.value.copy(this.key.position).normalize();
      this.spray.fire(origin, dir);
      this.sprayReq = null;
      this.onSpray?.(n);
    }
    this.spray.update(dt, T);
  }

  // qual perfume está sob o ponteiro (coordenadas normalizadas -1..1)
  pick(x, y) {
    if (!this.ray) this.ray = new THREE.Raycaster();
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    let best = null, bestD = Infinity;
    for (const n of ['rose', 'noir']) {
      const objs = [this.boxes[n]?.group, this.bottles[n]?.pivot].filter((o) => o && o.visible);
      const hit = this.ray.intersectObjects(objs, true)[0];
      if (hit && hit.distance < bestD) { bestD = hit.distance; best = n; }
    }
    return best;
  }

  // câmera dentro do túnel: anda em escala logarítmica (a velocidade parece constante)
  // e no fim desvia até a tampa do Lourée Noir, onde a entrada da cena começa
  flyTunnel(dt, T) {
    const F = this.flight;
    const prev = F.f;
    if (F.flying) {
      F.t += dt;
      const k = clamp(F.t / TUNNEL.dur);
      F.f = F.f0 + (1 - F.f0) * inOutCubic(k);
      if (k >= 1) {
        F.done = true;
        this.tunnel.points.visible = false;
        this.onArrive?.();
      }
    } else if (!F.frozen) {
      F.f = Math.min(0.06, F.f + dt * 0.012); // deriva lenta enquanto carrega
    }
    const f = F.f;
    F.speed = lerp(F.speed, dt > 0 ? (f - prev) / dt : 0, 1 - Math.pow(0.01, dt));

    const cap = SPOTS.noir.clone().add(new THREE.Vector3(0, 0.088, 0));
    const m = inOutCubic(clamp((f - 0.55) / 0.45));
    const dist = Math.exp(lerp(Math.log(TUNNEL.far), Math.log(0.11), f));
    const tgt = TUNNEL.center.clone().lerp(cap, m);
    const az = lerp(TUNNEL.az, 38, m) + this.pointerSmooth.x * 3.2;
    const el = lerp(TUNNEL.el, 3, m) + this.pointerSmooth.y * 1.6;
    this.camera.position.set(
      tgt.x + Math.sin(az * DEG) * Math.cos(el * DEG) * dist,
      tgt.y + Math.sin(el * DEG) * dist,
      tgt.z + Math.cos(az * DEG) * Math.cos(el * DEG) * dist,
    );
    this.camera.lookAt(tgt);
    // leve rolagem da câmera: sensação de ser puxado para dentro
    this.camera.rotateZ(Math.sin(T * 0.3) * 0.02 * (1 - m));

    const U = this.tunnel.uniforms;
    U.uTime.value = T;
    U.uSpin.value += dt * (0.08 + F.speed * 0.9);
    U.uStretch.value = 1 + Math.min(3.2, F.speed * 9);
    U.uFade.value = clamp(T / 1.6) * (1 - smoothstep(0.78, 0.97, f));
  }

  // posição na tela (px) de um ponto acima do frasco
  project(name, up = 0.07) {
    const b = this.bottles[name];
    if (!b) return null;
    const v = SPOTS[name].clone();
    v.y += up;
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  render() {
    if (!this.active) return;
    if (this.bloomOn === false) this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }

  // se a máquina não segura ~40 fps, reduz a resolução e depois tira o brilho (bloom)
  adapt(dt) {
    if (!this.active || this.intro < 1) return;
    // espera a cena assentar (compilação e texturas causam engasgos no começo)
    this.settle = (this.settle || 0) + dt;
    if (this.settle < 3) return;
    this.fpsAcc = (this.fpsAcc || 0) + dt;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = 0; this.fpsN = 0;
    if (fps > 40) { this.slow = 0; return; }
    this.slow = (this.slow || 0) + 1;
    if (this.slow < 2) return; // só reduz se ficar lento duas medições seguidas
    this.slow = 0;
    const pr = this.renderer.getPixelRatio();
    if (pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      this.resize();
    } else if (this.bloomOn !== false) {
      this.bloomOn = false;
    } else if (this.renderer.getPixelRatio() > 0.75) {
      this.renderer.setPixelRatio(0.75);
      this.resize();
    }
  }
}

/* ---------- auxiliares ---------- */

function smoothstep(a, b, v) {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
}

function bump(t, c, w) {
  const d = Math.abs(t - c) / w;
  return d >= 1 ? 0 : inOutCubic(1 - d);
}

// UV por projeção nas faces, para os veios não ficarem esticados
function boxUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = p.getZ(i) + 0.3; v = p.getY(i); }
    else if (ny >= nz) { u = p.getX(i); v = p.getZ(i) + 0.17; }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * scale + 0.5, v * scale + 0.5);
  }
  uv.needsUpdate = true;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// cone de luz suave entre a lâmpada e o pedestal (poeira iluminada)
function makeBeam(from, to) {
  const len = from.distanceTo(to) * 1.15;
  const geo = new THREE.CylinderGeometry(0.03, 0.42, len, 48, 1, true);
  geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffd29a') }, uLen: { value: len } },
    vertexShader: `
      varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      uniform float uLen;
      void main(){
        vH = -position.y / uLen;
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform float uTime; uniform vec3 uColor;
      varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float edge = pow(abs(dot(vN, vV)), 2.2);
        float fall = smoothstep(0.0, 0.25, vH) * smoothstep(1.0, 0.55, vH);
        float a = atan(vP.x, vP.z);
        float streak = 0.65 + 0.35 * n(vec2(a * 3.0, vH * 2.0 - uTime * 0.05));
        gl_FragColor = vec4(uColor * edge * fall * streak * uOpacity, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from);
  const dir = to.clone().sub(from).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  m.renderOrder = 10;
  return m;
}

// sala escura com caixas de luz quentes: dá ao dourado e ao vidro reflexos de estúdio
function studioScene() {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color('#0d0906');
  const box = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    sc.add(m);
  };
  box(4, 3, '#ffd9a6', 3.2, [-4, 4, 3], [0, 0, 0]);     // janela de sol (principal)
  box(0.6, 5, '#ffe7c4', 2.2, [4.5, 1, 1.5], [0, 0, 0]); // faixa à direita
  box(0.5, 4, '#ffb96a', 1.6, [-3, 0.5, -4], [0, 0, 0]); // contraluz
  box(6, 0.4, '#fff1dc', 1.2, [0, 5, -1], [0, 0, 0]);    // faixa no teto
  box(8, 8, '#3a2614', 0.6, [0, -3, 0], [0, 0, 0]);      // rebatido quente do chão
  box(5, 2.2, '#ffcf91', 1.5, [0.6, 0.6, 5], [0, 0, 0]); // painel atrás da câmera: frente da tampa dourada
  box(0.35, 5, '#fff0d6', 2.6, [-2.2, 0.8, 3.6], [0, 0, 0]); // faixa vertical: brilho no cilindro
  box(0.35, 5, '#ffe2b8', 2.0, [2.6, 0.8, 3.2], [0, 0, 0]);
  return sc;
}
