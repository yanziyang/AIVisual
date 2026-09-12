import * as THREE from "three";
import { GLTFLoader } from "../assets/vendor/loaders/GLTFLoader.js";
import { OrbitControls } from "../assets/vendor/controls/OrbitControls.js";
import { Reflector } from "../assets/vendor/objects/Reflector.js";
import { RoomEnvironment } from "../assets/vendor/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "../assets/vendor/lights/RectAreaLightUniformsLib.js";
import { BASE_PRICE, PAINTS, WHEELS, TRIMS, CALIPERS, EQUIP, SPECS, CAMERAS, INTERIOR_EYE } from "./config.js";
import { AmbientAudio } from "./audio.js";
import { ScreenUI } from "./screenui.js";

/* ------------------------------------------------------------------ diag */
const errors = [];
function diagErr(msg) {
  errors.push(String(msg));
  const el = document.getElementById("diag");
  el.dataset.count = String(errors.length);
  el.textContent = errors.slice(-6).join("\n");
  document.title = "VELARIS ERR=" + errors.length;
}
window.addEventListener("error", (e) => diagErr(e.message || e.type));
window.addEventListener("unhandledrejection", (e) => diagErr((e.reason && e.reason.message) || e.reason));

/* ----------------------------------------------------------------- state */
const q = new URLSearchParams(location.search);
const isCoarse = matchMedia("(pointer: coarse)").matches;
const isMobile = matchMedia("(max-width: 900px)").matches || isCoarse;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowQ = isMobile || q.get("q") === "low";

const state = {
  paint: 0, wheel: 0, trim: 0, caliper: 0,
  equip: { sills: false, ambient: false, blackTrim: false, privacy: false },
  doors: false, hatch: false, frunk: false,
  lights: false, charging: false, interior: false,
  camera: "hero", audio: false,
};

/* -------------------------------------------------------------- renderer */
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.3 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.FogExp2(0x05060a, 0.0075);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 300);
camera.position.set(-9.4, 1.6, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.58, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 4.4;
controls.maxDistance = 16.5;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = 1.505;
controls.rotateSpeed = 0.65;
controls.update();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.038).texture;
RectAreaLightUniformsLib.init();

/* ------------------------------------------------------------------ studio */
const studio = new THREE.Group();
scene.add(studio);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(80, 96),
  new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.38, metalness: 0.22, envMapIntensity: 0.55 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.16;
floor.receiveShadow = true;
studio.add(floor);

let reflector = null;
if (!lowQ) {
  reflector = new Reflector(new THREE.CircleGeometry(13.5, 88), {
    clipBias: 0.0035,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x15181d,
  });
  reflector.rotateX(-Math.PI / 2);
  reflector.position.y = -0.1565;
  studio.add(reflector);
}

const podium = new THREE.Mesh(
  new THREE.CylinderGeometry(4.55, 4.72, 0.16, 96, 1),
  new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.34, metalness: 0.35, envMapIntensity: 0.7 })
);
podium.position.y = -0.085;
podium.receiveShadow = true;
studio.add(podium);

let podiumTop = null;
if (!lowQ) {
  podiumTop = new Reflector(new THREE.CircleGeometry(4.54, 96), {
    clipBias: 0.0035,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x14171c,
  });
  podiumTop.rotateX(-Math.PI / 2);
  podiumTop.position.y = 0.0006;
  studio.add(podiumTop);
}
const podiumOverlay = new THREE.Mesh(
  new THREE.CircleGeometry(4.54, 96),
  new THREE.MeshStandardMaterial({
    color: 0x08090b, roughness: 0.6, metalness: 0.1,
    transparent: true, opacity: lowQ ? 1.0 : 0.72, depthWrite: !lowQ,
  })
);
podiumOverlay.rotation.x = -Math.PI / 2;
podiumOverlay.position.y = 0.0018;
podiumOverlay.receiveShadow = true;
studio.add(podiumOverlay);

