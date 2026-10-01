// The Blender-built cyclist: loading, material finishing, drivetrain motion (chain links,
// cassette, jockey wheels, wheels with spoke blur) and phase-locked posture blending.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clamp, damp, lerp } from './noise.js';

export const WHEEL_R = 0.3355;
const RIM_R = 0.311;
const RING_T = 52;
const COGS = [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 28];
const RINGS = [52, 36];
const PITCH = 0.0127;
const sprocketR = (n) => PITCH / (2 * Math.sin(Math.PI / n));
export const CIRC = 2 * Math.PI * WHEEL_R;

const sanitize = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

export const KITS = {
  signal: {
    label: 'Signal', swatch: ['#eef0f2', '#e8552d', '#16314f'],
    Jersey: '#eef0f2', JerseyAccent: '#e8552d', JerseyDark: '#16314f', Bib: '#131417', BibBand: '#2a2c31',
    Sock: '#f3f3f1', SockBand: '#e8552d', Helmet: '#f4f5f6', HelmetAccent: '#16314f', Shoe: '#f2f2f0',
    FramePaint: '#16314f', FrameAccent: '#e8552d', BarTape: '#1b1c1f', Lens: '#e0682f', Bottle: '#e9ecef',
  },
  forest: {
    label: 'Forest', swatch: ['#1f5a3d', '#e9d8a6', '#0f2a1d'],
    Jersey: '#1f5a3d', JerseyAccent: '#e9d8a6', JerseyDark: '#0f2a1d', Bib: '#14181a', BibBand: '#1f5a3d',
    Sock: '#e9d8a6', SockBand: '#1f5a3d', Helmet: '#1c1e1f', HelmetAccent: '#e9d8a6', Shoe: '#1c1e1f',
    FramePaint: '#3c4a36', FrameAccent: '#e9d8a6', BarTape: '#7a5a3a', Lens: '#5a8f5f', Bottle: '#1f5a3d',
  },
  crimson: {
    label: 'Crimson', swatch: ['#b3122e', '#f4f4f4', '#141414'],
    Jersey: '#b3122e', JerseyAccent: '#f4f4f4', JerseyDark: '#141414', Bib: '#121212', BibBand: '#b3122e',
    Sock: '#141414', SockBand: '#b3122e', Helmet: '#b3122e', HelmetAccent: '#141414', Shoe: '#141414',
    FramePaint: '#121315', FrameAccent: '#c8102e', BarTape: '#b3122e', Lens: '#c8c8d0', Bottle: '#141414',
  },
  glacier: {
    label: 'Glacier', swatch: ['#9fd3f2', '#1d2b53', '#ffffff'],
    Jersey: '#9fd3f2', JerseyAccent: '#1d2b53', JerseyDark: '#1d2b53', Bib: '#1d2b53', BibBand: '#9fd3f2',
    Sock: '#ffffff', SockBand: '#9fd3f2', Helmet: '#ffffff', HelmetAccent: '#9fd3f2', Shoe: '#ffffff',
    FramePaint: '#e9eef2', FrameAccent: '#2f8fd1', BarTape: '#ffffff', Lens: '#5f9fe0', Bottle: '#9fd3f2',
  },
};

// fabric sheen: a soft lift of the base colour (dark fabrics stay dark)
const sheenFor = (c) => c.clone().lerp(new THREE.Color(1, 1, 1), 0.12).multiplyScalar(0.9);

const FABRIC = new Set(['Jersey', 'JerseyAccent', 'JerseyDark', 'Bib', 'BibBand', 'Sock', 'SockBand', 'Glove']);

function streakTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const cx = 128;
  const grd = g.createRadialGradient(cx, cx, 6, cx, cx, 128);
  grd.addColorStop(0, 'rgba(20,20,22,0.0)');
  grd.addColorStop(0.12, 'rgba(20,20,22,0.55)');
  grd.addColorStop(0.92, 'rgba(26,26,28,0.32)');
  grd.addColorStop(1, 'rgba(26,26,28,0.0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    g.strokeStyle = `rgba(0,0,0,${0.15 + 0.25 * ((i * 37) % 7) / 7})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cx, 20 + ((i * 53) % 100), a, a + 0.35);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Cyclist {
  static async load(buffer) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(buffer, '');
    return new Cyclist(gltf, buffer.byteLength);
  }

  constructor(gltf, bytes) {
    this.gltf = gltf;
    this.bytes = bytes;
    this.root = new THREE.Group();
    this.root.name = 'CyclistRoot';
    this.scene = gltf.scene;
    this.root.add(this.scene);
    this.node = (n) => this.scene.getObjectByName(sanitize(n));
    this.materials = new Map();
    this.meshes = [];
    this.stats = { tris: 0, meshes: 0, bones: 0, clips: gltf.animations.length, materials: 0, bytes };

    // ---- prototypes for instancing: hide
    this.linkOuter = this.node('ChainLinkOuter');
    this.linkInner = this.node('ChainLinkInner');
    this.linkOuter.visible = this.linkInner.visible = false;

    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o === this.linkOuter || o === this.linkInner) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.isSkinnedMesh) {
        o.frustumCulled = false;
        this.skeleton = o.skeleton;
      }
      this.meshes.push(o);
      const idx = o.geometry.index;
      this.stats.tris += (idx ? idx.count : o.geometry.attributes.position.count) / 3;
      this.materials.set(o.material.name, o.material);
    });
    this.stats.meshes = this.meshes.length;
    this.stats.bones = this.skeleton ? this.skeleton.bones.length : 0;
    this.finishMaterials();
    this.stats.materials = this.materials.size;

    this.wheels = [this.node('Wheel_F'), this.node('Wheel_R')];
    this.cassette = this.node('Cassette');
    this.jockeyU = this.node('Jockey_U');
    this.jockeyL = this.node('Jockey_L');
    this.setupWheels();
    this.setupChain();

    // ---- animation
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      this.actions[clip.name] = a;
    }
    this.pedalDur = this.actions.Seated.getClip().duration;      // 2 s = 2 revolutions
    this.w = { Seated: 1, Standing: 0, Coast: 0 };
    this.tp = 0.0;            // pedal phase in revolutions
    this.pedalling = 1;       // 0..1 ease of crank motion
    this.mode = 'pedal';      // pedal | toCoast | coast
    this.posture = 'Seated';
    this.coastTime = 0;
    this.crank = 0;
    this.wheelAngle = 0;
    this.chainS = 0;
    this.cassetteAngle = 0;
    this.lastCrank = 0;
    this.cadence = 90;
    this.speed = 0;
    this.gear = [52, 17];
    this.view = 'shaded';
  }

  // ---------------------------------------------------------------- materials
  finishMaterials() {
    const swap = (name, make) => {
      const old = this.materials.get(name);
      if (!old) return;
      const m = make(old);
      m.name = name;
      for (const o of this.meshes) if (o.material === old) o.material = m;
      this.materials.set(name, m);
      old.dispose();
    };
    const phys = (old, extra) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: old.color.clone(), roughness: old.roughness, metalness: old.metalness,
        clearcoat: old.clearcoat || 0, clearcoatRoughness: old.clearcoatRoughness || 0.05,
        emissive: old.emissive ? old.emissive.clone() : undefined, emissiveIntensity: old.emissiveIntensity,
      });
      Object.assign(m, extra);
      return m;
    };
    for (const name of FABRIC) {
      swap(name, (old) => phys(old, {
        roughness: name.startsWith('Bib') ? 0.55 : 0.72, metalness: 0, clearcoat: 0,
        sheen: 0.8, sheenRoughness: name.startsWith('Bib') ? 0.4 : 0.55,
        sheenColor: sheenFor(old.color),
      }));
    }
    swap('Skin', (old) => phys(old, {
      roughness: 0.58, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.5,
      sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffd0b8'),
    }));
    swap('FramePaint', (old) => phys(old, { metalness: 0.45, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.035 }));
    swap('FrameAccent', (old) => phys(old, { metalness: 0.1, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04 }));
    swap('Helmet', (old) => phys(old, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }));
    swap('HelmetAccent', (old) => phys(old, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }));
    swap('Lens', (old) => phys(old, {
      metalness: 0.9, roughness: 0.04, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6,
      iridescenceThicknessRange: [180, 520],
    }));
    swap('Carbon', (old) => phys(old, { roughness: 0.32, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.08 }));
    const tune = { Tyre: { roughness: 0.86 }, TyreWall: { roughness: 0.82 }, Rubber: { roughness: 0.75 },
      ChainSteel: { roughness: 0.35, metalness: 1 }, Steel: { roughness: 0.22 }, Rotor: { roughness: 0.25 } };
    for (const [n, p] of Object.entries(tune)) {
      const m = this.materials.get(n);
      if (m) Object.assign(m, p);
    }
    const screen = this.materials.get('Screen');
    if (screen) { screen.emissiveIntensity = 0.6; }
    for (const m of this.materials.values()) m.envMapIntensity = 1.0;
  }

  setKit(key) {
    const k = KITS[key];
    if (!k) return;
    this.kit = key;
    for (const [name, hex] of Object.entries(k)) {
      const m = this.materials.get(name);
      if (!m || !m.color) continue;
      m.color.set(hex);
      if (m.sheenColor && FABRIC.has(name)) m.sheenColor.copy(sheenFor(m.color));
    }
  }

  setEnvIntensity(v) {
    for (const m of this.materials.values()) m.envMapIntensity = v;
  }

  // ---------------------------------------------------------------- wheels
  setupWheels() {
    const streak = streakTexture();
    this.blur = [];
    for (const w of this.wheels) {
      let spokes = null, decal = null;
      w.traverse((o) => {
        if (o.isMesh && o.material.name === 'Spokes') spokes = o;
        if (o.isMesh && o.material.name === 'RimDecal') decal = o;
      });
      if (spokes) {
        spokes.material = spokes.material.clone();
        spokes.material.transparent = true;
      }
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.03, RIM_R - 0.044, 64, 1),
        new THREE.MeshBasicMaterial({ map: streak, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
      disc.renderOrder = 2;
      w.add(disc);
      // rim-decal blur band, both faces of the rim
      const band = new THREE.Group();
      for (const z of [-0.0146, 0.0146]) {
        const r = new THREE.Mesh(new THREE.RingGeometry(RIM_R - 0.026, RIM_R - 0.012, 96, 1),
          new THREE.MeshBasicMaterial({ color: 0xdedede, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
        r.position.z = z;
        band.add(r);
      }
      w.add(band);
      if (decal) { decal.material = decal.material.clone(); decal.material.transparent = true; }
      this.blur.push({ spokes, decal, disc, band });
    }
  }

  // ---------------------------------------------------------------- chain
  setupChain() {
    const pathNode = this.node('ChainPath');
    const ud = pathNode.userData;
    const raw = ud.chain_points;
    this.chainLinks = ud.chain_links;
    const pts = [];
    for (let i = 0; i < raw.length; i += 3) pts.push(new THREE.Vector3(raw[i], raw[i + 2], -raw[i + 1]));   // Blender Z-up -> Y-up
    const cum = [0];
    for (let i = 1; i <= pts.length; i++) cum.push(cum[i - 1] + pts[i % pts.length].distanceTo(pts[i - 1]));
    this.chainPts = pts;
    this.chainCum = cum;
    this.chainLen = cum[cum.length - 1];
    this.chainStep = this.chainLen / this.chainLinks;
    const mat = this.linkOuter.material;
    const half = this.chainLinks / 2;
    // meshopt quantization keeps a dequantization scale/offset on each prototype node:
    // bake it (and the int16 attributes) into plain float geometry before instancing
    const bake = (node) => {
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(node.geometry.attributes)) {
        const arr = new Float32Array(attr.count * attr.itemSize);
        for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) arr[i * attr.itemSize + k] = attr.getComponent(i, k);
        g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
      }
      g.setIndex(node.geometry.index);
      node.updateMatrix();
      g.applyMatrix4(node.matrix);
      return g;
    };
    this.chainOuter = new THREE.InstancedMesh(bake(this.linkOuter), mat, half);
    this.chainInner = new THREE.InstancedMesh(bake(this.linkInner), mat, half);
    for (const im of [this.chainOuter, this.chainInner]) {
      im.castShadow = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      pathNode.add(im);
      this.meshes.push(im);
    }
    this.stats.tris += (this.linkOuter.geometry.index.count / 3 + this.linkInner.geometry.index.count / 3) * half;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p0 = new THREE.Vector3();
    this._p1 = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._z = new THREE.Vector3(0, 0, 1);
    this.placeChain(0);
  }

  chainAt(s, out) {
    const L = this.chainLen;
    s = ((s % L) + L) % L;
    const cum = this.chainCum;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const a = this.chainPts[lo], b = this.chainPts[(lo + 1) % this.chainPts.length];
    return out.copy(a).lerp(b, (s - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo]));
  }

  placeChain(s0) {
    const st = this.chainStep;
    for (let i = 0; i < this.chainLinks; i++) {
      const s = s0 + i * st;
      this.chainAt(s, this._p0);
      this.chainAt(s + st, this._p1);
      const ang = Math.atan2(this._p1.y - this._p0.y, this._p1.x - this._p0.x);
      this._q.setFromAxisAngle(this._z, ang);
      this._m.compose(this._p0, this._q, this._s);
      (i % 2 === 0 ? this.chainOuter : this.chainInner).setMatrixAt(i >> 1, this._m);
    }
    this.chainOuter.instanceMatrix.needsUpdate = true;
    this.chainInner.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- posture + drivetrain
  setPosture(p) {
    this.posture = p;
  }

  /**
   * dt: seconds. speed: m/s along the road. cadence: target rpm while pedalling.
   */
  update(dt, speed, cadence) {
    this.speed = speed;
    const want = this.posture;
    // ----- phase-locked transitions
    if (want === 'Coast') {
      if (this.mode === 'pedal') this.mode = 'toCoast';
    } else if (this.mode !== 'pedal') {
      this.mode = 'pedal';
    }
    let ped = this.mode === 'pedal' ? 1 : 0;
    if (this.mode === 'toCoast') {
      // keep turning until the cranks are level (right foot forward), then freeze
      const before = this.tp;
      const step = dt * Math.max(cadence, 50) / 60;
      const frac = before - Math.floor(before);
      let target = Math.floor(before) + 0.25;
      if (frac > 0.25) target += 1;
      if (before + step >= target) {
        this.tp = target;
        this.mode = 'coast';
      } else {
        this.tp = before + step;
      }
      ped = this.mode === 'coast' ? 0 : 1;
    }
    this.pedalling = damp(this.pedalling, ped, 4.0, dt);
    if (this.mode === 'pedal') this.tp += dt * cadence / 60 * clamp(this.pedalling * 1.6, 0.15, 1);
    // ----- weights
    const tw = { Seated: 0, Standing: 0, Coast: 0 };
    if (this.mode === 'coast') tw.Coast = 1;
    else if (want === 'Standing') tw.Standing = 1;
    else tw.Seated = 1;
    if (this.mode === 'toCoast') { tw.Seated = this.w.Seated > this.w.Standing ? 1 : 0; tw.Standing = 1 - tw.Seated; tw.Coast = 0; }
    let sum = 0;
    for (const k of Object.keys(tw)) { this.w[k] = damp(this.w[k], tw[k], k === 'Coast' || tw.Coast ? 5 : 2.6, dt); sum += this.w[k]; }
    for (const k of Object.keys(tw)) this.w[k] /= sum;
    // ----- drive the actions: pedalling loops share one phase; coast runs on its own clock
    const t = ((this.tp % 2) + 2) % 2 * (this.pedalDur / 2);
    for (const k of ['Seated', 'Standing']) {
      const a = this.actions[k];
      a.timeScale = 0;
      a.time = t;
      a.setEffectiveWeight(this.w[k]);
    }
    this.coastTime += dt;
    const c = this.actions.Coast;
    c.timeScale = 0;
    c.time = this.coastTime % c.getClip().duration;
    c.setEffectiveWeight(this.w.Coast);
    this.mixer.update(0);

    // ----- drivetrain kinematics
    this.crank = this.tp * Math.PI * 2;
    const dCrank = this.crank - this.lastCrank;
    this.lastCrank = this.crank;
    const chainV = dCrank * sprocketR(RING_T);            // chain travel this frame
    this.chainS += chainV;
    this.placeChain(this.chainS);
    if (this.jockeyU) this.jockeyU.rotation.z += chainV / sprocketR(11);
    if (this.jockeyL) this.jockeyL.rotation.z -= chainV / sprocketR(11);
    // wheels roll with the road speed; the cassette follows the chain, freewheeling when coasting
    const dWheel = speed * dt / WHEEL_R;
    this.wheelAngle += dWheel;
    for (const w of this.wheels) w.rotation.z = -this.wheelAngle;
    const cog = this.gear[1];
    const casDrive = dCrank * (this.gear[0] / cog);
    this.cassetteAngle += this.mode === 'pedal' ? Math.max(casDrive, dWheel * 0) : casDrive;
    if (this.cassette) this.cassette.rotation.z = -this.cassetteAngle;
    // spoke blur
    const omega = speed / WHEEL_R;                   // rad/s
    const f = clamp((omega - 9) / 14, 0, 1);
    for (const b of this.blur) {
      if (b.spokes) { b.spokes.material.opacity = 1 - 0.9 * f; b.spokes.material.depthWrite = f < 0.5; }
      b.disc.material.opacity = 0.75 * f;
      if (b.decal) b.decal.material.opacity = 1 - 0.85 * f;
      for (const r of b.band.children) r.material.opacity = 0.42 * f;
    }
  }

  /** Pick the gear that keeps cadence nearest the target at this speed; returns actual cadence. */
  shift(speed, targetCadence) {
    const wheelRpm = speed / CIRC * 60;
    let best = null;
    for (const r of RINGS) for (const c of COGS) {
      const cad = wheelRpm * c / r;
      const err = Math.abs(cad - targetCadence) + (r === 36 && speed > 6.2 ? 9 : 0) + (r === 52 && speed < 4.2 ? 9 : 0);
      if (!best || err < best.err) best = { err, r, c, cad };
    }
    // hysteresis: keep the current gear if it is close enough
    const cur = wheelRpm * this.gear[1] / this.gear[0];
    if (Math.abs(cur - targetCadence) < 7) return cur;
    this.gear = [best.r, best.c];
    return best.cad;
  }

  // ---------------------------------------------------------------- inspection views
  setView(mode, helperParent) {
    this.view = mode;
    if (!this.origMats) {
      this.origMats = new Map(this.meshes.map((m) => [m, m.material]));
      this.clayMat = new THREE.MeshStandardMaterial({ color: 0xd7d2c9, roughness: 0.78, metalness: 0 });
      this.wireMats = new Map();
    }
    for (const m of this.meshes) {
      const orig = this.origMats.get(m);
      if (mode === 'clay') m.material = this.clayMat;
      else if (mode === 'wire') {
        if (!this.wireMats.has(orig)) {
          const c = orig.color ? orig.color.clone() : new THREE.Color(0.8, 0.8, 0.8);
          const hsl = {};
          c.getHSL(hsl);
          c.setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.1), 0.45 + hsl.l * 0.35);
          this.wireMats.set(orig, new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.85 }));
        }
        m.material = this.wireMats.get(orig);
      } else if (mode === 'bones') {
        if (m.isSkinnedMesh) {
          if (!m.userData.ghost) {
            m.userData.ghost = orig.clone();
            m.userData.ghost.transparent = true;
            m.userData.ghost.opacity = 0.28;
            m.userData.ghost.depthWrite = false;
          }
          m.material = m.userData.ghost;
        } else m.material = orig;
      } else m.material = orig;
    }
    if (mode === 'bones') {
      if (!this.skelHelper) {
        this.skelHelper = new THREE.SkeletonHelper(this.scene);
        this.skelHelper.material.linewidth = 2;
        this.skelHelper.material.depthTest = false;
        this.skelHelper.material.transparent = true;
        this.skelHelper.renderOrder = 10;
      }
      (helperParent || this.root.parent).add(this.skelHelper);
    } else if (this.skelHelper && this.skelHelper.parent) {
      this.skelHelper.parent.remove(this.skelHelper);
    }
  }
}
