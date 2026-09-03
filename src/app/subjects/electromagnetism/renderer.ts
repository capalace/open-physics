import type { Vector2 } from "../../../physics/core";
import { drawInteractionAffordance } from "../canvas-theme";
import { qualitativeLevel } from "../../format-value";
import {
  CAPACITOR_PLATES,
  CIRCUIT_TRACK,
  ELECTROMAGNETIC_FORCE_CONTROL_SPAN,
  ELECTROMAGNETISM_WORLD,
  GENERATOR_CENTER,
  INDUCTION_COIL,
  PARTICLE_START,
  PARTICLE_TARGETS,
  TRANSFORMER_TRACK,
  circuitResistanceAtX,
  isElectromagnetismWireConnectable,
  sandboxBulbBrightness,
  sandboxBulbPower,
  sandboxTerminals,
  sandboxVelocityHandle,
  sandboxWireTargetState,
  type ElectromagnetismSandboxObject,
  type ElectromagnetismSnapshot,
  type FieldLine,
  type SandboxTerminal,
  type SandboxWireEndpoint,
} from "./models";

const palette = {
  ink: "#22324a",
  muted: "#718096",
  grid: "#e7edf5",
  positive: "#e05c3f",
  negative: "#5b7cfa",
  field: "#25a77a",
  magnetic: "#2b9bb5",
  purple: "#a069dc",
  gold: "#f2b84b",
};

const TAU = Math.PI * 2;

const DIRECT_MANIPULATION_MODES = new Set<ElectromagnetismSnapshot["mode"]>([
  "charge", "potential", "electrostatic-induction", "circuits", "capacitors",
  "electronics", "magnetic-field", "magnetic-materials", "electromagnetic-force",
  "charged-particle", "induction", "electromagnet", "motor", "generator", "transformer",
]);

export const isElectromagnetismDirectManipulationMode = (mode: ElectromagnetismSnapshot["mode"]): boolean =>
  DIRECT_MANIPULATION_MODES.has(mode);

export const electromagnetismDirectHandle = (snapshot: ElectromagnetismSnapshot): Vector2 | null => {
  if (!isElectromagnetismDirectManipulationMode(snapshot.mode)) return null;
  if (snapshot.mode === "charged-particle" && snapshot.running) return null;
  if (snapshot.mode === "electromagnetic-force") return {
    x: 0.5 + snapshot.sign * snapshot.level * ELECTROMAGNETIC_FORCE_CONTROL_SPAN,
    y: Math.max(0.12, snapshot.wirePosition - 0.22),
  };
  if (snapshot.mode === "motor") return { x: snapshot.probe.x, y: 0.17 };
  return snapshot.probe;
};

export const wrappedPhase = (value: number): number => ((value % 1) + 1) % 1;

export const resistorZigzagCount = (resistance: number): number => {
  const normalized = Math.max(0, Math.min(1, (resistance - 2) / 18));
  return 4 + Math.round(normalized * 6) * 2;
};