const ringMat = new THREE.MeshStandardMaterial({
  color: 0x111214, emissive: 0xd9e4dd, emissiveIntensity: 0, roughness: 0.4, metalness: 0,
});
const ring = new THREE.Mesh(new THREE.TorusGeometry(4.56, 0.011, 10, 160), ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.004;
studio.add(ring);

/* ------------------------------------------------------------------ lights */
const key = new THREE.DirectionalLight(0xfff4e6, 4.0);
key.position.set(6.5, 9.5, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048);
key.shadow.camera.left = -7; key.shadow.camera.right = 7;
key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
key.shadow.camera.near = 1; key.shadow.camera.far = 30;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.025;
scene.add(key);

const fill = new THREE.DirectionalLight(0xbdd0e8, 1.2);
fill.position.set(-7, 4.5, -5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 2.0);
rim.position.set(-5.5, 2.6, 6.5);
scene.add(rim);

const topSoft = new THREE.DirectionalLight(0xffffff, 0.8);
topSoft.position.set(0.5, 12, -1.5);
scene.add(topSoft);

function softbox(w, h, pos, target, intensity) {
  const l = new THREE.RectAreaLight(0xffffff, intensity, w, h);
  l.position.set(pos[0], pos[1], pos[2]);
  l.lookAt(target[0], target[1], target[2]);
  scene.add(l);
  return l;
}
softbox(7.5, 3.4, [0.6, 6.4, 0.4], [0.3, 0, 0], 7);
softbox(6.8, 1.3, [-0.4, 2.7, -5.8], [0, 0.7, 0], 5);
softbox(6.8, 1.3, [0.4, 2.7, 5.8], [0, 0.7, 0], 4);
softbox(4.6, 2.4, [7.4, 2.6, -0.6], [0.6, 0.5, 0], 3.5);
softbox(4.6, 2.4, [-7.2, 2.4, 0.6], [-0.6, 0.5, 0], 2.5);

const podiumSpot = new THREE.SpotLight(0xffffff, 0, 45, 0.66, 1.0, 1.2);
podiumSpot.position.set(0.8, 8.6, 1.2);
podiumSpot.target.position.set(0, 0, 0);
scene.add(podiumSpot, podiumSpot.target);

if (!lowQ) scene.add(new THREE.HemisphereLight(0x2a3444, 0x05060a, 0.6));

/* -------------------------------------------------------------------- car */
const car = new THREE.Group();
scene.add(car);

const mats = {};
const nodes = {};
const wheelNodes = [];
const sillLedMats = [];
const hingeDefs = {};
const hingeState = { doorL: 0, doorR: 0, hatch: 0, frunk: 0 };
const interactive = [];
let chargeRig = null;
let headlightSpots = [];
const ambientLights = [];
let dashScreenMat = null;
const screenUI = new ScreenUI();

const HINGE_ANGLES = { doorL: -0.873, doorR: 0.873, hatch: -0.524, frunk: 0.436 };
const HINGE_AXES = {
  doorL: new THREE.Vector3(0, 1, 0),
  doorR: new THREE.Vector3(0, 1, 0),
  hatch: new THREE.Vector3(0, 0, 1),
  frunk: new THREE.Vector3(0, 0, 1),
};

function rotateNodeWorldAxis(node, axis, angle) {
  if (!node.userData.restQuat) node.userData.restQuat = node.quaternion.clone();
  const pq = node.parent ? node.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const qWorld = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const local = pq.clone().invert().multiply(qWorld).multiply(pq);
  node.quaternion.copy(node.userData.restQuat).premultiply(local);
}

function applyHinges() {
  for (const key of Object.keys(hingeState)) {
    const def = hingeDefs[key];
    if (!def) continue;
    rotateNodeWorldAxis(def.node, HINGE_AXES[key], HINGE_ANGLES[key] * hingeState[key]);
  }
}

const loader = new GLTFLoader();
const loadFill = document.getElementById("loadFill");
const loadStatus = document.getElementById("loadStatus");
loader.load(
  "assets/models/velaris_supercar.glb",
  (gltf) => {
    car.add(gltf.scene);
    collectModel(gltf.scene);
    buildExtras();
    window.__velaris_ready = true;
    document.title = "VELARIS READY";
    playIntro();
    applyQueryState();
  },
  (ev) => {
    const frac = ev.total ? ev.loaded / ev.total : Math.min(0.95, ev.loaded / 15400000);
    loadFill.style.width = (4 + frac * 92).toFixed(1) + "%";
    if (frac > 0.55) loadStatus.textContent = "Polishing surfaces…";
    if (frac > 0.92) loadStatus.textContent = "Lighting the podium…";
  },
  (err) => {
    diagErr("GLB load failed: " + err);
    loadStatus.textContent = "Failed to load model";
  }
);

function collectModel(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      if (m && m.name && !mats[m.name]) mats[m.name] = m;
    }
  });

  const paint = mats["Velaris_LiquidSilver"];
  if (paint) {
    paint.clearcoat = 1.0;
    paint.clearcoatRoughness = 0.055;
    paint.envMapIntensity = 0.9;
  }
  const glass = mats["Velaris_Glass"];
  if (glass) {
    glass.thickness = 0.02;
    glass.envMapIntensity = 1.0;
    glass.color.set(0xccd4d8);
    glass.roughness = 0.03;
    glass.transmission = 0.95;
    glass.ior = 1.46;
  }
  const lampLens = mats["Velaris_LampLens"];
  if (lampLens) { lampLens.thickness = 0.01; lampLens.envMapIntensity = 1.2; }
  if (mats["Velaris_LED_White"]) mats["Velaris_LED_White"].emissiveIntensity = 0.35;
  if (mats["Velaris_LED_Red"]) mats["Velaris_LED_Red"].emissiveIntensity = 2.6;
  if (mats["Velaris_LED_Soft"]) mats["Velaris_LED_Soft"].emissiveIntensity = 0.9;

  for (const name of Object.keys(mats)) {
    const m = mats[name];
    if (m.envMapIntensity === undefined) continue;
    if (m.envMapIntensity === 1 && name !== "Velaris_LiquidSilver") m.envMapIntensity = 0.5;
  }

  root.traverse((o) => {
    if (!o.isMesh) return;
    if (/_Rim_|_Spokes_/.test(o.name)) wheelNodes.push(o);
    if (o.name.endsWith("_SillLED")) {
      const m = o.material.clone();
      m.emissiveIntensity = 0.0;
      o.material = m;
      sillLedMats.push(m);
    }
    if (o.name === "DashScreen") {
      const g = o.geometry;
      const p = g.attributes.position;
      if (!g.attributes.uv) {
        const uv = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) {
          uv[i * 2] = p.getY(i) / 0.44 + 0.5;
          uv[i * 2 + 1] = p.getZ(i) / 0.15 + 0.5;
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      }
      dashScreenMat = o.material;
    }
  });

  for (const key of ["Door_L", "Door_R", "Hatch", "FrunkLid"]) {
    const node = root.getObjectByName(key);
    if (node) {
      const hinge = root.getObjectByName("Hinge_" + key);
      if (hinge) {
        const map = { Door_L: "doorL", Door_R: "doorR", Hatch: "hatch", FrunkLid: "frunk" };
        hingeDefs[map[key]] = { node: hinge };
      }
      const isDoor = key.startsWith("Door");
      const label = key === "Door_L" ? "Driver door" : key === "Door_R" ? "Passenger door"
        : key === "Hatch" ? "Rear hatch" : "Front trunk";
      interactive.push({ node, kind: key === "Door_L" ? "doorL" : key === "Door_R" ? "doorR"
        : key === "Hatch" ? "hatch" : "frunk", label });
    }
  }

  const hlL = root.getObjectByName("HeadlightLED_L");
  const hlR = root.getObjectByName("HeadlightLED_R");
  for (const hl of [hlL, hlR]) {
    if (!hl) continue;
    hl.geometry.computeBoundingBox();
    const p = hl.geometry.boundingBox.getCenter(new THREE.Vector3());
    hl.localToWorld(p);
    const spot = new THREE.SpotLight(0xfff3e2, 0, 70, 0.5, 0.6, 1.35);
    spot.position.copy(p);
    spot.target.position.copy(p.clone().add(new THREE.Vector3(5.5, -1.9, 0)));
    scene.add(spot, spot.target);
    spot.shadow.mapSize.set(512, 512);
    headlightSpots.push(spot);
  }

  const leather = mats["Velaris_Leather"];
  const suede = mats["Velaris_Suede"];
  if (leather) {
    leather.userData = { color: leather.color.clone() };
    leather.roughness = 0.52;
    leather.sheen = 0.35;
    leather.sheenColor = new THREE.Color(0x2a2a2c);
  }
  if (suede) {
    suede.userData = { color: suede.color.clone() };
    suede.roughness = 0.8;
  }
  const dc = mats["Velaris_DarkChrome"];
  const chrome = mats["Velaris_Chrome"];
  if (dc) dc.userData = { color: dc.color.clone(), roughness: dc.roughness };
  if (chrome) chrome.userData = { color: chrome.color.clone(), roughness: chrome.roughness };

  if (dashScreenMat) {
    dashScreenMat.map = screenUI.texture;
    dashScreenMat.emissiveMap = screenUI.texture;
    dashScreenMat.emissive = new THREE.Color(0xffffff);
    dashScreenMat.emissiveIntensity = 1.6;
    dashScreenMat.roughness = 0.14;
  }

  applyWheelStyle(0);
  applyPaint(0);
  applyCaliper(0);

  for (const tag of ["L", "R"]) {
    const l = new THREE.PointLight(0xffd9ae, 0, 3.0, 2);
    l.position.set(0.22, 0.82, tag === "L" ? -0.31 : 0.31);
    scene.add(l);
    ambientLights.push(l);
  }
}

