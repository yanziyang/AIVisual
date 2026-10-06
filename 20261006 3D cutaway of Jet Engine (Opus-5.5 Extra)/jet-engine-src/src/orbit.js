// Orbit camera with inertia, pinch/wheel zoom, pan, and eased fly-to shots.
import * as THREE from 'three';
import { clamp, easeInOut } from './util.js';

const shortestAngle = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Orbit {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.s = { yaw: -0.5, pitch: 0.24, dist: 10.5, tx: 3.0, ty: 0.0, tz: 0.0 };
    this.g = { ...this.s };
    this.anim = null;
    this.limits = { minDist: 0.55, maxDist: 50, minPitch: -1.35, maxPitch: 1.35 };
    this.idle = 0; this.auto = false;
    this.userActive = false;
    this.onUser = () => {};
    this.swayAmp = 0; this.swayT = 0;
    this._ptrs = new Map();
    this._bind();
    this.apply();
  }

  _bind() {
    const el = this.dom;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
      this.userActive = true; this.cancelAnim(); this.onUser();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this._ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this._ptrs.size === 1) {
        if (p.button === 2 || p.shift || e.shiftKey || e.ctrlKey) this.pan(dx, dy);
        else { this.g.yaw -= dx * 0.0052; this.g.pitch = clamp(this.g.pitch + dy * 0.0052, this.limits.minPitch, this.limits.maxPitch); }
      } else if (this._ptrs.size === 2) {
        const pts = [...this._ptrs.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this._pinch) this.zoomBy(this._pinch / Math.max(d, 1));
        this._pinch = d;
        this.pan(dx * 0.5, dy * 0.5);
      }
    });
    const up = (e) => { this._ptrs.delete(e.pointerId); this._pinch = 0; if (!this._ptrs.size) this.userActive = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.cancelAnim(); this.onUser();
      this.zoomBy(Math.exp(e.deltaY * 0.0012 * (e.ctrlKey ? 3 : 1)));
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  zoomBy(f) { this.g.dist = clamp(this.g.dist * f, this.limits.minDist, this.limits.maxDist); }

  pan(dx, dy) {
    const k = this.s.dist * 0.0011;
    const c = this.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    this.g.tx += (-right.x * dx + up.x * dy) * k; this.g.ty += (-right.y * dx + up.y * dy) * k; this.g.tz += (-right.z * dx + up.z * dy) * k;
    this.g.tx = clamp(this.g.tx, -1, 7.5); this.g.ty = clamp(this.g.ty, -2.5, 2.5); this.g.tz = clamp(this.g.tz, -2.5, 2.5);
  }

  cancelAnim() { this.anim = null; }

  flyTo(to, secs = 1.6) {
    const from = { ...this.s };
    const goal = { ...this.s, ...to };
    goal.yaw = from.yaw + shortestAngle(from.yaw, goal.yaw);
    this.anim = { t: 0, dur: secs, from, to: goal };
    this.g = { ...goal };
  }

  setNow(v) { Object.assign(this.s, v); Object.assign(this.g, v); this.anim = null; this.apply(); }

  update(dt) {
    this.swayT += dt * 0.42;
    if (this.anim) {
      const a = this.anim; a.t += dt;
      const k = easeInOut(a.t / a.dur);
      for (const key of Object.keys(this.s)) this.s[key] = a.from[key] + (a.to[key] - a.from[key]) * k;
      if (a.t >= a.dur) this.anim = null;
    } else {
      if (this.auto && !this.userActive) this.g.yaw += dt * 0.07;
      const f = 1 - Math.exp(-dt * 9);
      for (const key of Object.keys(this.s)) this.s[key] += (this.g[key] - this.s[key]) * f;
    }
    this.apply();
  }

  apply() {
    const { pitch, dist, tx, ty, tz } = this.s;
    const yaw = this.s.yaw + this.swayAmp * Math.sin(this.swayT);
    const cp = Math.cos(pitch);
    this.camera.position.set(tx + dist * Math.sin(yaw) * cp, ty + dist * Math.sin(pitch), tz + dist * Math.cos(yaw) * cp);
    this.camera.lookAt(tx, ty, tz);
  }
}
