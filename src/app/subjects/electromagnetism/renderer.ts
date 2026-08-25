import type { Vector2 } from "../../../physics/core";
import {
  CAPACITOR_PLATES,
  CIRCUIT_TRACK,
  ELECTROMAGNETISM_WORLD,
  INDUCTION_COIL,
  type ElectromagnetismSandboxObject,
  type ElectromagnetismSnapshot,
} from "./models";

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

export interface ElectromagnetismViewport { readonly left: number; readonly top: number; readonly scale: number }
export const electromagnetismViewport = (width: number, height: number): ElectromagnetismViewport => {
  const scale = Math.min(width / ELECTROMAGNETISM_WORLD.width, height / ELECTROMAGNETISM_WORLD.height);
  return { left: (width - ELECTROMAGNETISM_WORLD.width * scale) / 2, top: (height - ELECTROMAGNETISM_WORLD.height * scale) / 2, scale };
};
export const modelToCanvas = (point: Vector2, width: number, height: number): Vector2 => {
  const viewport = electromagnetismViewport(width, height);
  return { x: viewport.left + point.x * ELECTROMAGNETISM_WORLD.width * viewport.scale, y: viewport.top + point.y * ELECTROMAGNETISM_WORLD.height * viewport.scale };
};
export const canvasToModel = (point: Vector2, width: number, height: number): Vector2 => {
  const viewport = electromagnetismViewport(width, height);
  return { x: (point.x - viewport.left) / (viewport.scale * ELECTROMAGNETISM_WORLD.width), y: (point.y - viewport.top) / (viewport.scale * ELECTROMAGNETISM_WORLD.height) };
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

  pointerToModel(clientX: number, clientY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const canvasPoint = {
      x: (clientX - rect.left) / Math.max(1, rect.width) * this.canvas.width,
      y: (clientY - rect.top) / Math.max(1, rect.height) * this.canvas.height,
    };
    return canvasToModel(canvasPoint, this.canvas.width, this.canvas.height);
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
    const forceLength = Math.min(130, 26 + Math.log10(1 + s.measurement.value) * 34);
    this.arrow(ctx, target, direction, palette.positive, `${s.measurement.value.toFixed(3)} N`, forceLength);
  }

  private fieldLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const positive = this.pixel({ x: 0.35, y: 0.42 }, w, h);
    const negative = this.pixel({ x: 0.35, y: 0.66 }, w, h);
    this.charge(ctx, positive, s.sign, s.sign === 1 ? "+ 전하" : "− 전하");
    this.charge(ctx, negative, s.sign === 1 ? -1 : 1, s.sign === 1 ? "− 전하" : "+ 전하");
    const maxField = Math.max(...s.fieldSamples.map((sample) => Math.hypot(sample.vector.x, sample.vector.y)), 1);
    for (const sample of s.fieldSamples) {
      const magnitude = Math.hypot(sample.vector.x, sample.vector.y);
      this.arrow(ctx, this.pixel(sample.point, w, h), sample.vector, `rgba(37,167,122,${0.25 + 0.55 * Math.sqrt(magnitude / maxField)})`, "", 10 + 20 * Math.sqrt(magnitude / maxField));
    }
    const probe = this.pixel(s.probe, w, h);
    this.probe(ctx, probe, palette.field, "전기장 탐침");
    this.arrow(ctx, probe, s.probeField, palette.field, "", Math.min(95, 24 + Math.log10(1 + s.measurement.value) * 8));
    this.badge(ctx, probe.x + 22, probe.y - 34, `${this.compact(s.measurement.value)} N/C`);
  }

  private potentialLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const source = this.pixel({ x: 0.35, y: 0.5 }, w, h);
    const scale = electromagnetismViewport(w, h).scale;
    for (const radiusMeters of [0.2, 0.35, 0.55, 0.8]) {
      ctx.strokeStyle = `rgba(160,105,220,${0.8 - radiusMeters / 2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(source.x, source.y, radiusMeters * scale, 0, Math.PI * 2); ctx.stroke();
    }
    this.charge(ctx, source, 1, "전위 원천");
    const probe = this.pixel(s.probe, w, h);
    this.probe(ctx, probe, palette.purple, "전위 탐침");
    this.badge(ctx, probe.x + 22, probe.y - 34, `${this.compact(s.measurement.value)} V`);
  }

  private circuitLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const left = this.pixel({ x: 0.2, y: 0.5 }, w, h).x; const right = this.pixel({ x: 0.8, y: 0.5 }, w, h).x;
    const top = this.pixel({ x: 0.5, y: 0.3 }, w, h).y; const bottom = this.pixel({ x: 0.5, y: 0.7 }, w, h).y;
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, 30); ctx.stroke();
    const upperCell = this.pixel({ x: 0.2, y: 0.43 }, w, h).y; const lowerCell = this.pixel({ x: 0.2, y: 0.57 }, w, h).y;
    ctx.fillStyle = "#fff"; ctx.fillRect(left - 18, upperCell, 36, lowerCell - upperCell);
    ctx.strokeStyle = palette.positive; ctx.lineWidth = 5;
    const longPlateY = this.pixel({ x: 0.2, y: 0.46 }, w, h).y; const shortPlateY = this.pixel({ x: 0.2, y: 0.54 }, w, h).y;
    ctx.beginPath(); ctx.moveTo(left - 12, longPlateY); ctx.lineTo(left + 12, longPlateY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left - 7, shortPlateY); ctx.lineTo(left + 7, shortPlateY); ctx.stroke();
    const bulbPower = s.secondaryMeasurement?.value ?? 0;
    ctx.shadowColor = palette.gold; ctx.shadowBlur = Math.min(42, bulbPower * 6);
    ctx.fillStyle = `rgba(242,184,75,${Math.min(1, 0.25 + bulbPower / 12)})`;
    ctx.beginPath(); ctx.arc(right, this.pixel({ x: 0.8, y: 0.5 }, w, h).y, 34, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.stroke();
    const trackLeft = this.pixel({ x: CIRCUIT_TRACK.minX, y: 0.3 }, w, h).x;
    const trackRight = this.pixel({ x: CIRCUIT_TRACK.maxX, y: 0.3 }, w, h).x;
    const handle = this.pixel(s.probe, w, h);
    ctx.strokeStyle = palette.purple; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(trackLeft, top); ctx.lineTo(trackRight, top); ctx.stroke();
    this.probe(ctx, handle, palette.purple, "저항 손잡이");
    this.flowDots(ctx, left, right, top, bottom, s.measurement.value);
    const badge = this.pixel({ x: 0.5, y: 0.82 }, w, h);
    this.badge(ctx, badge.x, badge.y, `${s.measurement.value.toFixed(2)} A · ${bulbPower.toFixed(2)} W`);
  }

  private capacitorLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const left = this.pixel({ x: CAPACITOR_PLATES.leftX, y: 0.5 }, w, h).x;
    const right = this.pixel({ x: s.probe.x, y: 0.5 }, w, h).x;
    const center = (left + right) / 2;
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 16;
    const plateTop = this.pixel({ x: 0.5, y: 0.27 }, w, h).y; const plateBottom = this.pixel({ x: 0.5, y: 0.73 }, w, h).y;
    ctx.beginPath(); ctx.moveTo(left, plateTop); ctx.lineTo(left, plateBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, plateTop); ctx.lineTo(right, plateBottom); ctx.stroke();
    for (let row = 0; row < 7; row += 1) {
      const y = this.pixel({ x: 0.5, y: 0.32 + row * 0.06 }, w, h).y;
      ctx.globalAlpha = Math.min(1, 0.25 + Math.log10(1 + s.capacitorField) / 5);
      this.arrow(ctx, { x: left + 18, y }, { x: 1, y: 0 }, palette.field, "", Math.max(8, right - left - 36));
      ctx.globalAlpha = 1;
    }
    for (let row = 0; row < 6; row += 1) {
      const y = this.pixel({ x: 0.5, y: 0.34 + row * 0.07 }, w, h).y;
      ctx.fillStyle = palette.positive; ctx.font = "700 22px system-ui"; ctx.fillText("+", left - 38, y);
      ctx.fillStyle = palette.negative; ctx.fillText("−", right + 22, y);
    }
    this.probe(ctx, this.pixel(s.probe, w, h), palette.purple, "판 간격 끌기");
    this.badge(ctx, center, this.pixel({ x: 0.5, y: 0.86 }, w, h).y, `${s.measurement.value.toFixed(3)} nF · ${s.secondaryMeasurement?.value.toFixed(3)} nJ`);
  }

  private magneticLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const wire = this.pixel({ x: 0.44, y: 0.5 }, w, h);
    const scale = electromagnetismViewport(w, h).scale;
    for (const radiusMeters of [0.14, 0.27, 0.4, 0.55]) {
      const radius = radiusMeters * scale;
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
    this.arrow(ctx, particle, s.lorentzForce, palette.positive, "자기력", Math.min(92, 28 + Math.hypot(s.lorentzForce.x, s.lorentzForce.y) * 90));
  }

  private inductionLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const coil = this.pixel(INDUCTION_COIL, w, h); const coilX = coil.x;
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 7;
    for (let index = 0; index < 7; index += 1) {
      ctx.beginPath(); ctx.ellipse(coilX + index * 10, coil.y, 42, 115, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const magnet = this.pixel(s.probe, w, h);
    ctx.fillStyle = palette.positive; ctx.fillRect(magnet.x - 70, magnet.y - 28, 70, 56);
    ctx.fillStyle = palette.negative; ctx.fillRect(magnet.x, magnet.y - 28, 70, 56);
    ctx.fillStyle = "#fff"; ctx.font = "700 20px system-ui"; ctx.textAlign = "center"; ctx.fillText("N", magnet.x - 35, magnet.y + 7); ctx.fillText("S", magnet.x + 35, magnet.y + 7);
    this.probe(ctx, { x: magnet.x, y: magnet.y + 44 }, palette.purple, "자석을 빠르게 끌기");
    const voltage = s.measurement.value;
    this.arrow(ctx, { x: coilX + 120, y: coil.y }, { x: voltage, y: 0 }, voltage >= 0 ? palette.positive : palette.negative, `${voltage.toFixed(2)} V`, Math.min(100, Math.abs(voltage) * 5));
    const badge = this.pixel({ x: 0.5, y: 0.84 }, w, h);
    this.badge(ctx, badge.x, badge.y, `${s.coilTurns}회 감은 코일 · 속도 ${s.magnetSpeed.toFixed(2)} m/s`);
  }

  private sandbox(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    if (s.sandboxObjects.length === 0) {
      ctx.fillStyle = palette.muted; ctx.font = "600 20px system-ui"; ctx.textAlign = "center";
      ctx.fillText("위 팔레트에서 전하·회로·자석·코일을 추가해 보세요.", w / 2, h / 2);
    }
    const byId = new Map(s.sandboxObjects.map((object) => [object.id, object]));
    for (const connection of s.sandboxConnections) {
      const from = byId.get(connection.from); const to = byId.get(connection.to);
      if (from && to) this.dashedConnection(ctx, this.pixel(from.position, w, h), this.pixel(to.position, w, h));
    }
    const maxField = Math.max(...s.fieldSamples.map((sample) => Math.hypot(sample.vector.x, sample.vector.y)), 1);
    for (const sample of s.fieldSamples) {
      const magnitude = Math.hypot(sample.vector.x, sample.vector.y);
      if (magnitude > 0) this.arrow(ctx, this.pixel(sample.point, w, h), sample.vector, "rgba(37,167,122,.35)", "", 8 + 18 * Math.sqrt(magnitude / maxField));
    }
    for (const object of s.sandboxObjects) this.sandboxObject(ctx, object, w, h);
    const probe = s.sandboxObjects.find((object) => object.kind === "probe");
    if (probe) this.arrow(ctx, this.pixel(probe.position, w, h), s.sandboxMetrics.electricField, palette.field, `${this.compact(Math.hypot(s.sandboxMetrics.electricField.x, s.sandboxMetrics.electricField.y))} N/C`, Math.min(90, 20 + Math.log10(1 + Math.hypot(s.sandboxMetrics.electricField.x, s.sandboxMetrics.electricField.y)) * 8));
    if (Math.abs(s.sandboxMetrics.current) > 0) this.badge(ctx, w / 2, 54, `연결 전류 ${s.sandboxMetrics.current.toFixed(2)} A`);
    else if (s.sandboxConnections.some((item) => item.kind === "induction")) this.badge(ctx, w / 2, 54, `유도 전압 ${s.sandboxMetrics.inducedVoltage.toFixed(2)} V`);
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

  private pixel(point: Vector2, width: number, height: number): Vector2 {
    return modelToCanvas(point, width, height);
  }

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