function buildExtras() {
  const portNode = car.getObjectByName("ChargePortRing") || car.getObjectByName("ChargePort");
  if (!portNode) return;
  const pos = new THREE.Vector3();
  portNode.getWorldPosition(pos);
  const dir = new THREE.Vector3(0, 0.18, Math.sign(pos.z) || 1).normalize();

  const ringGeo = new THREE.TorusGeometry(0.062, 0.0065, 10, 44);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0a2b1e, transparent: true, opacity: 1 });
  const glow = new THREE.Mesh(ringGeo, ringMat2);
  glow.position.copy(pos).addScaledVector(dir, 0.035);
  glow.lookAt(pos.clone().addScaledVector(dir, 1));
  scene.add(glow);

  const light = new THREE.PointLight(0xcdf2dc, 0, 3.2, 2);
  light.position.copy(pos).addScaledVector(dir, 0.24);
  scene.add(light);

  const p0 = pos.clone().addScaledVector(dir, 0.10);
  const p1 = pos.clone().addScaledVector(dir, 0.30).add(new THREE.Vector3(-0.05, -0.32, 0));
  const p2 = pos.clone().add(new THREE.Vector3(-0.55, -0.38, -0.22));
  const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
  const dots = [];
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xdcf7e7, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), dotMat.clone());
    d.visible = false;
    scene.add(d);
    dots.push(d);
  }
  chargeRig = { pos, dir, glow, ringMat: ringMat2, light, curve, dots, t0: 0 };
}

