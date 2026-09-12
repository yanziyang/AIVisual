import * as THREE from "three";

export class ScreenUI {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.last = -1;
    this.range = 612;
    this.charge = 0.42;
  }

  draw(t, mode) {
    if (t - this.last < 0.12 && mode !== "force") return false;
    this.last = t;
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.fillStyle = "#04060a";
    c.fillRect(0, 0, W, H);

    const glow = c.createRadialGradient(W * 0.22, H * 0.24, 40, W * 0.22, H * 0.24, W * 0.7);
    glow.addColorStop(0, "rgba(38,58,74,0.55)");
    glow.addColorStop(1, "rgba(4,6,10,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);

    c.strokeStyle = "rgba(255,255,255,0.05)";
    c.lineWidth = 2;
    const step = 64;
    const off = (t * 14) % step;
    for (let x = -step + off; x < W + step; x += step) {
      c.beginPath();
      c.moveTo(x, H * 0.62);
      c.lineTo(x - 90, H);
      c.stroke();
    }
    for (let y = H * 0.62; y < H; y += 42) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }

    c.fillStyle = "rgba(233,238,242,0.92)";
    c.font = "500 30px Inter, Segoe UI, sans-serif";
    c.fillText("VELARIS", 64, 86);
    c.fillStyle = "rgba(154,161,171,0.9)";
    c.font = "400 20px Inter, Segoe UI, sans-serif";
    c.fillText("AURION  GT  ·  DRIVE", 66, 122);

    c.fillStyle = "rgba(233,238,242,0.95)";
    c.font = "200 132px Inter, Segoe UI, sans-serif";
    c.fillText(this.range.toFixed(0), 60, 292);
    c.fillStyle = "rgba(154,161,171,0.95)";
    c.font = "400 26px Inter, Segoe UI, sans-serif";
    c.fillText("km  RANGE", 74 + c.measureText(this.range.toFixed(0)).width * 0.9, 288);

    const bx = 64;
    const by = 352;
    const bw = W - 128;
    const bh = 16;
    c.fillStyle = "rgba(255,255,255,0.10)";
    c.fillRect(bx, by, bw, bh);
    const fw = bw * this.charge;
    const grad = c.createLinearGradient(bx, 0, bx + fw, 0);
    grad.addColorStop(0, "rgba(130,200,160,0.85)");
    grad.addColorStop(1, "rgba(225,240,230,0.95)");
    c.fillStyle = grad;
    c.fillRect(bx, by, fw, bh);

    c.fillStyle = "rgba(154,161,171,0.85)";
    c.font = "400 20px Inter, Segoe UI, sans-serif";
    c.fillText("BATTERY  " + Math.round(this.charge * 100) + "%", bx, by + 52);
    c.textAlign = "right";
    c.fillText("108.0 kWh  ·  800 V", W - 64, by + 52);
    c.textAlign = "left";

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    c.strokeStyle = "rgba(200,230,210," + (0.25 + 0.35 * pulse).toFixed(3) + ")";
    c.lineWidth = 3;
    c.strokeRect(24, 24, W - 48, H - 48);

    this.texture.needsUpdate = true;
    return true;
  }
}
