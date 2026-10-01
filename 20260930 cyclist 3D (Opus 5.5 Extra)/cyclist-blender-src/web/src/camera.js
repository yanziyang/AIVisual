// Camera director for the ride: broadcast-style shots relative to the rider, auto-cut.
import * as THREE from 'three';
import { damp, clamp } from './noise.js';

export const SHOTS = {
  chase: { label: 'Chase' },
  side: { label: 'Side track' },
  front: { label: 'Front ¾' },
  low: { label: 'Low wheel' },
  drone: { label: 'Drone' },
  orbit: { label: 'Orbit' },
  drive: { label: 'Drivetrain' },
  roadside: { label: 'Roadside' },
};
const AUTO_ORDER = ['chase', 'side', 'front', 'roadside', 'low', 'drone', 'orbit', 'drive', 'side', 'front'];

export class Director {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'auto';         // auto | <shot> | free
    this.shot = 'chase';
    this.t = 0;
    this.shotTime = 0;
    this.autoIdx = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 35;
    this.cut = true;
    this.roadsideAnchor = null;
  }

  setMode(m) {
    this.mode = m;
    if (m !== 'auto' && m !== 'free') this.setShot(m);
    if (m === 'auto') this.setShot(AUTO_ORDER[this.autoIdx % AUTO_ORDER.length]);
  }

  setShot(s) {
    this.shot = s;
    this.shotTime = 0;
    this.cut = true;
    this.roadsideAnchor = null;
    this.orbitBase = Math.random() * Math.PI * 2;
  }

  /**
   * f: rider frame {pos, fwd (unit, with slope), right, up}; world: for ground height + road lookups.
   */
  update(dt, f, world, xAbs) {
    this.t += dt;
    this.shotTime += dt;
    if (this.mode === 'auto') {
      const dur = this.shot === 'roadside' ? 9 : this.shot === 'drive' || this.shot === 'low' ? 6 : 8;
      if (this.shotTime > dur) {
        this.autoIdx++;
        this.setShot(AUTO_ORDER[this.autoIdx % AUTO_ORDER.length]);
      }
    }
    const P = f.pos, F = f.fwd, R = f.right;
    const U = new THREE.Vector3(0, 1, 0);
    const hf = new THREE.Vector3(F.x, 0, F.z).normalize();
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    let fov = 35, follow = 6;
    const k = this.shotTime;
    switch (this.shot) {
      case 'chase':
        pos.copy(P).addScaledVector(hf, -5.6).addScaledVector(U, 1.85).addScaledVector(R, 0.6 * Math.sin(this.t * 0.2));
        look.copy(P).addScaledVector(hf, 2.5).addScaledVector(U, 0.95);
        fov = 38; follow = 5;
        break;
      case 'side':
        pos.copy(P).addScaledVector(R, 4.3).addScaledVector(U, 1.05).addScaledVector(hf, 0.5 - k * 0.06);
        look.copy(P).addScaledVector(U, 0.85).addScaledVector(hf, 0.15);
        fov = 34; follow = 8;
        break;
      case 'front':
        pos.copy(P).addScaledVector(hf, 6.8 - k * 0.12).addScaledVector(R, 2.4).addScaledVector(U, 1.45);
        look.copy(P).addScaledVector(U, 1.0);
        fov = 30; follow = 6;
        break;
      case 'low':
        pos.copy(P).addScaledVector(hf, 2.3).addScaledVector(R, 1.55).addScaledVector(U, 0.28);
        look.copy(P).addScaledVector(hf, -0.3).addScaledVector(U, 0.62);
        fov = 52; follow = 10;
        break;
      case 'drone': {
        const a = this.orbitBase + k * 0.05;
        pos.copy(P).addScaledVector(hf, -4.6 * Math.cos(a)).addScaledVector(R, 4.6 * Math.sin(a) + 1.8).addScaledVector(U, 5.4);
        look.copy(P).addScaledVector(hf, 1.0).addScaledVector(U, 0.7);
        fov = 38; follow = 3;
        break;
      }
      case 'orbit': {
        const a = this.orbitBase + k * 0.32;
        pos.copy(P).addScaledVector(hf, 4.4 * Math.cos(a)).addScaledVector(R, 4.4 * Math.sin(a)).addScaledVector(U, 1.5);
        look.copy(P).addScaledVector(U, 0.9);
        fov = 36; follow = 9;
        break;
      }
      case 'drive':
        pos.copy(P).addScaledVector(R, 1.15).addScaledVector(U, 0.47).addScaledVector(hf, 0.28);
        look.copy(P).addScaledVector(U, 0.33).addScaledVector(hf, -0.10);
        fov = 40; follow = 14;
        break;
      case 'roadside': {
        if (!this.roadsideAnchor) {
          const ahead = world.frameAt(xAbs + 34);
          this.roadsideAnchor = ahead.pos.clone().addScaledVector(ahead.right, 5.5);
          this.roadsideAnchor.y = world.height(this.roadsideAnchor) + 1.25;
        }
        pos.copy(this.roadsideAnchor);
        look.copy(P).addScaledVector(U, 0.9);
        const d = pos.distanceTo(P);
        fov = clamp(1400 / Math.max(d, 4), 18, 48);
        follow = 30;
        if (this.mode === 'auto' && d > 26 && k > 3) this.shotTime = 1e9;     // passed by: cut
        break;
      }
      default:
        break;
    }
    // keep the camera above the ground
    if (world) {
      const g = world.height(pos) + 0.22;
      if (pos.y < g) pos.y = g;
    }
    if (this.cut) {
      this.pos.copy(pos);
      this.look.copy(look);
      this.fov = fov;
      this.cut = false;
    } else {
      this.pos.x = damp(this.pos.x, pos.x, follow, dt);
      this.pos.y = damp(this.pos.y, pos.y, follow, dt);
      this.pos.z = damp(this.pos.z, pos.z, follow, dt);
      this.look.x = damp(this.look.x, look.x, follow * 1.5, dt);
      this.look.y = damp(this.look.y, look.y, follow * 1.5, dt);
      this.look.z = damp(this.look.z, look.z, follow * 1.5, dt);
      this.fov = damp(this.fov, fov, 4, dt);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  shift(dx) {
    this.pos.x -= dx;
    this.look.x -= dx;
    if (this.roadsideAnchor) this.roadsideAnchor.x -= dx;
  }
}