/* ---------------------------------------------------------------- helpers */
const clock = new THREE.Clock();
const anims = new Map();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function anim(id, dur, fn, done) {
  if (dur <= 0) { fn(1); done && done(); return; }
  anims.set(id, { t0: clock.getElapsedTime(), dur, fn, done });
}
function tickAnims() {
  const now = clock.getElapsedTime();
  for (const [id, a] of Array.from(anims)) {
    const t = Math.min(1, (now - a.t0) / a.dur);
    a.fn(t);
    if (t >= 1) { anims.delete(id); if (a.done) a.done(); }
  }
}
function cancelAnim(id) { anims.delete(id); }

function flyTo(pos, target, dur = 1.7, done) {
  cancelAnim("cam");
  const p0 = camera.position.clone();
  const t0 = controls.target.clone();
  const p1 = new THREE.Vector3().fromArray(pos);
  const t1 = new THREE.Vector3().fromArray(target);
  controls.enabled = false;
  anim("cam", dur, (t) => {
    const e = easeInOut(t);
    camera.position.lerpVectors(p0, p1, e);
    controls.target.lerpVectors(t0, t1, e);
    camera.lookAt(controls.target);
  }, () => {
    controls.enabled = true;
    controls.update();
    done && done();
  });
}
function setCameraInstant(name) {
  cancelAnim("cam");
  const c = CAMERAS[name];
  if (!c) return;
  camera.position.fromArray(c.pos);
  controls.target.fromArray(c.target);
  controls.enabled = true;
  controls.update();
}

/* ------------------------------------------------------------- selections */
function applyPaint(i, instant) {
  state.paint = i;
  const p = PAINTS[i];
  const m = mats["Velaris_LiquidSilver"];
  if (m) {
    m.color.set(p.hex);
    m.metalness = p.metalness;
    m.roughness = p.roughness;
    m.clearcoat = 1.0;
    m.clearcoatRoughness = 0.055;
    m.envMapIntensity = 1.0;
  }
  document.querySelectorAll("#paintGrid .swatch").forEach((el, k) => el.classList.toggle("is-active", k === i));
  const nameEl = document.getElementById("paintName");
  if (nameEl) nameEl.textContent = p.name;
  updateSummary();
}
function applyWheelStyle(i) {
  state.wheel = i;
  for (const n of wheelNodes) {
    const isST2 = n.name.includes("_ST2");
    const isST3 = n.name.includes("_ST3");
    const tag = isST2 ? 1 : isST3 ? 2 : 0;
    n.visible = tag === i;
  }
  document.querySelectorAll("#wheelList .row").forEach((el, k) => el.classList.toggle("is-active", k === i));
  updateSummary();
}
function applyTrim(i) {
  state.trim = i;
  const t = TRIMS[i];
  const leather = mats["Velaris_Leather"];
  const suede = mats["Velaris_Suede"];
  if (leather) leather.color.set(t.leather);
  if (suede) suede.color.set(t.suede);
  document.querySelectorAll("#trimList .row").forEach((el, k) => el.classList.toggle("is-active", k === i));
  updateSummary();
}
function applyCaliper(i) {
  state.caliper = i;
  const m = mats["Velaris_Caliper"];
  if (m) m.color.set(CALIPERS[i].hex);
  document.querySelectorAll("#caliperRow .chip").forEach((el, k) => el.classList.toggle("is-active", k === i));
  updateSummary();
}
function setEquip(id, on) {
  state.equip[id] = on;
  const el = document.querySelector('.toggle[data-equip="' + id + '"]');
  if (el) el.classList.toggle("is-on", on);
  if (id === "sills") {
    for (const m of sillLedMats) m.emissiveIntensity = on ? 3.4 : 0.0;
  } else if (id === "ambient") {
    anim("ambient", 0.8, (t) => {
      const v = 14.0 * easeInOut(t) * (on ? 1 : -1);
      for (const l of ambientLights) l.intensity = Math.max(0, l.intensity + v * (1 / 60));
    });
    for (const l of ambientLights) if (!on) l.intensity = 0;
  } else if (id === "blackTrim") {
    const dc = mats["Velaris_DarkChrome"];
    const cr = mats["Velaris_Chrome"];
    if (dc) {
      dc.color.set(on ? 0x0a0b0c : dc.userData.color.getHex());
      dc.roughness = on ? 0.13 : dc.userData.roughness;
    }
    if (cr) {
      cr.color.set(on ? 0x17181b : cr.userData.color.getHex());
      cr.roughness = on ? 0.18 : cr.userData.roughness;
    }
  } else if (id === "privacy") {
    const g = mats["Velaris_Glass"];
    if (g) {
      const base = g.userData.baseColor || (g.userData.baseColor = g.color.clone());
      const baseT = g.userData.baseTrans ?? (g.userData.baseTrans = g.transmission);
      g.color.set(on ? new THREE.Color(0x2c3238) : base);
      g.transmission = on ? 0.35 : baseT;
    }
  }
  updateSummary();
}