export const rectangularLoopPoint = (
  progress: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
): Vector2 => {
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const perimeter = Math.max(1, 2 * (width + height));
  let distance = wrappedPhase(progress) * perimeter;
  if (distance <= width) return { x: left + distance, y: top };
  distance -= width;
  if (distance <= height) return { x: right, y: top + distance };
  distance -= height;
  if (distance <= width) return { x: right - distance, y: bottom };
  return { x: left, y: bottom - (distance - width) };
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

  render(snapshot: ElectromagnetismSnapshot, visualTime = snapshot.time, selectedSandboxId: string | null = null, wiring = false, wireStart: SandboxWireEndpoint | null = null): void {
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
    if (snapshot.mode === "charge") this.chargeLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "electric-field") this.fieldLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "potential") this.potentialLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "electrostatic-induction") this.electrostaticInductionLab(context, snapshot, width, height);
    else if (snapshot.mode === "circuits") this.circuitLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "capacitors") this.capacitorLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "electronics") this.electronicsLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "magnetic-field") this.magneticLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "magnetic-materials") this.magneticMaterialsLab(context, snapshot, width, height);
    else if (snapshot.mode === "electromagnetic-force") this.forceLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "induction") this.inductionLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "charged-particle") this.chargedParticleLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "electromagnet") this.electromagnetLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "motor") this.motorLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "generator") this.generatorLab(context, snapshot, width, height, visualTime);
    else if (snapshot.mode === "transformer") this.transformerLab(context, snapshot, width, height, visualTime);
    else this.sandbox(context, snapshot, width, height, visualTime, selectedSandboxId, wiring, wireStart);
    const directHandle = electromagnetismDirectHandle(snapshot);
    if (directHandle) drawInteractionAffordance(context, this.pixel(directHandle, width, height), { kind: "object", radius: 30 });
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

  hitSandboxTerminal(clientX: number, clientY: number, objects: readonly ElectromagnetismSandboxObject[]): SandboxWireEndpoint | null {
    const rect = this.canvas.getBoundingClientRect();
    const point = { x: (clientX - rect.left) / Math.max(1, rect.width) * this.canvas.width, y: (clientY - rect.top) / Math.max(1, rect.height) * this.canvas.height };
    for (const object of [...objects].reverse()) {
      if (!isElectromagnetismWireConnectable(object.kind)) continue;
      for (const terminal of sandboxTerminals(object.kind)) {
        const terminalPoint = this.sandboxTerminalPoint(object, terminal, this.canvas.width, this.canvas.height);
        if (Math.hypot(point.x - terminalPoint.x, point.y - terminalPoint.y) <= 16) return { objectId: object.id, terminal };
      }
    }
    return null;
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

  private chargeLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const source = this.pixel({ x: 0.32, y: 0.5 }, w, h);
    const target = this.pixel(s.probe, w, h);
    const forceStrength = Math.min(1, Math.log10(1 + s.measurement.value) / 2.4);
    this.fieldLines(ctx, s.fieldLines, w, h, time, palette.field, 0.3, Number.POSITIVE_INFINITY, false);
    const visibleSamples = s.fieldSamples.filter((_, index) => index % 3 === 0);
    const maxField = Math.max(...visibleSamples.map((sample) => Math.hypot(sample.vector.x, sample.vector.y)), 1);
    for (const sample of visibleSamples) {
      const magnitude = Math.hypot(sample.vector.x, sample.vector.y);
      this.fieldVector(ctx, this.pixel(sample.point, w, h), sample.vector, magnitude / maxField);
    }
    this.radialGlow(ctx, source, palette.positive, 70, 0.12 + forceStrength * 0.1);
    this.radialGlow(ctx, target, s.sign === 1 ? palette.positive : palette.negative, 58 + Math.sin(time * 5) * 4, 0.08 + forceStrength * 0.18);
    this.dashedConnection(ctx, source, target);
    this.distanceTicks(ctx, source, target);
    this.charge(ctx, source, 1, "고정 전하");
    this.charge(ctx, target, s.sign, "끌어서 거리 바꾸기");
    const direction = s.sign === 1 ? { x: target.x - source.x, y: target.y - source.y } : { x: source.x - target.x, y: source.y - target.y };
    const forceLength = Math.min(140, 30 + Math.log10(1 + s.measurement.value) * 36) * (0.96 + Math.sin(time * 5) * 0.04);
    this.arrow(ctx, target, direction, palette.positive, s.sign === 1 ? "밀어내는 힘" : "끌어당기는 힘", forceLength);
  }

  private fieldLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const positive = this.pixel({ x: 0.35, y: 0.42 }, w, h);
    const negative = this.pixel({ x: 0.35, y: 0.66 }, w, h);
    this.fieldLines(ctx, s.fieldLines, w, h, time, palette.field, 0.42, Number.POSITIVE_INFINITY, false);
    const maxField = Math.max(...s.fieldSamples.map((sample) => Math.hypot(sample.vector.x, sample.vector.y)), 1);
    for (const sample of s.fieldSamples) {
      const magnitude = Math.hypot(sample.vector.x, sample.vector.y);
      this.fieldVector(ctx, this.pixel(sample.point, w, h), sample.vector, magnitude / maxField);
    }
    this.charge(ctx, positive, s.sign, s.sign === 1 ? "+ 전하" : "− 전하");
    this.charge(ctx, negative, s.sign === 1 ? -1 : 1, s.sign === 1 ? "− 전하" : "+ 전하");
    const probe = this.pixel(s.probe, w, h);
    this.probe(ctx, probe, palette.field, "전기장 탐침");
    this.arrow(ctx, probe, s.probeField, palette.field, "", Math.min(95, 24 + Math.log10(1 + s.measurement.value) * 8));
    this.badge(ctx, probe.x + 22, probe.y - 34, `전기장 · ${qualitativeLevel(Math.log10(1 + s.measurement.value), 0, 6, ["약함", "보통", "강함"])}`);
  }

  private potentialLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const source = this.pixel({ x: 0.35, y: 0.5 }, w, h);
    const scale = electromagnetismViewport(w, h).scale;
    const potentialGlow = ctx.createRadialGradient(source.x, source.y, 16, source.x, source.y, 0.9 * scale);
    potentialGlow.addColorStop(0, "rgba(224,92,63,.28)");
    potentialGlow.addColorStop(0.28, "rgba(160,105,220,.17)");
    potentialGlow.addColorStop(1, "rgba(91,124,250,0)");
    ctx.fillStyle = potentialGlow; ctx.fillRect(0, 0, w, h);
    const equipotentialRadii = [0.2, 0.35, 0.55, 0.8] as const;
    const labelAngles = [-2.2, -1.05, 0.4, 1.0] as const;
    for (const [index, radiusMeters] of equipotentialRadii.entries()) {
      ctx.strokeStyle = `rgba(160,105,220,${0.8 - radiusMeters / 2})`;
      ctx.lineWidth = 2 + Math.max(0, Math.sin(time * 2.2 - radiusMeters * 8)) * 1.2;
      ctx.beginPath(); ctx.arc(source.x, source.y, radiusMeters * scale, 0, Math.PI * 2); ctx.stroke();
      const angle = labelAngles[index];
      this.miniTag(
        ctx,
        source.x + Math.cos(angle) * radiusMeters * scale,
        source.y + Math.sin(angle) * radiusMeters * scale,
        `전위 ${index < 2 ? "높음" : index === 2 ? "보통" : "낮음"}`,
        palette.purple,
      );
    }
    this.charge(ctx, source, 1, "전위 원천");
    const probe = this.pixel(s.probe, w, h);
    this.dashedConnection(ctx, source, probe);
    this.probe(ctx, probe, palette.purple, "전위 탐침");
    this.badge(ctx, probe.x + 22, probe.y - 34, `전위 · ${qualitativeLevel(Math.log10(1 + Math.abs(s.measurement.value)), 2, 6)}`);
  }

  private electrostaticInductionLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const charge = this.pixel(s.probe, w, h); const conductor = this.pixel({ x: 0.62, y: 0.5 }, w, h);
    const separation = Math.max(0, Math.min(1, s.measurement.value));
    this.charge(ctx, charge, 1, "끌어서 거리 바꾸기");
    ctx.fillStyle = "#dce6f3"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(conductor.x - 155, conductor.y - 72, 310, 144, 34); ctx.fill(); ctx.stroke();
    const count = 4 + Math.round(separation * 6);
    ctx.font = "800 24px system-ui"; ctx.textAlign = "center";
    for (let index = 0; index < count; index += 1) {
      const y = conductor.y - 48 + index * 96 / Math.max(1, count - 1);
      ctx.fillStyle = palette.negative; ctx.fillText("−", conductor.x - 112, y + 8);
      ctx.fillStyle = palette.positive; ctx.fillText("+", conductor.x + 112, y + 8);
    }
    this.label(ctx, conductor.x, conductor.y - 98, "금속 도체 안 자유 전자의 이동");
    const dielectric = this.pixel({ x: 0.62, y: 0.78 }, w, h);
    for (let index = -3; index <= 3; index += 1) { ctx.fillStyle = palette.negative; ctx.beginPath(); ctx.arc(dielectric.x + index * 38 - separation * 5, dielectric.y, 5, 0, TAU); ctx.fill(); ctx.fillStyle = palette.positive; ctx.beginPath(); ctx.arc(dielectric.x + index * 38 + separation * 5, dielectric.y, 5, 0, TAU); ctx.fill(); }
    this.miniTag(ctx, dielectric.x, dielectric.y + 30, "부도체의 유전 분극", palette.purple);
    this.badge(ctx, conductor.x, conductor.y + 112, `전하 분리 · ${qualitativeLevel(separation, 0, 1, ["조금", "보통", "많이"])}`);
  }

  private circuitLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
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
    const drawBulb = (x: number, y: number): void => {
      ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = Math.min(42, bulbPower * 6); ctx.fillStyle = `rgba(242,184,75,${Math.min(1, 0.2 + bulbPower / 10)})`;
      ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x, y - 12, x + 12, y); ctx.stroke();
    };
    if (s.circuitArrangement === "series") {
      drawBulb(right, top + (bottom - top) * 0.35); drawBulb(right, top + (bottom - top) * 0.68);
    } else {
      const branchLeft = this.pixel({ x: 0.5, y: 0.5 }, w, h).x; const bulbX = (branchLeft + right) / 2;
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 5; for (const y of [top + 58, bottom - 58]) { ctx.beginPath(); ctx.moveTo(branchLeft, y); ctx.lineTo(right, y); ctx.stroke(); drawBulb(bulbX, y); }
    }
    const trackLeft = this.pixel({ x: CIRCUIT_TRACK.minX, y: 0.3 }, w, h).x;
    const trackRight = this.pixel({ x: CIRCUIT_TRACK.maxX, y: 0.3 }, w, h).x;
    const handle = this.pixel(s.probe, w, h);
    const resistance = circuitResistanceAtX(s.probe.x);
    const resistorCenter = (trackLeft + trackRight) / 2;
    const resistorLeft = resistorCenter - 92;
    const resistorRight = resistorCenter + 92;
    const sliderY = top + 54;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(resistorLeft - 8, top); ctx.lineTo(resistorRight + 8, top); ctx.stroke();
    this.resistorSymbol(ctx, resistorLeft, resistorRight, top, palette.purple, 4, resistorZigzagCount(resistance));
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(trackLeft, sliderY); ctx.lineTo(trackRight, sliderY); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(handle.x, sliderY, 13, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = palette.purple; ctx.beginPath(); ctx.arc(handle.x, sliderY, 4, 0, TAU); ctx.fill();
    this.miniTag(ctx, trackLeft, sliderY + 28, "저항 작게", palette.purple);
    this.miniTag(ctx, trackRight, sliderY + 28, "저항 크게", palette.purple);
    this.badge(ctx, resistorCenter, top - 48, `저항 · ${qualitativeLevel(resistance, 2, 20, ["작음", "보통", "큼"])}`);
    this.flowDots(ctx, left, right, top, bottom, s.measurement.value, time);
    const badge = this.pixel({ x: 0.5, y: 0.82 }, w, h);
    this.badge(ctx, badge.x, badge.y, `${s.circuitArrangement === "series" ? "직렬" : "병렬"} · 전류 ${qualitativeLevel(s.measurement.value, 0, 4)} · 전구 ${qualitativeLevel(bulbPower, 0, 8, ["어두움", "보통", "밝음"])}`);
  }

  private capacitorLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const left = this.pixel({ x: CAPACITOR_PLATES.leftX, y: 0.5 }, w, h).x;
    const right = this.pixel({ x: s.probe.x, y: 0.5 }, w, h).x;
    const center = (left + right) / 2;
    const plateTop = this.pixel({ x: 0.5, y: 0.27 }, w, h).y;
    const plateBottom = this.pixel({ x: 0.5, y: 0.73 }, w, h).y;
    const fieldStrength = Math.min(1, Math.log10(1 + s.capacitorField) / 5);
    const fieldFill = ctx.createLinearGradient(left, 0, right, 0);
    fieldFill.addColorStop(0, `rgba(224,92,63,${0.08 + fieldStrength * 0.08})`);
    fieldFill.addColorStop(0.5, `rgba(37,167,122,${0.08 + fieldStrength * 0.16})`);
    fieldFill.addColorStop(1, `rgba(91,124,250,${0.08 + fieldStrength * 0.08})`);
    ctx.fillStyle = fieldFill;
    ctx.fillRect(left, plateTop, Math.max(0, right - left), plateBottom - plateTop);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(left, plateTop); ctx.lineTo(left, plateBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, plateTop); ctx.lineTo(right, plateBottom); ctx.stroke();
    for (let row = 0; row < 7; row += 1) {
      const y = this.pixel({ x: 0.5, y: 0.32 + row * 0.06 }, w, h).y;
      ctx.globalAlpha = Math.min(1, 0.32 + fieldStrength * 0.55 + Math.sin(time * 4 - row * 0.7) * 0.08);
      this.arrow(ctx, { x: left + 18, y }, { x: 1, y: 0 }, palette.field, "", Math.max(8, right - left - 36));
      ctx.globalAlpha = 1;
    }
    for (let row = 0; row < 6; row += 1) {
      const y = this.pixel({ x: 0.5, y: 0.34 + row * 0.07 }, w, h).y;
      ctx.globalAlpha = Math.min(1, 0.18 + s.capacitorVoltage / 12);
      ctx.fillStyle = palette.positive; ctx.font = "700 22px system-ui"; ctx.fillText("+", left - 38, y);
      ctx.fillStyle = palette.negative; ctx.fillText("−", right + 22, y);
    }
    ctx.globalAlpha = 1;
    const battery = this.pixel({ x: 0.18, y: 0.78 }, w, h); const flash = this.pixel({ x: 0.72, y: 0.78 }, w, h);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(left, plateBottom); ctx.lineTo(left, battery.y); ctx.lineTo(battery.x + 24, battery.y);
    ctx.moveTo(right, plateBottom); ctx.lineTo(right, flash.y); ctx.lineTo(flash.x - 26, flash.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(battery.x - 28, battery.y - 34, 56, 68);
    ctx.strokeStyle = palette.positive; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(battery.x - 17, battery.y - 11); ctx.lineTo(battery.x + 17, battery.y - 11); ctx.moveTo(battery.x - 10, battery.y + 12); ctx.lineTo(battery.x + 10, battery.y + 12); ctx.stroke();
    const flashLevel = s.capacitorMode === "lamp" ? Math.min(1, s.capacitorVoltage / 7) : 0;
    ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = flashLevel * 50; ctx.fillStyle = `rgba(242,184,75,${0.16 + flashLevel * 0.84})`; ctx.strokeStyle = palette.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(flash.x, flash.y, 30, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    this.miniTag(ctx, battery.x, battery.y + 54, s.capacitorMode === "charging" ? "전지 연결됨" : "전지 분리됨", s.capacitorMode === "charging" ? palette.positive : palette.muted);
    this.miniTag(ctx, flash.x, flash.y + 54, s.capacitorMode === "lamp" ? `플래시 · ${qualitativeLevel(flashLevel, 0, 1, ["어두움", "보통", "밝음"])}` : "플래시 꺼짐", s.capacitorMode === "lamp" ? palette.gold : palette.muted);
    this.probe(ctx, this.pixel(s.probe, w, h), palette.purple, "판 간격 끌기");
    const modeLabel = s.capacitorMode === "charging" ? "충전 중" : s.capacitorMode === "lamp" ? "플래시로 방전 중" : "전지에서 분리";
    this.badge(ctx, center, plateTop - 42, `${modeLabel} · 저장 전하 ${qualitativeLevel(s.secondaryMeasurement?.value ?? 0, 0, 30)}`);
  }

  private electronicsLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const left = this.pixel({ x: 0.18, y: 0.48 }, w, h); const right = this.pixel({ x: 0.82, y: 0.48 }, w, h);
    const current = s.measurement.value; const brightness = Math.min(1, current / 20);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.lineTo(right.x, right.y + 130); ctx.lineTo(left.x, left.y + 130); ctx.closePath(); ctx.stroke();
    this.batterySymbol(ctx, left, 9, 1, false);
    const diodeX = left.x + 155; ctx.fillStyle = palette.positive; ctx.beginPath(); ctx.moveTo(diodeX - 22, left.y - 25); ctx.lineTo(diodeX + 22, left.y); ctx.lineTo(diodeX - 22, left.y + 25); ctx.closePath(); ctx.fill(); ctx.strokeStyle = palette.ink; ctx.beginPath(); ctx.moveTo(diodeX + 25, left.y - 28); ctx.lineTo(diodeX + 25, left.y + 28); ctx.stroke();
    const transistorX = (left.x + right.x) / 2; ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(transistorX, left.y, 38, 0, TAU); ctx.fill(); ctx.stroke(); this.label(ctx, transistorX, left.y + 7, "T");
    this.resistorSymbol(ctx, transistorX + 80, right.x - 72, left.y, palette.gold, 4, 8);
    ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = brightness * 52; ctx.fillStyle = `rgba(242,184,75,${.15 + brightness * .85})`; ctx.beginPath(); ctx.arc(right.x, right.y + 65, 29, 0, TAU); ctx.fill(); ctx.strokeStyle = palette.ink; ctx.stroke(); ctx.restore();
    this.flowDots(ctx, left.x, right.x, left.y, left.y + 130, current / 12, time);
    const handle = this.pixel(s.probe, w, h); const trackLeft = this.pixel({ x: 0.25, y: 0.78 }, w, h); const trackRight = this.pixel({ x: 0.75, y: 0.78 }, w, h);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(trackLeft.x, handle.y); ctx.lineTo(trackRight.x, handle.y); ctx.stroke(); this.probe(ctx, handle, palette.negative, "입력 전압");
    this.badge(ctx, transistorX, left.y - 82, current > 0.1 ? "문이 열려 전류가 흘러요" : "문이 닫혀 전류가 멈춰요");
  }

  private magneticLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const wire = this.pixel({ x: 0.44, y: 0.5 }, w, h);
    const scale = electromagnetismViewport(w, h).scale;
    for (const radiusMeters of [0.11, 0.2, 0.3, 0.41, 0.53, 0.66]) {
      const radius = radiusMeters * scale;
      this.magneticRing(ctx, wire, radius, s.direction, time, 1 - radiusMeters * 0.65);
    }
    ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.arc(wire.x, wire.y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 28px system-ui"; ctx.textAlign = "center"; ctx.fillText(s.direction === 1 ? "⊙" : "⊗", wire.x, wire.y + 9);
    const probe = this.pixel(s.probe, w, h);
    this.compass(ctx, probe, wire, s.direction);
    this.badge(ctx, probe.x, probe.y - 48, `자기장 · ${qualitativeLevel(Math.abs(s.measurement.value), 0, 80, ["약함", "보통", "강함"])}`);
  }

  private magneticMaterialsLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number): void {
    const field = s.secondaryMeasurement?.value ?? 0; const rows = [{ label: "철 · 강자성", response: Math.tanh(field * 3.2), color: palette.positive }, { label: "알루미늄 · 상자성", response: field * .22, color: palette.gold }, { label: "구리 · 반자성", response: -field * .16, color: palette.negative }];
    for (const [rowIndex, row] of rows.entries()) {
      const center = this.pixel({ x: 0.55, y: 0.27 + rowIndex * .22 }, w, h); ctx.fillStyle = "rgba(220,230,243,.8)"; ctx.strokeStyle = row.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(center.x - 250, center.y - 42, 500, 84, 14); ctx.fill(); ctx.stroke();
      this.label(ctx, center.x - 320, center.y + 7, row.label);
      for (let index = 0; index < 9; index += 1) { const x = center.x - 200 + index * 50; const direction = row.response >= 0 ? 1 : -1; const disorder = 1 - Math.min(1, Math.abs(row.response)); const angle = direction > 0 ? (index % 2 ? .18 : -.18) * disorder : Math.PI + (index % 2 ? .18 : -.18) * disorder; this.arrow(ctx, { x, y: center.y }, { x: Math.cos(angle), y: Math.sin(angle) }, row.color, "", 22 + Math.abs(row.response) * 18); }
    }
    const handle = this.pixel(s.probe, w, h); const trackLeft = this.pixel({ x: 0.25, y: 0.78 }, w, h); const trackRight = this.pixel({ x: 0.75, y: 0.78 }, w, h);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(trackLeft.x, handle.y); ctx.lineTo(trackRight.x, handle.y); ctx.stroke(); this.probe(ctx, handle, palette.magnetic, "외부 자기장");
    this.arrow(ctx, { x: trackLeft.x, y: handle.y - 55 }, { x: 1, y: 0 }, palette.magnetic, "자기장 방향", trackRight.x - trackLeft.x);
  }

  private forceLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    ctx.fillStyle = "rgba(91,124,250,.12)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(91,124,250,.65)"; ctx.font = "20px system-ui"; ctx.textAlign = "center";
    for (let y = 36; y < h; y += 52) for (let x = 36; x < w; x += 52) ctx.fillText(s.direction === 1 ? "⊙" : "⊗", x, y);
    const center = this.pixel({ x: 0.5, y: s.wirePosition }, w, h);
    const railTop = this.pixel({ x: 0.5, y: 0.22 }, w, h).y; const railBottom = this.pixel({ x: 0.5, y: 0.81 }, w, h).y;
    ctx.strokeStyle = "#7c899b"; ctx.lineWidth = 7; for (const offset of [-180, 180]) { ctx.beginPath(); ctx.moveTo(center.x + offset, railTop); ctx.lineTo(center.x + offset, railBottom); ctx.stroke(); }
    ctx.fillStyle = palette.gold; for (const y of [railTop, railBottom]) { ctx.beginPath(); ctx.arc(center.x - 180, y, 13, 0, TAU); ctx.arc(center.x + 180, y, 13, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = 15;
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(center.x - 180, center.y); ctx.lineTo(center.x + 180, center.y); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 5;
    for (let index = 0; index < 7; index += 1) {
      const progress = wrappedPhase(index / 7 + time * 0.22 * s.sign);
      const x = center.x - 145 + progress * 290;
      ctx.beginPath(); ctx.arc(x, center.y, 5, 0, TAU); ctx.stroke();
    }
    const directHandle = electromagnetismDirectHandle(s)!;
    const currentHandle = this.pixel(directHandle, w, h);
    const currentOrigin = this.pixel({ x: 0.5 - s.sign * 0.07, y: directHandle.y }, w, h);
    const currentVector = { x: currentHandle.x - currentOrigin.x, y: currentHandle.y - currentOrigin.y };
    this.arrow(ctx, currentOrigin, currentVector, palette.gold, `전류 ${s.sign === 1 ? "→" : "←"} · 끝을 끌어 조절`, Math.hypot(currentVector.x, currentVector.y));
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(currentHandle.x, currentHandle.y, 9, 0, TAU); ctx.fill(); ctx.stroke();
    this.arrow(ctx, center, s.lorentzForce, palette.positive, "도선이 받는 힘", Math.min(132, 46 + Math.hypot(s.lorentzForce.x, s.lorentzForce.y) * 10));
    const contact = s.wirePosition <= 0.255 ? "위쪽 종에 닿음" : s.wirePosition >= 0.775 ? "아래쪽 종에 닿음" : s.wireVelocity < -0.002 ? "위로 이동 중" : s.wireVelocity > 0.002 ? "아래로 이동 중" : "힘의 방향을 바꿔 보세요";
    this.badge(ctx, center.x, h - 72, `${contact} · 자기장 ${s.direction === 1 ? "화면 밖 ⊙" : "화면 안 ⊗"}`);
  }

  private inductionLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const coil = this.pixel(INDUCTION_COIL, w, h); const coilX = coil.x;
    const voltage = s.measurement.value;
    const inductionStrength = Math.min(1, Math.abs(voltage) / 12);
    this.barMagnetFieldLines(ctx, this.pixel(s.probe, w, h), time, 70, 0.4 + inductionStrength * 0.6);
    this.fluxLines(ctx, this.pixel(s.probe, w, h), coil, time, voltage, 0.25 + inductionStrength * 0.75);
    ctx.shadowColor = voltage >= 0 ? palette.positive : palette.negative;
    ctx.shadowBlur = inductionStrength * 32;
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 7;
    for (let index = 0; index < 7; index += 1) {
      ctx.beginPath(); ctx.ellipse(coilX + index * 10, coil.y, 42, 115, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const magnet = this.pixel(s.probe, w, h);
    this.barMagnet(ctx, magnet, 70, 28);
    this.probe(ctx, { x: magnet.x, y: magnet.y + 44 }, palette.purple, "자석을 빠르게 끌기");
    this.arrow(ctx, { x: coilX + 120, y: coil.y }, { x: voltage, y: 0 }, voltage >= 0 ? palette.positive : palette.negative, "유도 전압", Math.min(100, Math.abs(voltage) * 5));
    this.inductionMeter(ctx, coilX + 190, coil.y, voltage);
    const badge = this.pixel({ x: 0.5, y: 0.84 }, w, h);
    this.badge(ctx, badge.x, badge.y, `${s.coilTurns}회 감은 코일 · 자석 ${qualitativeLevel(Math.abs(s.magnetSpeed), 0, 3, ["천천히", "보통", "빠르게"])}`);
  }

  private chargedParticleLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    ctx.fillStyle = "rgba(43,155,181,.09)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(43,155,181,.62)"; ctx.strokeStyle = "rgba(43,155,181,.62)"; ctx.lineWidth = 1.6;
    for (let y = 34; y < h; y += 46) for (let x = 34; x < w; x += 46) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
      if (s.direction === 1) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); }
    }
    for (const [index, target] of PARTICLE_TARGETS.entries()) {
      const point = this.pixel(target, w, h); const hit = s.particleTargetsHit[index];
      ctx.save(); ctx.strokeStyle = hit ? palette.gold : this.withAlpha(palette.gold, 0.58); ctx.lineWidth = hit ? 8 : 5;
      ctx.shadowColor = palette.gold; ctx.shadowBlur = hit ? 30 : 8;
      ctx.beginPath(); ctx.arc(point.x, point.y, 21 - index * 2, 0, TAU); ctx.stroke(); ctx.restore();
      this.miniTag(ctx, point.x, point.y - 31, `${index + 1}번 표적`, palette.gold);
    }
    if (s.trail.length > 1) {
      ctx.save(); ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.shadowColor = palette.purple; ctx.shadowBlur = 8;
      ctx.beginPath(); s.trail.forEach((point, index) => { const pixel = this.pixel(point, w, h); if (index === 0) ctx.moveTo(pixel.x, pixel.y); else ctx.lineTo(pixel.x, pixel.y); }); ctx.stroke(); ctx.restore();
    }
    const particle = this.pixel(s.particle, w, h);
    this.radialGlow(ctx, particle, s.sign === 1 ? palette.positive : palette.negative, 54 + Math.sin(time * 6) * 4, 0.18);
    this.charge(ctx, particle, s.sign, s.running ? "운동 중" : "전하");
    if (!s.running) {
      const start = this.pixel(PARTICLE_START, w, h); const handle = this.pixel(s.probe, w, h);
      this.arrow(ctx, start, { x: handle.x - start.x, y: handle.y - start.y }, palette.purple, "끌어서 발사", Math.hypot(handle.x - start.x, handle.y - start.y));
      ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(handle.x, handle.y, 10, 0, TAU); ctx.fill(); ctx.stroke();
    } else this.arrow(ctx, particle, s.lorentzForce, palette.positive, "로런츠 힘", 66);
    const hitCount = s.particleTargetsHit.filter(Boolean).length;
    if (hitCount === PARTICLE_TARGETS.length) this.confetti(ctx, w, h, time);
    this.badge(ctx, w / 2, 48, hitCount === PARTICLE_TARGETS.length ? "모든 표적 성공!" : `표적 ${hitCount}/3 · ${s.sign === 1 ? "양전하" : "음전하"} · 궤도 ${qualitativeLevel(s.measurement.value, 0, 3, ["좁음", "보통", "넓음"])}`);
  }

  private electromagnetLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const head = this.pixel(s.probe, w, h); const railY = this.pixel({ x: 0.5, y: 0.14 }, w, h).y;
    const pile = this.pixel({ x: 0.5, y: 0.76 }, w, h); const bin = this.pixel({ x: 0.82, y: 0.76 }, w, h);
    const force = s.measurement.value; const requiredForce = s.secondaryMeasurement?.value ?? 0; const strength = Math.min(1, force / 20);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(70, railY); ctx.lineTo(w - 70, railY); ctx.stroke();
    ctx.fillStyle = palette.purple; ctx.beginPath(); ctx.roundRect(head.x - 28, railY - 17, 56, 34, 9); ctx.fill();
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(head.x, railY + 17); ctx.lineTo(head.x, head.y - 46); ctx.stroke();
    this.radialGlow(ctx, head, palette.magnetic, 105, 0.08 + strength * 0.18);
    ctx.fillStyle = "#8793a5"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(head.x - 15, head.y - 48, 30, 96, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 6; const visibleTurns = Math.round(4 + (s.coilTurns - 20) / 140 * 5);
    for (let index = 0; index < visibleTurns; index += 1) { const y = head.y - 35 + index * 70 / Math.max(1, visibleTurns - 1); ctx.beginPath(); ctx.ellipse(head.x, y, 38, 10, 0, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.strokeStyle = this.withAlpha(palette.magnetic, 0.3 + strength * 0.42); ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -time * 22;
    for (const spread of [42, 66]) { ctx.beginPath(); ctx.moveTo(head.x, head.y - 52); ctx.bezierCurveTo(head.x - spread, head.y - 80, head.x - spread, head.y + 82, head.x, head.y + 54); ctx.bezierCurveTo(head.x + spread, head.y + 82, head.x + spread, head.y - 80, head.x, head.y - 52); ctx.stroke(); } ctx.restore();
    this.miniTag(ctx, head.x, head.y - 72, "전자석을 끌기", palette.purple);
    ctx.fillStyle = "rgba(91,124,250,.1)"; ctx.strokeStyle = palette.negative; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(bin.x - 74, bin.y - 44, 148, 88, 10); ctx.fill(); ctx.stroke();
    const loadSize = [0, 52, 68, 84][s.deviceLoad]; const loadPoint = s.craneCarrying > 0 ? { x: head.x, y: head.y + 78 } : s.craneDelivered > 0 ? bin : pile;
    ctx.fillStyle = s.craneCarrying > 0 ? palette.magnetic : "#8793a5"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(loadPoint.x - loadSize / 2, loadPoint.y - loadSize / 2, loadSize, loadSize, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "800 17px system-ui"; ctx.textAlign = "center"; ctx.fillText(["", "가벼움", "보통", "무거움"][s.deviceLoad], loadPoint.x, loadPoint.y + 6);
    if (s.craneDelivered === 0) { ctx.fillStyle = palette.negative; ctx.font = "800 18px system-ui"; ctx.textAlign = "center"; ctx.fillText("놓을 곳", bin.x, bin.y + 7); }
    const state = s.craneDelivered > 0 ? "운반됨" : s.craneCarrying > 0 ? "전자석에 붙음" : force >= requiredForce ? "들 수 있음 · 짐으로 내려 보세요" : "힘이 부족해 붙지 않음";
    this.badge(ctx, w / 2, h - 92, `${state} · ${force >= requiredForce ? "필요한 힘에 도달했어요" : "힘이 더 필요해요"}`);
  }

  private motorLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const center = this.pixel({ x: 0.43, y: 0.5 }, w, h); const left = this.pixel({ x: 0.2, y: 0.5 }, w, h); const right = this.pixel({ x: 0.66, y: 0.5 }, w, h);
    ctx.fillStyle = palette.positive; ctx.beginPath(); ctx.roundRect(left.x - 52, left.y - 105, 82, 210, 16); ctx.fill();
    ctx.fillStyle = palette.negative; ctx.beginPath(); ctx.roundRect(right.x - 30, right.y - 105, 82, 210, 16); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "900 34px system-ui"; ctx.textAlign = "center"; ctx.fillText(s.direction === 1 ? "N" : "S", left.x - 10, left.y + 11); ctx.fillText(s.direction === 1 ? "S" : "N", right.x + 10, right.y + 11);
    for (let row = -2; row <= 2; row += 1) this.arrow(ctx, { x: left.x + 36, y: center.y + row * 38 }, { x: s.direction, y: 0 }, this.withAlpha(palette.magnetic, 0.66), "", Math.max(20, right.x - left.x - 72));
    ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(s.rotorAngle); ctx.strokeStyle = palette.gold; ctx.lineWidth = 12; ctx.strokeRect(-92, -45, 184, 90); ctx.restore();
    ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.arc(center.x, center.y, 24, 0, TAU); ctx.fill();
    const drum = this.pixel({ x: 0.73, y: 0.3 }, w, h); ctx.strokeStyle = palette.ink; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(drum.x, drum.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(drum.x, drum.y, 38, 0, TAU); ctx.fill(); ctx.stroke();
    const load = this.pixel({ x: 0.73, y: s.motorLoadHeight }, w, h); ctx.strokeStyle = palette.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(drum.x, drum.y + 38); ctx.lineTo(load.x, load.y - 36); ctx.stroke();
    const loadWidths = [0, 62, 82, 102]; const loadWidth = loadWidths[s.deviceLoad]; ctx.fillStyle = s.deviceLoad === 3 ? "#68778b" : s.deviceLoad === 2 ? "#8793a5" : "#aab4c2"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(load.x - loadWidth / 2, load.y - 36, loadWidth, 72, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "800 18px system-ui"; ctx.textAlign = "center"; ctx.fillText(["", "가벼움", "보통", "무거움"][s.deviceLoad], load.x, load.y + 6);
    const trackLeft = this.pixel({ x: 0.28, y: 0.17 }, w, h); const trackRight = this.pixel({ x: 0.68, y: 0.17 }, w, h); const handle = this.pixel(s.probe, w, h);
    ctx.strokeStyle = palette.purple; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(trackLeft.x, trackLeft.y); ctx.lineTo(trackRight.x, trackRight.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(handle.x, trackLeft.y, 11, 0, TAU); ctx.fill(); ctx.stroke(); this.miniTag(ctx, handle.x, trackLeft.y - 25, `전류 · ${qualitativeLevel(s.level, 0, 1)}`, palette.purple);
    const torque = s.measurement.value; const required = s.secondaryMeasurement?.value ?? 0; const correctDirection = s.sign * s.direction > 0;
    const state = !correctDirection ? "회전 방향이 반대라 짐이 내려가요" : torque > required ? "토크가 충분해 짐이 올라가요" : "부하가 커서 전동기가 멈췄어요";
    this.badge(ctx, w / 2, h - 72, `${state} · ${torque >= required ? "돌릴 힘이 충분해요" : "돌릴 힘이 더 필요해요"}`);
  }

  private generatorLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const center = this.pixel(GENERATOR_CENTER, w, h); const handle = this.pixel(s.probe, w, h); const voltage = s.measurement.value; const output = s.generatorOutputLevel;
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#15244a"); sky.addColorStop(1, "#304a72"); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.72)"; for (let index = 0; index < 34; index += 1) { const x = 24 + (index * 83) % Math.max(40, w - 48); const y = 22 + (index * 47) % 180; ctx.beginPath(); ctx.arc(x, y, 1.5 + index % 2, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = palette.gold; ctx.lineWidth = 9; for (const radius of [92, 108]) { ctx.beginPath(); ctx.ellipse(center.x, center.y, radius, radius * 0.72, 0, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(s.rotorAngle); this.barMagnet(ctx, { x: 0, y: 0 }, 72, 28); ctx.restore();
    const ground = this.pixel({ x: 0.5, y: 0.82 }, w, h).y; ctx.fillStyle = "#182943"; ctx.fillRect(w * 0.52, ground - 190, w * 0.48, 230);
    const buildings = [{ x: 0.6, floors: 2 }, { x: 0.7, floors: 4 }, { x: 0.81, floors: 3 }, { x: 0.91, floors: 5 }];
    for (const [buildingIndex, building] of buildings.entries()) {
      const x = this.pixel({ x: building.x, y: 0.5 }, w, h).x; const width = 62; const height = 42 + building.floors * 24; const threshold = (buildingIndex + 1) / buildings.length; const lit = output >= threshold;
      ctx.fillStyle = buildingIndex % 2 ? "#263b59" : "#213552"; ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - width / 2, ground - height, width, height, 5); ctx.fill(); ctx.stroke();
      for (let floor = 0; floor < building.floors; floor += 1) for (const column of [-1, 1]) { const windowX = x + column * 15; const windowY = ground - 24 - floor * 24; ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = lit ? 15 : 0; ctx.fillStyle = lit ? "#ffd86a" : "#152238"; ctx.fillRect(windowX - 7, windowY - 8, 14, 16); ctx.restore(); }
    }
    ctx.strokeStyle = "rgba(242,184,75,.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(center.x + 108, center.y); ctx.lineTo(w * 0.56, center.y); ctx.lineTo(w * 0.56, ground); ctx.stroke();
    ctx.strokeStyle = palette.purple; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(handle.x, handle.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(handle.x, handle.y, 14, 0, TAU); ctx.fill(); ctx.stroke();
    this.miniTag(ctx, handle.x, handle.y - 28, "잡고 돌리기", palette.purple);
    this.inductionMeter(ctx, w - 92, 78, voltage);
    ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.roundRect(w * 0.58, 42, w * 0.3, 18, 9); ctx.fill(); ctx.fillStyle = palette.gold; ctx.beginPath(); ctx.roundRect(w * 0.58, 42, w * 0.3 * output, 18, 9); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(`공급 전력 · ${qualitativeLevel(output, 0, 1)}`, w * 0.73, 84);
    const litCount = Math.floor(output * 4 + 1e-6);
    this.badge(ctx, w / 2, h - 92, `${s.coilTurns}회 코일 · 전압 ${qualitativeLevel(Math.abs(voltage), 0, 12)} · 점등 ${litCount}/4 · 손을 멈추면 꺼져요`);
  }

  private transformerLab(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number): void {
    const left = this.pixel({ x: 0.34, y: 0.48 }, w, h); const right = this.pixel({ x: 0.66, y: 0.48 }, w, h); const coreLeft = left.x - 42; const coreRight = right.x + 42;
    ctx.strokeStyle = "#68778b"; ctx.lineWidth = 30; ctx.beginPath(); ctx.roundRect(coreLeft, left.y - 135, coreRight - coreLeft, 270, 18); ctx.stroke();
    const drawCoil = (x: number, turns: number, color: string): void => { ctx.strokeStyle = color; ctx.lineWidth = 6; const count = Math.round(5 + (turns - 20) / 140 * 7); for (let index = 0; index < count; index += 1) { const y = left.y - 92 + index * 184 / Math.max(1, count - 1); ctx.beginPath(); ctx.ellipse(x, y, 52, 15, 0, 0, TAU); ctx.stroke(); } };
    drawCoil(left.x, 80, palette.gold); drawCoil(right.x, s.secondaryTurns, palette.purple);
    const pulse = wrappedPhase(time * (0.35 + s.level * 0.15));
    ctx.save(); ctx.strokeStyle = this.withAlpha(palette.magnetic, 0.58); ctx.lineWidth = 4; ctx.setLineDash([12, 9]); ctx.lineDashOffset = -time * 28; ctx.beginPath(); ctx.roundRect(coreLeft, left.y - 135, coreRight - coreLeft, 270, 18); ctx.stroke(); ctx.restore();
    const pulseX = coreLeft + (coreRight - coreLeft) * pulse; this.radialGlow(ctx, { x: pulseX, y: left.y - 135 }, palette.magnetic, 28, 0.32);
    this.miniTag(ctx, left.x, left.y - 158, "1차 코일 · 교류 입력", palette.gold); this.miniTag(ctx, right.x, right.y - 158, `2차 ${s.secondaryTurns}회 · 전압 ${qualitativeLevel(s.measurement.value, 0, 18)}`, palette.purple);
    const robotBase = this.pixel({ x: 0.86, y: 0.55 }, w, h); const outputVoltage = s.measurement.value; const targetVoltage = s.applianceTargetVoltage;
    const tolerance = Math.max(0.6, targetVoltage * 0.1); const ready = Math.abs(outputVoltage - targetVoltage) <= tolerance; const overload = outputVoltage > targetVoltage + tolerance;
    const deviceName = targetVoltage === 6 ? "LED" : targetVoltage === 9 ? "라디오" : "로봇"; const shake = overload ? Math.sin(time * 34) * 5 : 0; const robot = { x: robotBase.x + shake, y: robotBase.y };
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(right.x + 54, right.y - 70); ctx.lineTo(robot.x - 48, robot.y - 46); ctx.moveTo(right.x + 54, right.y + 70); ctx.lineTo(robot.x - 48, robot.y + 46); ctx.stroke();
    ctx.save(); ctx.shadowColor = ready ? palette.field : overload ? palette.positive : palette.muted; ctx.shadowBlur = ready ? 30 : overload ? 20 : 0;
    ctx.fillStyle = ready ? "#dff8ee" : overload ? "#ffe3dc" : "#e8edf4"; ctx.strokeStyle = ready ? palette.field : overload ? palette.positive : palette.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(robot.x - 62, robot.y - 82, 124, 164, 18); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = ready ? palette.field : overload ? palette.positive : palette.muted; ctx.font = "900 34px system-ui"; ctx.textAlign = "center";
    ctx.fillText(targetVoltage === 6 ? "LED" : targetVoltage === 9 ? "♫" : "R", robot.x, robot.y - 20);
    ctx.fillStyle = palette.ink; ctx.font = "800 17px system-ui"; ctx.fillText(deviceName, robot.x, robot.y + 16);
    ctx.fillStyle = ready ? palette.field : overload ? palette.positive : palette.muted; ctx.beginPath(); ctx.arc(robot.x, robot.y + 48, 10, 0, TAU); ctx.fill();
    this.miniTag(ctx, robot.x, robot.y + 108, `${ready ? "정상 작동" : overload ? "과전압" : "전압 부족"}`, ready ? palette.field : overload ? palette.positive : palette.muted);
    const trackLeft = this.pixel({ x: TRANSFORMER_TRACK.minX, y: 0.78 }, w, h); const trackRight = this.pixel({ x: TRANSFORMER_TRACK.maxX, y: 0.78 }, w, h); const handle = this.pixel(s.probe, w, h);
    ctx.strokeStyle = palette.purple; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(trackLeft.x, trackLeft.y); ctx.lineTo(trackRight.x, trackRight.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(handle.x, trackLeft.y, 11, 0, TAU); ctx.fill(); ctx.stroke(); this.miniTag(ctx, handle.x, trackLeft.y + 27, "2차 감은 수", palette.purple);
    this.badge(ctx, w / 2, 46, `${deviceName} · 출력이 ${ready ? "알맞아요" : overload ? "너무 높아요" : "너무 낮아요"}`);
  }

  private sandbox(ctx: CanvasRenderingContext2D, s: ElectromagnetismSnapshot, w: number, h: number, time: number, selectedId: string | null, wiring: boolean, wireStart: SandboxWireEndpoint | null): void {
    if (s.sandboxObjects.length === 0) {
      ctx.fillStyle = palette.muted; ctx.font = "600 20px system-ui"; ctx.textAlign = "center";
      ctx.fillText("위 팔레트에서 전하·회로·자석·코일을 추가해 보세요.", w / 2, h / 2);
    }
    const byId = new Map(s.sandboxObjects.map((object) => [object.id, object]));
    const currentById = new Map(s.sandboxCurrents.map((entry) => [entry.objectId, entry.current]));
    for (const region of s.sandboxObjects.filter((object) => object.kind === "field-region")) this.sandboxObject(ctx, region, w, h, 0, region.id === selectedId, time);
    this.fieldLines(ctx, s.magneticFieldLines, w, h, time, palette.magnetic, 0.24, 14, false);
    for (const wire of s.sandboxObjects.filter((object) => object.kind === "current-wire")) {
      const center = this.pixel(wire.position, w, h); const direction = Math.sign(wire.value || 1); const strength = Math.min(1, Math.abs(wire.value) / 9);
      for (const radius of [46, 72, 100, 132]) this.magneticRing(ctx, center, radius, direction, time, strength);
    }
    for (const connection of s.sandboxConnections) {
      const from = byId.get(connection.from); const to = byId.get(connection.to);
      const fromCurrent = currentById.get(connection.from) ?? 0; const toCurrent = currentById.get(connection.to) ?? 0;
      const connectionCurrent = Math.abs(fromCurrent) >= Math.abs(toCurrent) ? fromCurrent : toCurrent;
      const value = connection.kind === "wire" ? connectionCurrent : s.sandboxMetrics.inducedVoltage;
      if (from && to && (connection.kind === "wire" || Math.abs(value) > 0.02)) {
        const fromPoint = connection.kind === "wire" ? this.sandboxTerminalPoint(from, connection.fromTerminal, w, h) : this.connectionPoint(from, to, w, h);
        const toPoint = connection.kind === "wire" ? this.sandboxTerminalPoint(to, connection.toTerminal, w, h) : this.connectionPoint(to, from, w, h);
        this.animatedConnection(ctx, fromPoint, toPoint, connection.kind, time, value);
      }
    }
    this.fieldLines(ctx, s.fieldLines, w, h, time, palette.field, 0.16, 12, false);
    const maxField = Math.max(...s.fieldSamples.map((sample) => Math.hypot(sample.vector.x, sample.vector.y)), 1);
    for (const sample of s.fieldSamples) {
      const magnitude = Math.hypot(sample.vector.x, sample.vector.y);
      if (magnitude > 0) this.fieldVector(ctx, this.pixel(sample.point, w, h), sample.vector, magnitude / maxField, 0.46);
    }
    for (const object of s.sandboxObjects.filter((candidate) => candidate.kind !== "field-region")) this.sandboxObject(ctx, object, w, h, currentById.get(object.id) ?? 0, object.id === selectedId, time);
    for (const object of s.sandboxObjects.filter((candidate) => isElectromagnetismWireConnectable(candidate.kind))) {
      for (const terminal of sandboxTerminals(object.kind)) {
        const endpoint = { objectId: object.id, terminal };
        const state = !wiring ? "idle" : wireStart ? sandboxWireTargetState(wireStart, endpoint, s.sandboxConnections) : "available";
        this.sandboxTerminal(ctx, object, terminal, w, h, state);
      }
    }
    for (const force of s.sandboxForces) {
      const object = byId.get(force.objectId); if (!object) continue;
      const magnitude = Math.hypot(force.vector.x, force.vector.y);
      if (magnitude > 1e-9) this.arrow(ctx, this.pixel(object.position, w, h), force.vector, palette.positive, object.id === selectedId ? object.kind === "charge" ? "로런츠 힘" : "자기력" : "", Math.min(104, 32 + magnitude * 24));
    }
    const probe = s.sandboxObjects.find((object) => object.kind === "probe");
    if (probe) this.arrow(ctx, this.pixel(probe.position, w, h), s.sandboxMetrics.electricField, palette.field, "전기장", Math.min(90, 20 + Math.log10(1 + Math.hypot(s.sandboxMetrics.electricField.x, s.sandboxMetrics.electricField.y)) * 8));
    if (probe && Math.abs(s.sandboxMetrics.magneticFieldZ) > 0.01) {
      const probePoint = this.pixel(probe.position, w, h);
      this.badge(ctx, probePoint.x, probePoint.y - 54, `${s.sandboxMetrics.magneticFieldZ >= 0 ? "⊙" : "⊗"} 수직 자기장`);
    } else if (probe && Math.hypot(s.sandboxMetrics.magneticField.x, s.sandboxMetrics.magneticField.y) > 0) this.arrow(ctx, this.pixel(probe.position, w, h), s.sandboxMetrics.magneticField, palette.magnetic, "자기장", 74);
    if (Math.abs(s.sandboxMetrics.current) > 0) {
      const inducedOnly = !s.sandboxObjects.some((object) => object.kind === "battery") && Math.abs(s.sandboxMetrics.inducedVoltage) > 0;
      const generatorOnly = !s.sandboxObjects.some((object) => object.kind === "battery") && s.sandboxObjects.some((object) => object.kind === "generator" && object.enabled !== false);
      const arrangement = generatorOnly ? "발전기 회로" : { none: "", single: "전지 1개", series: "전지 직렬", parallel: "전지 병렬", mixed: "혼합 회로" }[s.sandboxMetrics.batteryArrangement];
      this.badge(ctx, w / 2, 54, inducedOnly ? "유도 전류가 흘러요" : `${arrangement} · 전류가 흘러요`);
    }
    else if (s.sandboxConnections.some((item) => item.kind === "induction")) this.badge(ctx, w / 2, 54, "유도 전압이 생겼어요");
  }

  private sandboxObject(ctx: CanvasRenderingContext2D, object: ElectromagnetismSandboxObject, w: number, h: number, current: number, selected: boolean, time = 0): void {
    const point = this.pixel(object.position, w, h);
    if (object.kind === "charge" && (object.trail?.length ?? 0) > 1) {
      ctx.save(); ctx.strokeStyle = this.withAlpha(palette.purple, 0.68); ctx.lineWidth = 3; ctx.beginPath();
      object.trail!.forEach((trailPoint, index) => { const pixel = this.pixel(trailPoint, w, h); if (index === 0) ctx.moveTo(pixel.x, pixel.y); else ctx.lineTo(pixel.x, pixel.y); });
      ctx.stroke(); ctx.restore();
    }
    if (selected && object.kind !== "field-region") {
      const radius = object.kind === "magnet" || object.kind === "coil" || object.kind === "motor" || object.kind === "generator" || object.kind === "transformer" ? 62 : 48;
      this.radialGlow(ctx, point, palette.negative, radius + 16, 0.08);
      ctx.save(); ctx.strokeStyle = "rgba(91,124,250,.66)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (object.kind === "charge") {
      const positive = object.value >= 0;
      const radius = 20 + Math.sqrt(Math.abs(object.value) / 1e-6) * 5;
      this.charge(ctx, point, positive ? 1 : -1, selected ? positive ? "+ 양전하" : "− 음전하" : "", radius);
      if (selected) {
        const handle = this.pixel(sandboxVelocityHandle(object), w, h);
        this.arrow(ctx, point, { x: handle.x - point.x, y: handle.y - point.y }, palette.purple, "", Math.hypot(handle.x - point.x, handle.y - point.y));
        ctx.fillStyle = "#fff"; ctx.strokeStyle = palette.purple; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(handle.x, handle.y, 9, 0, TAU); ctx.fill(); ctx.stroke();
        this.miniTag(ctx, handle.x, handle.y - 20, object.moving ? "운동 중" : "방향 조절", palette.purple);
      }
    }
    else if (object.kind === "battery") this.batterySymbol(ctx, point, object.value, object.direction ?? 1, selected);
    else if (object.kind === "resistor") {
      this.resistorSymbol(ctx, point.x - 54, point.x + 54, point.y, palette.purple, 4, resistorZigzagCount(object.value));
      if (selected) this.miniTag(ctx, point.x, point.y + 32, `저항 · ${qualitativeLevel(object.value, 2, 20, ["작음", "보통", "큼"])}`, palette.purple);
    }
    else if (object.kind === "bulb") {
      const power = sandboxBulbPower(current, object.value); const brightness = sandboxBulbBrightness(current, object.value); const lit = brightness > 0.01;
      ctx.save(); ctx.shadowColor = palette.gold; ctx.shadowBlur = lit ? 10 + brightness * 54 : 0;
      const glass = ctx.createRadialGradient(point.x - 9, point.y - 12, 3, point.x, point.y, 31);
      glass.addColorStop(0, lit ? `rgba(255,251,218,${0.72 + brightness * 0.28})` : "#ffffff"); glass.addColorStop(0.62, lit ? `rgba(255,213,92,${0.3 + brightness * 0.7})` : "#f7fafc"); glass.addColorStop(1, lit ? `rgba(243,175,47,${0.28 + brightness * 0.72})` : "#dfe6ef");
      ctx.fillStyle = glass; ctx.strokeStyle = "rgba(34,50,74,.72)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(point.x, point.y - 5, 28, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = lit ? "#b56b18" : palette.muted; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(point.x - 11, point.y - 2); ctx.lineTo(point.x - 5, point.y + 8); ctx.quadraticCurveTo(point.x, point.y + 1, point.x + 5, point.y + 8); ctx.lineTo(point.x + 11, point.y - 2); ctx.stroke();
      ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.roundRect(point.x - 15, point.y + 21, 30, 14, 4); ctx.fill();
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(point.x - 42, point.y + 20); ctx.lineTo(point.x - 15, point.y + 26); ctx.moveTo(point.x + 15, point.y + 26); ctx.lineTo(point.x + 42, point.y + 20); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; for (const y of [25, 30]) { ctx.beginPath(); ctx.moveTo(point.x - 11, point.y + y - 5); ctx.lineTo(point.x + 11, point.y + y - 5); ctx.stroke(); }
      if (selected || lit) this.miniTag(ctx, point.x, point.y + 58, lit ? `전구 · ${qualitativeLevel(brightness, 0, 1, ["어두움", "보통", "밝음"])}` : "전구 꺼짐", palette.gold);
    }
    else if (object.kind === "switch") {
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(point.x - 34, point.y + 8); ctx.lineTo(point.x - 14, point.y + 8); ctx.moveTo(point.x + 14, point.y + 8); ctx.lineTo(point.x + 34, point.y + 8); ctx.stroke();
      ctx.fillStyle = palette.ink; for (const x of [point.x - 14, point.x + 14]) { ctx.beginPath(); ctx.arc(x, point.y + 8, 5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = object.enabled === false ? palette.positive : palette.field; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(point.x - 14, point.y + 6); ctx.lineTo(point.x + 12, object.enabled === false ? point.y - 18 : point.y + 6); ctx.stroke();
      if (selected) this.miniTag(ctx, point.x, point.y + 38, object.enabled === false ? "열림" : "닫힘", object.enabled === false ? palette.positive : palette.field);
    }
    else if (object.kind === "capacitor") {
      const gap = 16 + object.value * 3.2; const voltage = object.secondaryValue ?? 0;
      const leftPlate = point.x - gap / 2; const rightPlate = point.x + gap / 2;
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(point.x - 50, point.y); ctx.lineTo(leftPlate, point.y); ctx.moveTo(rightPlate, point.y); ctx.lineTo(point.x + 50, point.y); ctx.stroke();
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(leftPlate, point.y - 38); ctx.lineTo(leftPlate, point.y + 38); ctx.moveTo(rightPlate, point.y - 38); ctx.lineTo(rightPlate, point.y + 38); ctx.stroke();
      if (Math.abs(voltage) > 0.05) for (const offset of [-22, 0, 22]) this.arrow(ctx, { x: voltage >= 0 ? leftPlate + 7 : rightPlate - 7, y: point.y + offset }, { x: voltage >= 0 ? 1 : -1, y: 0 }, palette.field, "", Math.max(8, gap - 14));
      ctx.fillStyle = voltage >= 0 ? palette.positive : palette.negative; ctx.font = "800 18px system-ui"; ctx.textAlign = "center"; ctx.fillText(voltage >= 0 ? "+" : "−", leftPlate - 14, point.y + 6);
      ctx.fillStyle = voltage >= 0 ? palette.negative : palette.positive; ctx.fillText(voltage >= 0 ? "−" : "+", rightPlate + 14, point.y + 6);
      if (selected) this.miniTag(ctx, point.x, point.y + 58, `판 간격 ${qualitativeLevel(object.value, 1, 10, ["좁음", "보통", "넓음"])} · ${Math.abs(voltage) > 0.05 ? "충전됨" : "비어 있음"}`, palette.field);
    }
    else if (object.kind === "current-wire") {
      ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.arc(point.x, point.y, 29, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 25px system-ui"; ctx.textAlign = "center"; ctx.fillText(object.value >= 0 ? "⊙" : "⊗", point.x, point.y + 8);
      if (selected) this.miniTag(ctx, point.x, point.y + 46, `전류 · ${qualitativeLevel(Math.abs(object.value), 0, 9)}`, palette.magnetic);
    }
    else if (object.kind === "field-region") this.magneticFieldRegion(ctx, point, object.value, selected);
    else if (object.kind === "magnet") this.barMagnet(ctx, point, 48, 27, object.direction ?? 1);
    else if (object.kind === "coil") this.sandboxCoil(ctx, point, object, current, selected);
    else if (object.kind === "iron-load") {
      const size = 34 + object.value * 7; ctx.fillStyle = "#8793a5"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(point.x - size / 2, point.y - size / 2, size, size, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "800 15px system-ui"; ctx.textAlign = "center"; ctx.fillText("철", point.x, point.y + 5);
      if (selected) this.miniTag(ctx, point.x, point.y + size / 2 + 22, ["", "가벼움", "보통", "무거움"][Math.round(object.value)] ?? "철제 짐", palette.muted);
    }
    else if (object.kind === "motor") {
      ctx.fillStyle = "#dce6f3"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(point.x, point.y, 39, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(time * Math.min(12, Math.abs(current) * 4) * Math.sign(current || 1)); ctx.strokeStyle = palette.purple; ctx.lineWidth = 7;
      for (let blade = 0; blade < 3; blade += 1) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke(); } ctx.restore();
      this.miniTag(ctx, point.x, point.y + 58, Math.abs(current) > 0.01 ? "전동기 회전 중" : "전동기 멈춤", Math.abs(current) > 0.01 ? palette.purple : palette.muted);
    }
    else if (object.kind === "generator") {
      ctx.fillStyle = object.enabled === false ? "#e8edf4" : "#fff3c9"; ctx.strokeStyle = object.enabled === false ? palette.muted : palette.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(point.x, point.y, 39, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(object.enabled === false ? 0 : time * 6); ctx.strokeStyle = palette.positive; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke(); ctx.restore();
      this.miniTag(ctx, point.x, point.y + 58, object.enabled === false ? "발전기 멈춤" : "발전 중", object.enabled === false ? palette.muted : palette.gold);
    }
    else if (object.kind === "transformer") {
      ctx.strokeStyle = "#68778b"; ctx.lineWidth = 12; ctx.beginPath(); ctx.roundRect(point.x - 58, point.y - 42, 116, 84, 10); ctx.stroke();
      ctx.strokeStyle = palette.gold; ctx.lineWidth = 4; for (let index = 0; index < 5; index += 1) { ctx.beginPath(); ctx.ellipse(point.x - 35, point.y - 28 + index * 14, 18, 7, 0, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = palette.purple; const turns = Math.round(3 + object.value / 40); for (let index = 0; index < turns; index += 1) { ctx.beginPath(); ctx.ellipse(point.x + 35, point.y - 28 + index * 56 / Math.max(1, turns - 1), 18, 7, 0, 0, TAU); ctx.stroke(); }
      this.miniTag(ctx, point.x, point.y + 62, `1차 80회 · 2차 ${Math.round(object.value)}회`, palette.purple);
    }
    else this.probe(ctx, point, palette.field, selected ? "탐침" : "");
  }

  private magneticFieldRegion(ctx: CanvasRenderingContext2D, point: Vector2, value: number, selected: boolean): void {
    const outward = value >= 0; const strength = Math.min(1, Math.abs(value) / 1.5);
    ctx.save();
    const gradient = ctx.createRadialGradient(point.x, point.y, 18, point.x, point.y, 118);
    gradient.addColorStop(0, `rgba(43,155,181,${0.12 + strength * 0.08})`); gradient.addColorStop(1, "rgba(43,155,181,0)");
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(point.x, point.y, 118, 86, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(43,155,181,${selected ? 0.72 : 0.28})`; ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(point.x, point.y, 108, 76, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = this.withAlpha(palette.magnetic, 0.82); ctx.strokeStyle = this.withAlpha(palette.magnetic, 0.82); ctx.lineWidth = 1.8;
    for (let row = -1; row <= 1; row += 1) for (let column = -2; column <= 2; column += 1) {
      const x = point.x + column * 37; const y = point.y + row * 34;
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.stroke();
      if (outward) { ctx.beginPath(); ctx.arc(x, y, 2.1, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x - 3.2, y - 3.2); ctx.lineTo(x + 3.2, y + 3.2); ctx.moveTo(x + 3.2, y - 3.2); ctx.lineTo(x - 3.2, y + 3.2); ctx.stroke(); }
    }
    ctx.restore();
    this.miniTag(ctx, point.x - 68, point.y - 69, outward ? "⊙ 화면 밖" : "⊗ 화면 안", palette.magnetic);
  }

  private sandboxCoil(ctx: CanvasRenderingContext2D, point: Vector2, object: ElectromagnetismSandboxObject, current: number, selected: boolean): void {
    const energized = Math.abs(current) > 1e-6; const strength = Math.min(1, Math.abs(current));
    ctx.save();
    if (energized) { ctx.shadowColor = palette.magnetic; ctx.shadowBlur = 18 + strength * 20; }
    ctx.fillStyle = energized ? "rgba(43,155,181,.18)" : "rgba(34,50,74,.07)";
    ctx.beginPath(); ctx.roundRect(point.x - 54, point.y - 16, 108, 32, 9); ctx.fill();
    ctx.strokeStyle = "#d79334"; ctx.lineWidth = 5;
    for (let index = 0; index < 8; index += 1) { ctx.beginPath(); ctx.ellipse(point.x - 43 + index * 12, point.y, 12, 31, 0, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,222,154,.82)"; ctx.lineWidth = 1.5;
    for (let index = 0; index < 8; index += 1) { ctx.beginPath(); ctx.ellipse(point.x - 44 + index * 12, point.y - 1, 9, 27, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(point.x - 72, point.y + 28); ctx.lineTo(point.x - 48, point.y + 18); ctx.moveTo(point.x + 48, point.y + 18); ctx.lineTo(point.x + 72, point.y + 28); ctx.stroke();
    if (energized) {
      const leftNorth = current > 0;
      this.miniTag(ctx, point.x - 42, point.y - 42, leftNorth ? "N" : "S", leftNorth ? palette.positive : palette.negative);
      this.miniTag(ctx, point.x + 42, point.y - 42, leftNorth ? "S" : "N", leftNorth ? palette.negative : palette.positive);
    }
    ctx.restore();
    if (energized) this.miniTag(ctx, point.x, point.y + 51, "전자석 · 전류 흐름", palette.magnetic);
    else if (selected) this.miniTag(ctx, point.x, point.y + 51, `${Math.round(object.value)}회 코일`, palette.gold);
  }

  private fieldVector(ctx: CanvasRenderingContext2D, origin: Vector2, vector: Vector2, intensity: number, opacityScale = 1): void {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude < 1e-9) return;
    const strength = Math.sqrt(Math.max(0, Math.min(1, intensity)));
    const length = 12 + strength * 12;
    const dx = vector.x / magnitude; const dy = vector.y / magnitude;
    const start = { x: origin.x - dx * length * 0.35, y: origin.y - dy * length * 0.35 };
    const end = { x: origin.x + dx * length * 0.65, y: origin.y + dy * length * 0.65 };
    const angle = Math.atan2(dy, dx); const head = 4 + strength;
    ctx.save();
    ctx.strokeStyle = `rgba(37,167,122,${(0.24 + strength * 0.38) * opacityScale})`;
    ctx.lineWidth = 1.4 + strength * 0.5;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x - Math.cos(angle - 0.58) * head, end.y - Math.sin(angle - 0.58) * head);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle + 0.58) * head, end.y - Math.sin(angle + 0.58) * head);
    ctx.stroke();
    ctx.restore();
  }

  private pixel(point: Vector2, width: number, height: number): Vector2 {
    return modelToCanvas(point, width, height);
  }

  private charge(ctx: CanvasRenderingContext2D, point: Vector2, sign: 1 | -1, label: string, radius = 28): void {
    ctx.fillStyle = sign === 1 ? palette.positive : palette.negative;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 28px system-ui"; ctx.textAlign = "center"; ctx.fillText(sign === 1 ? "+" : "−", point.x, point.y + 9);
    this.label(ctx, point.x, point.y + radius + 24, label);
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

  private flowDots(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number, current: number, time: number): void {
    const count = Math.max(5, Math.min(18, Math.round(Math.abs(current) * 6)));
    const speed = 0.08 + Math.min(0.42, Math.abs(current) * 0.16);
    ctx.save(); ctx.shadowColor = palette.positive; ctx.shadowBlur = 8; ctx.fillStyle = palette.positive;
    for (let index = 0; index < count; index += 1) {
      const progress = index / count + time * speed * Math.sign(current || 1);
      const point = rectangularLoopPoint(progress, left, right, top, bottom);
      ctx.beginPath(); ctx.arc(point.x, point.y, 4.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  private radialGlow(ctx: CanvasRenderingContext2D, point: Vector2, color: string, radius: number, opacity: number): void {
    const gradient = ctx.createRadialGradient(point.x, point.y, 8, point.x, point.y, Math.max(10, radius));
    gradient.addColorStop(0, this.withAlpha(color, opacity));
    gradient.addColorStop(1, this.withAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill();
  }

  private distanceTicks(ctx: CanvasRenderingContext2D, a: Vector2, b: Vector2): void {
    const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const nx = -dy / length; const ny = dx / length;
    ctx.save(); ctx.strokeStyle = "rgba(113,128,150,.52)"; ctx.lineWidth = 1;
    for (let distance = 48; distance < length - 32; distance += 48) {
      const x = a.x + dx * distance / length; const y = a.y + dy * distance / length;
      ctx.beginPath(); ctx.moveTo(x - nx * 5, y - ny * 5); ctx.lineTo(x + nx * 5, y + ny * 5); ctx.stroke();
    }
    ctx.restore();
  }

  private magneticRing(ctx: CanvasRenderingContext2D, center: Vector2, radius: number, direction: number, time: number, strength: number): void {
    ctx.save();
    ctx.strokeStyle = `rgba(37,167,122,${0.32 + strength * 0.38})`;
    ctx.lineWidth = 2 + strength * 1.2;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = direction * time * -24;
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (let marker = 0; marker < 6; marker += 1) {
      const angle = direction * time * 0.8 + marker * TAU / 6 + radius * 0.013;
      const point = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
      this.arrow(ctx, point, { x: -Math.sin(angle) * direction, y: Math.cos(angle) * direction }, palette.magnetic, "", 14 + strength * 6);
    }
    ctx.restore();
  }

  private fieldLines(ctx: CanvasRenderingContext2D, lines: readonly FieldLine[], w: number, h: number, time: number, color: string, opacity = 0.42, maxLines = Number.POSITIVE_INFINITY, showPulse = true): void {
    ctx.save();
    ctx.strokeStyle = this.withAlpha(color, opacity);
    ctx.lineWidth = showPulse ? 1.7 : 1.25;
    const stride = Math.max(1, Math.ceil(lines.length / maxLines));
    const visibleLines = lines.filter((_, index) => index % stride === 0).slice(0, maxLines);
    for (const [lineIndex, line] of visibleLines.entries()) {
      if (line.points.length < 2) continue;
      const pixels = line.points.map((point) => this.pixel(point, w, h));
      ctx.beginPath();
      pixels.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
      ctx.stroke();
      for (const ratio of showPulse ? [0.34, 0.68] : [0.55]) {
        const index = Math.min(pixels.length - 2, Math.max(0, Math.floor((pixels.length - 1) * ratio)));
        const point = pixels[index]; const next = pixels[index + 1];
        ctx.save(); this.arrow(ctx, point, { x: next.x - point.x, y: next.y - point.y }, this.withAlpha(color, Math.min(0.72, opacity * 1.8)), "", 11); ctx.restore();
      }
      if (showPulse) {
        const pulseIndex = Math.min(pixels.length - 1, Math.floor(wrappedPhase(time * 0.24 + lineIndex / Math.max(1, visibleLines.length)) * pixels.length));
        const pulse = pixels[pulseIndex];
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 2.7, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  private barMagnetFieldLines(ctx: CanvasRenderingContext2D, center: Vector2, time: number, halfWidth: number, strength: number): void {
    ctx.save();
    ctx.strokeStyle = this.withAlpha(palette.magnetic, 0.28 + strength * 0.38);
    ctx.lineWidth = 1.5 + strength;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -time * 20;
    for (const offset of [30, 48, 70, 94]) {
      const spread = offset * (halfWidth / 48);
      for (const direction of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(center.x - halfWidth, center.y);
        ctx.bezierCurveTo(center.x - halfWidth - spread * 0.5, center.y + direction * spread, center.x + halfWidth + spread * 0.5, center.y + direction * spread, center.x + halfWidth, center.y);
        ctx.stroke();
        this.arrow(ctx, { x: center.x - 5, y: center.y + direction * spread * 0.75 }, { x: 1, y: 0 }, palette.magnetic, "", 14);
      }
    }
    ctx.restore();
  }

  private barMagnet(ctx: CanvasRenderingContext2D, center: Vector2, halfWidth: number, halfHeight: number, direction: 1 | -1 = 1): void {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(center.x - halfWidth, center.y - halfHeight, halfWidth * 2, halfHeight * 2, 9); ctx.clip();
    ctx.fillStyle = direction === 1 ? palette.positive : palette.negative; ctx.fillRect(center.x - halfWidth, center.y - halfHeight, halfWidth, halfHeight * 2);
    ctx.fillStyle = direction === 1 ? palette.negative : palette.positive; ctx.fillRect(center.x, center.y - halfHeight, halfWidth, halfHeight * 2);
    ctx.restore();
    ctx.strokeStyle = "rgba(34,50,74,.48)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(center.x - halfWidth, center.y - halfHeight, halfWidth * 2, halfHeight * 2, 9); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "800 20px system-ui"; ctx.textAlign = "center";
    ctx.fillText(direction === 1 ? "N" : "S", center.x - halfWidth / 2, center.y + 7);
    ctx.fillText(direction === 1 ? "S" : "N", center.x + halfWidth / 2, center.y + 7);
  }

  private fluxLines(ctx: CanvasRenderingContext2D, magnet: Vector2, coil: Vector2, time: number, voltage: number, strength: number): void {
    const direction = Math.sign(voltage || 1);
    ctx.save();
    ctx.strokeStyle = `rgba(91,124,250,${0.16 + strength * 0.34})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -direction * time * 30;
    for (const offset of [-78, -48, -20, 20, 48, 78]) {
      ctx.beginPath();
      ctx.moveTo(magnet.x - 58, magnet.y + offset * 0.34);
      ctx.bezierCurveTo((magnet.x + coil.x) / 2, magnet.y + offset, (magnet.x + coil.x) / 2, coil.y + offset, coil.x + 65, coil.y + offset * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private inductionMeter(ctx: CanvasRenderingContext2D, x: number, y: number, voltage: number): void {
    const radius = 44;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = palette.grid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 7, 28, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    const angle = -Math.PI / 2 + Math.max(-1, Math.min(1, voltage / 15)) * 0.9;
    ctx.strokeStyle = voltage >= 0 ? palette.positive : palette.negative; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + Math.cos(angle) * 25, y + 7 + Math.sin(angle) * 25); ctx.stroke();
    ctx.fillStyle = palette.ink; ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("유도 전압", x, y + 32);
    ctx.restore();
  }

  private sandboxTerminalPoint(object: ElectromagnetismSandboxObject, terminal: SandboxTerminal, w: number, h: number): Vector2 {
    const center = this.pixel(object.position, w, h); const side = terminal === "a" ? -1 : 1;
    if (object.kind === "transformer") {
      const left = terminal === "a" || terminal === "b"; const top = terminal === "a" || terminal === "c";
      return { x: center.x + (left ? -72 : 72), y: center.y + (top ? -29 : 29) };
    }
    if (object.kind === "resistor") return { x: center.x + side * 54, y: center.y };
    if (object.kind === "battery") return { x: center.x + side * 52, y: center.y };
    if (object.kind === "capacitor") return { x: center.x + side * 50, y: center.y };
    if (object.kind === "bulb") return { x: center.x + side * 42, y: center.y + 20 };
    if (object.kind === "switch") return { x: center.x + side * 34, y: center.y + 8 };
    if (object.kind === "coil") return { x: center.x + side * 72, y: center.y + 28 };
    if (object.kind === "motor" || object.kind === "generator") return { x: center.x + side * 52, y: center.y + 18 };
    return { x: center.x + side * 42, y: center.y };
  }

  private sandboxTerminal(ctx: CanvasRenderingContext2D, object: ElectromagnetismSandboxObject, terminal: SandboxTerminal, w: number, h: number, state: "idle" | "available" | "active" | "same-object" | "duplicate"): void {
    const point = this.sandboxTerminalPoint(object, terminal, w, h);
    const unavailable = state === "same-object" || state === "duplicate";
    const active = state === "active";
    const available = state === "available";
    ctx.save();
    ctx.fillStyle = active ? palette.positive : available ? "#edf2ff" : unavailable ? "#edf0f4" : "#fff";
    ctx.strokeStyle = active ? palette.positive : available ? palette.negative : unavailable ? "#9aa6b5" : palette.ink;
    ctx.lineWidth = active || available ? 3 : 2;
    ctx.shadowColor = active ? palette.positive : palette.negative;
    ctx.shadowBlur = active ? 16 : available ? 9 : 0;
    ctx.globalAlpha = unavailable ? 0.6 : 1;
    ctx.beginPath(); ctx.arc(point.x, point.y, active || available ? 7 : 5, 0, TAU); ctx.fill(); ctx.stroke();
    if (unavailable) {
      ctx.beginPath(); ctx.moveTo(point.x - 4, point.y - 4); ctx.lineTo(point.x + 4, point.y + 4); ctx.stroke();
    }
    ctx.restore();
  }

  private batterySymbol(ctx: CanvasRenderingContext2D, point: Vector2, voltage: number, direction: 1 | -1, selected: boolean): void {
    const leftLong = direction === -1;
    ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(point.x - 52, point.y); ctx.lineTo(point.x - 10, point.y); ctx.moveTo(point.x + 10, point.y); ctx.lineTo(point.x + 52, point.y); ctx.stroke();
    ctx.strokeStyle = palette.positive; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(point.x + (leftLong ? -7 : 7), point.y - 24); ctx.lineTo(point.x + (leftLong ? -7 : 7), point.y + 24); ctx.stroke();
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(point.x + (leftLong ? 7 : -7), point.y - 14); ctx.lineTo(point.x + (leftLong ? 7 : -7), point.y + 14); ctx.stroke();
    ctx.fillStyle = palette.positive; ctx.font = "800 16px system-ui"; ctx.textAlign = "center";
    ctx.fillText("+", point.x + direction * 30, point.y - 12); ctx.fillStyle = palette.ink; ctx.fillText("−", point.x - direction * 30, point.y - 12);
    ctx.restore();
    this.miniTag(ctx, point.x, point.y + 38, `전지 · ${qualitativeLevel(Math.abs(voltage), 1, 12)}`, selected ? palette.positive : palette.ink);
  }

  private connectionPoint(object: ElectromagnetismSandboxObject, toward: ElectromagnetismSandboxObject, w: number, h: number): Vector2 {
    const center = this.pixel(object.position, w, h); const target = this.pixel(toward.position, w, h);
    if (object.kind === "coil") return { x: center.x + (target.x < center.x ? -72 : 72), y: center.y + 28 };
    const dx = target.x - center.x; const dy = target.y - center.y; const distance = Math.max(1, Math.hypot(dx, dy));
    const radius = object.kind === "resistor" ? 54 : object.kind === "capacitor" ? 50 : object.kind === "battery" ? 44 : object.kind === "bulb" ? 32 : 38;
    return { x: center.x + dx / distance * radius, y: center.y + dy / distance * radius };
  }

  private animatedConnection(ctx: CanvasRenderingContext2D, a: Vector2, b: Vector2, kind: "wire" | "induction", time: number, value: number): void {
    const color = kind === "wire" ? palette.ink : palette.purple;
    const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.min(kind === "wire" ? 18 : 34, distance * 0.12);
    const control = { x: (a.x + b.x) / 2 - dy / distance * bend, y: (a.y + b.y) / 2 + dx / distance * bend };
    ctx.save(); ctx.strokeStyle = this.withAlpha(color, kind === "wire" ? 0.72 : 0.46); ctx.lineWidth = kind === "wire" ? 3 : 2;
    if (kind === "induction") { ctx.setLineDash([9, 7]); ctx.lineDashOffset = -Math.sign(value || 1) * time * 28; }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(control.x, control.y, b.x, b.y); ctx.stroke();
    if (kind === "wire") {
      ctx.setLineDash([]); ctx.fillStyle = palette.ink;
      for (const terminal of [a, b]) { ctx.beginPath(); ctx.arc(terminal.x, terminal.y, 4, 0, TAU); ctx.fill(); }
    }
    if (kind === "wire" && Math.abs(value) < 1e-9) { ctx.restore(); return; }
    const progress = wrappedPhase(time * (0.2 + Math.min(0.5, Math.abs(value) * 0.15)));
    const inverse = 1 - progress;
    const particle = { x: inverse * inverse * a.x + 2 * inverse * progress * control.x + progress * progress * b.x, y: inverse * inverse * a.y + 2 * inverse * progress * control.y + progress * progress * b.y };
    ctx.shadowColor = color; ctx.shadowBlur = 9; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(particle.x, particle.y, kind === "wire" ? 4 : 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  private confetti(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void {
    const colors = [palette.gold, palette.positive, palette.negative, palette.field, palette.purple];
    ctx.save();
    for (let index = 0; index < 32; index += 1) {
      const cycle = wrappedPhase(time * 0.22 + index * 0.137);
      const x = 24 + (index * 97) % Math.max(48, width - 48) + Math.sin(time * 2 + index) * 12;
      const y = -20 + cycle * (height + 40);
      ctx.translate(x, y); ctx.rotate(time * 2 + index);
      ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(-4, -7, 8, 14);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  private withAlpha(color: string, alpha: number): string {
    if (/^#[\da-f]{6}$/i.test(color)) {
      const red = Number.parseInt(color.slice(1, 3), 16);
      const green = Number.parseInt(color.slice(3, 5), 16);
      const blue = Number.parseInt(color.slice(5, 7), 16);
      return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha))})`;
    }
    return color;
  }

  private block(ctx: CanvasRenderingContext2D, point: Vector2, label: string, color: string): void {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(point.x - 42, point.y - 26, 84, 52, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, point.x, point.y + 6);
  }

  private resistorSymbol(ctx: CanvasRenderingContext2D, left: number, right: number, y: number, color: string, lineWidth: number, segments = 8): void {
    const lead = Math.min(24, (right - left) * 0.14); const zigzagLeft = left + lead; const zigzagRight = right - lead;
    const segmentWidth = (zigzagRight - zigzagLeft) / segments;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(zigzagLeft, y);
    for (let index = 0; index <= segments; index += 1) {
      const x = zigzagLeft + segmentWidth * index;
      const offset = index === 0 || index === segments ? 0 : index % 2 === 0 ? -12 : 12;
      ctx.lineTo(x, y + offset);
    }
    ctx.lineTo(right, y); ctx.stroke(); ctx.restore();
  }

  private badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.font = "700 15px system-ui"; const width = ctx.measureText(text).width + 24;
    ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = palette.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - width / 2, y - 17, width, 34, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = palette.ink; ctx.textAlign = "center"; ctx.fillText(text, x, y + 5);
  }

  private miniTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
    ctx.save(); ctx.font = "700 11px system-ui";
    const width = ctx.measureText(text).width + 12;
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = this.withAlpha(color, 0.34); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - width / 2, y - 10, width, 20, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, x, y + 4); ctx.restore();
  }

  private label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.fillStyle = palette.ink; ctx.font = "600 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(text, x, y);
  }

}
