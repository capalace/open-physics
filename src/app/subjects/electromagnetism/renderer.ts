import type { Vector2 } from "../../../physics/core";
import type { ElectromagnetismSandboxObject, ElectromagnetismSnapshot } from "./models";

const palette = {
  ink: "#22324a",
  muted: "#718096",
  grid: "#e7edf5",
  positive: "#e05c3f",
  negative: "#5b7cfa",
  field: "#25a77a",
  purple: "#a069dc",
  gold: "#f2b84b",
};

export class ElectromagnetismRenderer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(snapshot: ElectromagnetismSnapshot): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    this.resize();
    const width = this.canvas.width;
    const height = this.canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdff";
    context.fillRect(0, 0, width, height);
    this.grid(context, width, height);
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    if (snapshot.mode === "charge") this.chargeLab(context, snapshot, width, height);
    else if (snapshot.mode === "electric-field") this.fieldLab(context, snapshot, width, height);
    else if (snapshot.mode === "potential") this.potentialLab(context, snapshot, width, height);
    else if (snapshot.mode === "circuits") this.circuitLab(context, snapshot, width, height);
    else if (snapshot.mode === "capacitors") this.capacitorLab(context, snapshot, width, height);
    else if (snapshot.mode === "magnetic-field") this.magneticLab(context, snapshot, width, height);
    else if (snapshot.mode === "electromagnetic-force") this.forceLab(context, snapshot, width, height);
    else if (snapshot.mode === "induction") this.inductionLab(context, snapshot, width, height);
    else this.sandbox(context, snapshot, width, height);
    context.restore();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width || 960));
    const height = Math.max(420, Math.round(rect.height || 600));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  private grid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 24; y < height; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  private chargeLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const source = this.pixel({ x: 0.32, y: 0.5 }, w, h);
    const target = this.pixel(s.probe, w, h);
    this.dashedConnection(ctx, source, target);
    this.charge(ctx, source, 1, "고정 전하");
    this.charge(ctx, target, s.sign, "끌어서 거리 바꾸기");
    const direction = s.sign === 1 ? { x: target.x - source.x, y: target.y - source.y } : { x: source.x - target.x, y: source.y - target.y };
    this.arrow(ctx, target, direction, palette.positive, `${s.measurement.value.toFixed(3)} N`, 72);
  }

  private fieldLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const positive = this.pixel({ x: 0.35, y: 0.42 }, w, h);
    const negative = this.pixel({ x: 0.35, y: 0.66 }, w, h);
    this.charge(ctx, positive, 1, "+ 전하");
    this.charge(ctx, negative, -1, "− 전하");
    for (let row = 1; row <= 6; row += 1) {
      for (let column = 2; column <= 9; column += 1) {
        const point = { x: column / 11, y: row / 8 };
        const dx1 = point.x - 0.35; const dy1 = point.y - 0.42;
        const dx2 = point.x - 0.35; const dy2 = point.y - 0.66;
        const r1 = Math.max(0.03, Math.hypot(dx1, dy1)); const r2 = Math.max(0.03, Math.hypot(dx2, dy2));
        const vector = { x: dx1 / r1 ** 3 - dx2 / r2 ** 3, y: dy1 / r1 ** 3 - dy2 / r2 ** 3 };
        this.arrow(ctx, this.pixel(point, w, h), vector, "rgba(37,167,122,.55)", "", 18);
      }
    }
    const probe = this.pixel(s.probe, w, h);
    this.probe(ctx, probe, palette.field, "전기장 탐침");
    this.badge(ctx, probe.x + 22, probe.y - 34, `${this.compact(s.measurement.value)} N/C`);
  }

  private potentialLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const source = this.pixel({ x: 0.35, y: 0.5 }, w, h);
    for (const ratio of [0.12, 0.2, 0.3, 0.42]) {
      ctx.strokeStyle = `rgba(160,105,220,${0.75 - ratio})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(source.x, source.y, ratio * Math.min(w, h), 0, Math.PI * 2); ctx.stroke();
    }
    this.charge(ctx, source, s.sign, "전위 원천");
    const probe = this.pixel(s.probe, w, h);
    this.probe(ctx, probe, palette.purple, "전위 탐침");
    this.badge(ctx, probe.x + 22, probe.y - 34, `${this.compact(s.measurement.value)} V`);
  }

  private circuitLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const left = w * 0.2; const right = w * 0.8; const top = h * 0.3; const bottom = h * 0.7;
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, 30); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(left - 18, h * 0.43, 36, h * 0.14);
    ctx.strokeStyle = palette.positive; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(left - 12, h * 0.46); ctx.lineTo(left + 12, h * 0.46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left - 7, h * 0.54); ctx.lineTo(left + 7, h * 0.54); ctx.stroke();
    const bulbPower = s.secondaryMeasurement?.value ?? 0;
    ctx.shadowColor = palette.gold; ctx.shadowBlur = Math.min(42, bulbPower * 6);
    ctx.fillStyle = `rgba(242,184,75,${Math.min(1, 0.25 + bulbPower / 12)})`;
    ctx.beginPath(); ctx.arc(right, h * 0.5, 34, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.stroke();
    const handleX = w * (0.25 + s.probe.x * 0.5);
    ctx.strokeStyle = palette.purple; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(w * 0.27, top); ctx.lineTo(w * 0.73, top); ctx.stroke();
    this.probe(ctx, { x: handleX, y: top }, palette.purple, "저항 손잡이");
    this.flowDots(ctx, left, right, top, bottom, s.measurement.value);
    this.badge(ctx, w * 0.5, h * 0.82, `${s.measurement.value.toFixed(2)} A · ${bulbPower.toFixed(2)} W`);
  }

  private capacitorLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const center = w * 0.5;
    const gap = 46 + s.probe.x * 180;
    const left = center - gap / 2; const right = center + gap / 2;
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(left, h * 0.27); ctx.lineTo(left, h * 0.73); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, h * 0.27); ctx.lineTo(right, h * 0.73); ctx.stroke();
    for (let row = 0; row < 7; row += 1) {
      const y = h * (0.32 + row * 0.06);
      this.arrow(ctx, { x: left + 18, y }, { x: right - left - 36, y: 0 }, palette.field, "", right - left - 36);
    }
    for (let row = 0; row < 6; row += 1) {
      ctx.fillStyle = palette.positive; ctx.font = "700 22px system-ui"; ctx.fillText("+", left - 38, h * (0.34 + row * 0.07));
      ctx.fillStyle = palette.negative; ctx.fillText("−", right + 22, h * (0.34 + row * 0.07));
    }
    this.probe(ctx, { x: right, y: h * 0.78 }, palette.purple, "판 간격 끌기");
    this.badge(ctx, center, h * 0.86, `${s.measurement.value.toFixed(3)} nF · ${s.secondaryMeasurement?.value.toFixed(3)} nJ`);
  }

  private magneticLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const wire = this.pixel({ x: 0.44, y: 0.5 }, w, h);
    for (const radius of [55, 105, 160, 220]) {
      ctx.strokeStyle = "rgba(37,167,122,.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(wire.x, wire.y, radius, 0, Math.PI * 2); ctx.stroke();
      const angle = s.direction === 1 ? -0.2 : Math.PI + 0.2;
      const point = { x: wire.x + Math.cos(angle) * radius, y: wire.y + Math.sin(angle) * radius };
      this.arrow(ctx, point, { x: -Math.sin(angle) * s.direction, y: Math.cos(angle) * s.direction }, palette.field, "", 22);
    }
    ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.arc(wire.x, wire.y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 28px system-ui"; ctx.textAlign = "center"; ctx.fillText(s.direction === 1 ? "⊙" : "⊗", wire.x, wire.y + 9);
    const probe = this.pixel(s.probe, w, h);
    this.compass(ctx, probe, wire, s.direction);
    this.badge(ctx, probe.x, probe.y - 48, `${s.measurement.value.toFixed(2)} μT`);
  }

  private forceLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    ctx.fillStyle = "rgba(91,124,250,.12)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(91,124,250,.65)"; ctx.font = "20px system-ui"; ctx.textAlign = "center";
    for (let y = 36; y < h; y += 52) for (let x = 36; x < w; x += 52) ctx.fillText(s.direction === 1 ? "⊙" : "⊗", x, y);
    if (s.trail.length > 1) {
      ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath();
      s.trail.forEach((point, index) => { const p = this.pixel(point, w, h); if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
    }
    const particle = this.pixel(s.particle, w, h);
    this.charge(ctx, particle, s.sign, "움직이는 전하");
    this.arrow(ctx, particle, s.particleVelocity, palette.purple, "속도 · 끝을 끌어 방향 바꾸기", 90);
  }

  private inductionLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const coilX = w * 0.62;
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 7;
    for (let index = 0; index < 7; index += 1) {
      ctx.beginPath(); ctx.ellipse(coilX + index * 10, h * 0.5, 42, 115, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const magnet = this.pixel(s.probe, w, h);
    ctx.fillStyle = palette.positive; ctx.fillRect(magnet.x - 70, magnet.y - 28, 70, 56);
    ctx.fillStyle = palette.negative; ctx.fillRect(magnet.x, magnet.y - 28, 70, 56);
    ctx.fillStyle = "#fff"; ctx.font = "700 20px system-ui"; ctx.textAlign = "center"; ctx.fillText("N", magnet.x - 35, magnet.y + 7); ctx.fillText("S", magnet.x + 35, magnet.y + 7);
    this.probe(ctx, { x: magnet.x, y: magnet.y + 44 }, palette.purple, "자석을 빠르게 끌기");
    const voltage = s.measurement.value;
    this.arrow(ctx, { x: coilX + 120, y: h * 0.5 }, { x: voltage, y: 0 }, voltage >= 0 ? palette.positive : palette.negative, `${voltage.toFixed(2)} V`, Math.min(100, Math.abs(voltage) * 5));
    this.badge(ctx, w * 0.5, h * 0.84, `${s.coilTurns}회 감은 코일 · 속도 ${s.magnetSpeed.toFixed(2)} m/s`);
  }

  private sandbox(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    if (s.sandboxObjects.length === 0) {
      ctx.fillStyle = palette.muted; ctx.font = "600 20px system-ui"; ctx.textAlign = "center";
      ctx.fillText("위 팔레트에서 전하·회로·자석·코일을 추가해 보세요.", w / 2, h / 2);
    }
    for (const object of s.sandboxObjects) this.sandboxObject(ctx, object, w, h);
  }

  private sandboxObject(ctx: CanvasRenderingContext2D, object: ElectromagnetismSandboxObject, w: number, h: number): void {
    const point = this.pixel(object.position, w, h);
    if (object.kind === "charge") this.charge(ctx, point, object.value >= 0 ? 1 : -1, "전하");
    else if (object.kind === "battery") this.block(ctx, point, "전지", palette.positive);
    else if (object.kind === "resistor") this.block(ctx, point, "저항", palette.purple);
    else if (object.kind === "magnet") this.block(ctx, point, "N  S", palette.negative);
    else if (object.kind === "coil") { ctx.strokeStyle = palette.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(point.x, point.y, 34, 0, Math.PI * 2); ctx.stroke(); this.label(ctx, point.x, point.y + 58, "코일"); }
    else this.probe(ctx, point, palette.field, "탐침");
  }

  private pixel(point: Vector2, width: number, height: number): Vector2 { return { x: point.x * width, y: point.y * height }; }

  private charge(ctx: CanvasRenderingContext2D, point: Vector2, sign: 1 | -1, label: string): void {
    ctx.fillStyle = sign === 1 ? palette.positive : palette.negative;
    ctx.beginPath(); ctx.arc(point.x, point.y, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 28px system-ui"; ctx.textAlign = "center"; ctx.fillText(sign === 1 ? "+" : "−", point.x, point.y + 9);
    this.label(ctx, point.x, point.y + 52, label);
  }

  private probe(ctx: CanvasRenderingContext2D, point: Vector2, color: string, label: string): void {
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(point.x, point.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    this.label(ctx, point.x, point.y + 38, label);
  }

  private compass(ctx: CanvasRenderingContext2D, point: Vector2, center: Vector2, direction: number): void {
    this.probe(ctx, point, palette.field, "나침반 탐침");
    const radial = Math.atan2(point.y - center.y, point.x - center.x);
    const angle = radial + direction * Math.PI / 2;
    this.arrow(ctx, point, { x: Math.cos(angle), y: Math.sin(angle) }, palette.positive, "", 38);
  }

  private arrow(ctx: CanvasRenderingContext2D, origin: Vector2, vector: Vector2, color: string, label: string, requestedLength: number): void {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude < 1e-9 || requestedLength <= 0) return;
    const length = requestedLength;
    const dx = vector.x / magnitude * length; const dy = vector.y / magnitude * length;
    const end = { x: origin.x + dx, y: origin.y + dy };
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    const angle = Math.atan2(dy, dx);
    ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - Math.cos(angle - 0.45) * 12, end.y - Math.sin(angle - 0.45) * 12); ctx.lineTo(end.x - Math.cos(angle + 0.45) * 12, end.y - Math.sin(angle + 0.45) * 12); ctx.closePath(); ctx.fill();
    if (label) this.label(ctx, origin.x + dx / 2, origin.y + dy / 2 - 14, label);
  }

  private dashedConnection(ctx: CanvasRenderingContext2D, a: Vector2, b: Vector2): void {
    ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = palette.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }

  private flowDots(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number, current: number): void {
    const count = Math.max(3, Math.min(12, Math.round(current * 5)));
    ctx.fillStyle = palette.positive;
    for (let index = 0; index < count; index += 1) {
      const ratio = (index + 0.5) / count;
      const x = left + (right - left) * ratio;
      ctx.beginPath(); ctx.arc(x, bottom, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  private block(ctx: CanvasRenderingContext2D, point: Vector2, label: string, color: string): void {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(point.x - 42, point.y - 26, 84, 52, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, point.x, point.y + 6);
  }

  private badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.font = "700 15px system-ui"; const width = ctx.measureText(text).width + 24;
    ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = palette.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - width / 2, y - 17, width, 34, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = palette.ink; ctx.textAlign = "center"; ctx.fillText(text, x, y + 5);
  }

  private label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.fillStyle = palette.ink; ctx.font = "600 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(text, x, y);
  }

  private compact(value: number): string {
    const absolute = Math.abs(value);
    if (absolute >= 1000) return value.toExponential(2);
    if (absolute >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }
}