/* ---------------------------------------------------------------- vehicle */
function setHinge(key, open, dur = 1.25) {
  const from = hingeState[key];
  const to = open ? 1 : 0;
  if (Math.abs(from - to) < 0.001) return;
  anim("hinge_" + key, dur, (t) => {
    hingeState[key] = from + (to - from) * easeInOut(t);
    applyHinges();
  });
}
function setDoors(open, dur) {
  state.doors = open;
  setHinge("doorL", open, dur);
  setHinge("doorR", open, dur);
  syncButtons();
}
function setHatch(open, dur) { state.hatch = open; setHinge("hatch", open, dur); syncButtons(); }
function setFrunk(open, dur) { state.frunk = open; setHinge("frunk", open, dur); syncButtons(); }

function setLights(on, fly = true) {
  state.lights = on;
  const led = mats["Velaris_LED_White"];
  const ledRed = mats["Velaris_LED_Red"];
  const lens = mats["Velaris_LampLens"];
  if (lens && !lens.userData.lit) {
    lens.userData.lit = true;
    lens.emissive = new THREE.Color(0xfff2df);
    lens.emissiveIntensity = 0;
  }
  const from = led ? led.emissiveIntensity : 0;
  const to = on ? 16.0 : 0.35;
  anim("led", 0.9, (t) => {
    const e = easeOut(t);
    if (led) led.emissiveIntensity = from + (to - from) * e;
    if (ledRed) ledRed.emissiveIntensity = 2.6 + (on ? 2.6 : 0) * e;
    if (lens) lens.emissiveIntensity = (on ? 2.4 : 0) * (on ? e : 1 - e);
  });
  const spotFrom = headlightSpots.length ? headlightSpots[0].intensity : 0;
  const spotTo = on ? 1600 : 0;
  anim("hlspot", 1.1, (t) => {
    for (const s of headlightSpots) s.intensity = spotFrom + (spotTo - spotFrom) * easeOut(t);
  });
  if (on && fly && !state.interior) flyTo(CAMERAS.front.pos, CAMERAS.front.target, 2.0, () => { state.camera = "front"; syncCameraButtons(); });
  syncButtons();
}

function setCharging(on) {
  state.charging = on;
  const hud = document.getElementById("hud");
  hud.classList.toggle("show", on);
  hud.hidden = !on;
  if (chargeRig) chargeRig.t0 = clock.getElapsedTime();
  anim("chgl", 0.8, (t) => {
    const v = (on ? 3.4 : 0) * easeInOut(t) + (on ? 0 : 3.4 * (1 - easeInOut(t))) * 0;
    if (chargeRig) {
      chargeRig.light.intensity = on ? 9 * easeInOut(t) : 9 * (1 - easeInOut(t));
      chargeRig.ringMat.color.setHex(on ? 0x9fe8c0 : 0x0a2b1e);
      for (const d of chargeRig.dots) d.visible = on;
    }
  });
  if (on && !state.interior) {
    const p = chargeRig ? chargeRig.pos : new THREE.Vector3(-1.1, 0.72, 0.9);
    const dir = new THREE.Vector3(0, 0.18, Math.sign(p.z) || 1).normalize();
    const camPos = p.clone().addScaledVector(dir, 2.1).add(new THREE.Vector3(-0.55, 0.72, 0));
    const tgt = p.clone().add(new THREE.Vector3(-0.05, 0.08, 0));
    controls.minDistance = 1.5;
    flyTo(camPos.toArray(), tgt.toArray(), 2.0);
  } else if (!on) {
    controls.minDistance = 4.4;
  }
  syncButtons();
}

function updateCharge() {
  if (!chargeRig) return;
  const el = clock.getElapsedTime() - chargeRig.t0;
  const pct = Math.min(100, 18 + el * 5.4);
  const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3.2);
  chargeRig.ringMat.color.setRGB(0.55 + 0.25 * pulse, 0.92, 0.72 + 0.15 * pulse);
  chargeRig.glow.scale.setScalar(1 + 0.07 * pulse);
  const cycle = (clock.getElapsedTime() * 0.35) % 1;
  chargeRig.dots.forEach((d, i) => {
    const t = (cycle + i / chargeRig.dots.length) % 1;
    const pt = chargeRig.curve.getPointAt(t);
    d.position.copy(pt);
    d.material.opacity = 0.9 * (1 - Math.pow(Math.abs(t - 0.5) * 2, 2));
  });
  const pctEl = document.getElementById("hudPct");
  const kmEl = document.getElementById("hudKm");
  const kwEl = document.getElementById("hudKw");
  const fillEl = document.getElementById("hudFill");
  if (pctEl) pctEl.textContent = String(Math.round(pct));
  if (kmEl) kmEl.textContent = Math.round(612 * pct / 100) + " km";
  if (kwEl) kwEl.textContent = (pct < 80 ? 150 : 65) + " kW";
  if (fillEl) fillEl.style.width = pct.toFixed(1) + "%";
  screenUI.charge = pct / 100;
  screenUI.range = 612 * pct / 100;
  screenUI.draw(clock.getElapsedTime(), "charge");
}

/* -------------------------------------------------------------- interior */
let look = { yaw: -Math.PI / 2, pitch: -0.02 };
let lookBase = { yaw: -Math.PI / 2, pitch: -0.02 };
let dragging = false;
let dragStart = { x: 0, y: 0, yaw: 0, pitch: 0 };

function enterInterior() {
  if (state.interior) return;
  setDoors(false, 0.8);
  state.interior = true;
  cancelAnim("cam");
  controls.enabled = false;
  const eye = new THREE.Vector3().fromArray(INTERIOR_EYE);
  const p0 = camera.position.clone();
  const fromQ = camera.quaternion.clone();
  camera.getWorldPosition(p0);
  camera.fov = 70;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(eye.x + 1.2, eye.y - 0.20, eye.z + 0.05);
  const q1 = new THREE.Quaternion();
  const tmp = new THREE.PerspectiveCamera();
  tmp.position.copy(eye);
  tmp.lookAt(target);
  q1.copy(tmp.quaternion);
  anim("interior", 1.6, (t) => {
    const e = easeInOut(t);
    camera.position.lerpVectors(p0, eye, e);
    camera.quaternion.slerpQuaternions(fromQ, q1, e);
  });
  look = { yaw: -Math.PI / 2, pitch: -0.06 };
  document.getElementById("exitInterior").hidden = false;
  document.getElementById("panel").classList.add("interior-mode");
  syncButtons();
}
function exitInterior() {
  state.interior = false;
  document.getElementById("exitInterior").hidden = true;
  document.getElementById("panel").classList.remove("interior-mode");
  controls.enabled = false;
  camera.fov = 38;
  camera.updateProjectionMatrix();
  const c = CAMERAS[state.camera] || CAMERAS.hero;
  flyTo(c.pos, c.target, 1.6);
  syncButtons();
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!state.interior) return;
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch };
});
window.addEventListener("pointerup", () => { dragging = false; });
window.addEventListener("pointermove", (e) => {
  if (state.interior && dragging) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    look.yaw = dragStart.yaw - dx * 0.0021;
    look.pitch = Math.max(-0.55, Math.min(0.45, dragStart.pitch - dy * 0.0016));
    const e2 = new THREE.Euler(look.pitch, look.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(e2);
    return;
  }
  updateHover(e);
});

/* ----------------------------------------------------------------- hover */
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const tip = document.getElementById("hoverTip");
let hovered = null;

function updateHover(e) {
  if (state.interior || !interactive.length) return;
  pointerNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(interactive.map((i) => i.node), false);
  if (hits.length) {
    const hit = interactive.find((i) => i.node === hits[0].object);
    if (hit) {
      hovered = hit;
      renderer.domElement.style.cursor = "pointer";
      const open = state[hit.kind === "doorL" ? "doors" : hit.kind === "doorR" ? "doors" : hit.kind];
      tip.hidden = false;
      tip.textContent = hit.label + (open ? " — click to close" : " — click to open");
      tip.style.left = e.clientX + "px";
      tip.style.top = e.clientY + "px";
      return;
    }
  }
  hovered = null;
  renderer.domElement.style.cursor = "";
  tip.hidden = true;
}
renderer.domElement.addEventListener("click", () => {
  if (!hovered || state.interior) return;
  const k = hovered.kind;
  if (k === "doorL" || k === "doorR") setDoors(!state.doors);
  else if (k === "hatch") setHatch(!state.hatch);
  else if (k === "frunk") setFrunk(!state.frunk);
});

/* -------------------------------------------------------------------- UI */
function buildUI() {
  const paintGrid = document.getElementById("paintGrid");
  PAINTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.title = p.name;
    const c = new THREE.Color(p.hex);
    b.style.background = "radial-gradient(circle at 32% 28%, " + "#" + c.clone().offsetHSL(0, 0, 0.22).getHexString()
      + ", #" + c.getHexString() + " 62%, #" + c.clone().offsetHSL(0, 0, -0.18).getHexString() + ")";
    b.addEventListener("click", () => applyPaint(i));
    paintGrid.appendChild(b);
  });

  const wheelList = document.getElementById("wheelList");
  WHEELS.forEach((w, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "row";
    b.innerHTML = '<span class="r-icon">' + (i + 1) + '</span><span><span class="r-name">' + w.name +
      '</span><div class="r-desc">' + w.desc + '</div></span>' +
      '<span class="r-right">' + (w.price ? "€ " + w.price.toLocaleString("en-US") : "Standard") + "</span>";
    b.addEventListener("click", () => applyWheelStyle(i));
    wheelList.appendChild(b);
  });

  const calRow = document.getElementById("caliperRow");
  CALIPERS.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = '<span class="cdot" style="background:#' + new THREE.Color(c.hex).getHexString() + '"></span>' + c.name;
    b.addEventListener("click", () => applyCaliper(i));
    calRow.appendChild(b);
  });

  const trimList = document.getElementById("trimList");
  TRIMS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "row";
    const l = new THREE.Color(t.leather).getHexString();
    const s = new THREE.Color(t.suede).getHexString();
    b.innerHTML = '<span class="r-icon" style="background:linear-gradient(135deg,#' + l + ' 50%,#' + s + ' 50%)"></span>' +
      '<span><span class="r-name">' + t.name + '</span><div class="r-desc">Nappa leather · Dinamica headliner</div></span>' +
      '<span class="r-right">' + (t.price ? "€ " + t.price.toLocaleString("en-US") : "Standard") + "</span>";
    b.addEventListener("click", () => applyTrim(i));
    trimList.appendChild(b);
  });

  const equipList = document.getElementById("equipList");
  EQUIP.forEach((e) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toggle";
    b.dataset.equip = e.id;
    b.innerHTML = '<span><span class="t-name">' + e.name + '</span><div class="t-desc">' + e.desc +
      '</div></span><span class="switch"></span>';
    b.addEventListener("click", () => setEquip(e.id, !state.equip[e.id]));
    equipList.appendChild(b);
  });

  const specs = document.getElementById("specsExtra");
  SPECS.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) el.textContent = s.value;
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("is-active", p.dataset.pane === tab.dataset.tab));
    });
  });

  document.querySelectorAll("[data-cam]").forEach((b) => {
    b.addEventListener("click", () => {
      if (state.interior) exitInterior();
      state.camera = b.dataset.cam;
      const c = CAMERAS[state.camera];
      flyTo(c.pos, c.target, 1.9);
      setTimeout(() => {}, 0);
      syncCameraButtons();
    });
  });
  document.getElementById("btnDoors").addEventListener("click", () => setDoors(!state.doors));
  document.getElementById("btnHatch").addEventListener("click", () => setHatch(!state.hatch));
  document.getElementById("btnFrunk").addEventListener("click", () => setFrunk(!state.frunk));
  document.getElementById("btnLights").addEventListener("click", () => setLights(!state.lights));
  document.getElementById("btnCharge").addEventListener("click", () => setCharging(!state.charging));
  document.getElementById("btnInterior").addEventListener("click", () => (state.interior ? exitInterior() : enterInterior()));
  document.getElementById("enterInterior").addEventListener("click", enterInterior);
  document.getElementById("exitInterior").addEventListener("click", exitInterior);

  const audio = new AmbientAudio();
  const quick = document.getElementById("audioQuick");
  const quickLabel = document.getElementById("audioQuickLabel");
  const toggleBtn = document.getElementById("audioToggle");
  const stopBtn = document.getElementById("audioStop");
  async function audioOn(on) {
    if (on) {
      const ok = await audio.start();
      state.audio = !!ok;
    } else {
      audio.stop();
      state.audio = false;
    }
    quick.setAttribute("aria-pressed", String(state.audio));
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", String(state.audio));
    quickLabel.textContent = state.audio ? "Audio On" : "Audio Off";
    if (toggleBtn) toggleBtn.textContent = state.audio ? "Mute Ambient Audio" : "Enable Ambient Audio";
  }
  quick.addEventListener("click", () => audioOn(!state.audio));
  toggleBtn.addEventListener("click", () => audioOn(!state.audio));
  stopBtn.addEventListener("click", () => audioOn(false));
  window.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") audioOn(!state.audio);
  });
}

function syncCameraButtons() {
  document.querySelectorAll("[data-cam]").forEach((b) => b.classList.toggle("is-active", b.dataset.cam === state.camera));
}
function syncButtons() {
  const map = { btnDoors: state.doors, btnHatch: state.hatch, btnFrunk: state.frunk, btnLights: state.lights, btnCharge: state.charging };
  for (const [id, on] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("is-active", !!on);
  }
  const bi = document.getElementById("btnInterior");
  if (bi) bi.classList.toggle("is-active", state.interior);
  syncCameraButtons();
}

function updateSummary() {
  const dl = document.getElementById("summaryList");
  if (!dl) return;
  const rows = [
    ["Paint", PAINTS[state.paint].name],
    ["Wheels", WHEELS[state.wheel].name],
    ["Upholstery", TRIMS[state.trim].name],
    ["Calipers", CALIPERS[state.caliper].name],
  ];
  const eq = EQUIP.filter((e) => state.equip[e.id]).map((e) => e.name);
  if (eq.length) rows.push(["Equipment", eq.join(", ")]);
  dl.innerHTML = rows.map((r) => '<div class="srow"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("");
  let total = BASE_PRICE + PAINTS[state.paint].price + WHEELS[state.wheel].price + TRIMS[state.trim].price;
  for (const e of EQUIP) if (state.equip[e.id]) total += e.price;
  const el = document.getElementById("totalPrice");
  if (el) el.textContent = "€ " + total.toLocaleString("en-US");
}

/* ----------------------------------------------------------------- intro */
function playIntro() {
  const intro = document.getElementById("intro");
  const fade = document.getElementById("fade");
  const reveal = (id, delay) => setTimeout(() => document.getElementById(id).classList.add("reveal-in"), delay);
  const skip = (!q.has("motion") && reduceMotion) || q.get("intro") === "0" || q.has("state");

  buildUI();
  applyTrim(0);
  updateSummary();

  if (skip) {
    intro.classList.add("gone");
    fade.classList.add("gone");
    for (const id of ["brandbar", "toolbar", "panel"]) document.getElementById(id).classList.add("reveal-in");
    ringMat.emissiveIntensity = 2.2;
    podiumSpot.intensity = 500;
    setCameraInstant(state.camera);
    return;
  }

  camera.position.set(-9.6, 1.55, 3.6);
  controls.target.set(0, 0.6, 0);
  camera.lookAt(controls.target);
  setTimeout(() => {
    intro.classList.add("gone");
    fade.classList.add("gone");
  }, 320);
  flyTo(CAMERAS.hero.pos, CAMERAS.hero.target, 5.2);
  anim("pod", 4.2, (t) => {
    const e = easeInOut(t);
    ringMat.emissiveIntensity = 2.2 * e;
    podiumSpot.intensity = 500 * e;
  });
  reveal("brandbar", 1000);
  reveal("toolbar", 1900);
  reveal("panel", 2600);
  document.getElementById("skipIntro").addEventListener("click", () => {
    cancelAnim("cam");
    setCameraInstant("hero");
    ringMat.emissiveIntensity = 2.2;
    podiumSpot.intensity = 500;
    fade.classList.add("gone");
    intro.classList.add("gone");
    reveal("brandbar", 0);
    reveal("toolbar", 0);
    reveal("panel", 0);
  });
}

/* ------------------------------------------------------- query test hooks */
function applyQueryState() {
  if (q.has("paint")) applyPaint(Math.max(0, Math.min(PAINTS.length - 1, +q.get("paint"))));
  if (q.has("wheel")) applyWheelStyle(Math.max(0, Math.min(WHEELS.length - 1, +q.get("wheel"))));
  if (q.has("trim")) applyTrim(Math.max(0, Math.min(TRIMS.length - 1, +q.get("trim"))));
  if (q.has("caliper")) applyCaliper(Math.max(0, Math.min(CALIPERS.length - 1, +q.get("caliper"))));
  for (const e of EQUIP) if (q.get(e.id) === "1") setEquip(e.id, true);
  const st = (q.get("state") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const instant = q.has("state");
  if (st.includes("doors")) setDoors(true, instant ? 0 : 1.2);
  if (st.includes("hatch")) setHatch(true, instant ? 0 : 1.2);
  if (st.includes("frunk")) setFrunk(true, instant ? 0 : 1.2);
  if (st.includes("lights")) setLights(true, false);
  if (st.includes("charge")) setCharging(true);
  if (st.includes("interior")) enterInterior();
  if (q.get("cam") && CAMERAS[q.get("cam")]) {
    state.camera = q.get("cam");
    setCameraInstant(state.camera);
  }
  syncButtons();
}

/* ------------------------------------------------------------------ loop */
function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  if (!state.interior) camera.fov = aspect < 0.95 ? 62 : aspect < 1.5 ? 46 : 38;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);
onResize();

function frame() {
  requestAnimationFrame(frame);
  tickAnims();
  if (state.charging) updateCharge();
  else if (state.interior) screenUI.draw(clock.getElapsedTime(), "interior");
  if (!state.interior && controls.enabled) controls.update();
  renderer.render(scene, camera);
}
frame();

function debugScan(minY) {
  const out = [];
  car.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.max.y > minY) {
      out.push({
        name: o.name, maxY: +box.max.y.toFixed(3), minY: +box.min.y.toFixed(3),
        x: [+box.min.x.toFixed(2), +box.max.x.toFixed(2)],
        z: [+box.min.z.toFixed(2), +box.max.z.toFixed(2)],
        mat: o.material ? o.material.name : null,
      });
    }
  });
  return out.sort((a, b) => b.maxY - a.maxY).slice(0, 14);
}

function debugNodes(names) {
  const out = {};
  for (const n of names) {
    const o = car.getObjectByName(n);
    if (!o) { out[n] = "missing"; continue; }
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const mats = [];
    o.traverse((m) => { if (m.isMesh && m.material) mats.push(m.material.name || "?"); });
    out[n] = {
      visible: o.visible,
      parent: o.parent ? o.parent.name : null,
      center: center.toArray().map((v) => +v.toFixed(3)),
      size: size.toArray().map((v) => +v.toFixed(3)),
      mats: [...new Set(mats)],
    };
  }
  return out;
}

window.__velaris = {
  state,
  setDoors, setHatch, setFrunk, setLights, setCharging, enterInterior, exitInterior,
  applyPaint, applyWheelStyle, applyTrim, applyCaliper, setEquip,
  flyTo, setCameraInstant, errors, scene, car, camera, controls, mats, debugNodes, debugScan,
};
