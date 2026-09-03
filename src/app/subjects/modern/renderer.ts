import { modernPrimaryHandle, MODERN_WORLD, type ModernDevice, type ModernModel, type ModernSnapshot } from "./models";
import { drawInteractionAffordance, drawLabBackdrop, interactionHitRadius, LAB_CANVAS, type CanvasInteractionAffordance } from "../canvas-theme";

export interface Point { readonly x: number; readonly y: number }

export function modernVisualPhase(animationTime: number, speed = 1, offset = 0): number {
  return ((animationTime * speed + offset) % 1 + 1) % 1;
}

export const modernDeviceAt = (devices: readonly ModernDevice[], point: Point): ModernDevice | undefined =>
  [...devices].reverse().find((item) => hitTest(point, item, 32));
const HANDLE_RADIUS = 18;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function primaryHandle(snapshot: ModernSnapshot): Point | null {
  return modernPrimaryHandle(snapshot);
}

export function modernInteractionAffordance(snapshot: ModernSnapshot): CanvasInteractionAffordance | null {
  switch (snapshot.mode) {
    case "relativity": return { kind: "object", radius: 94 };
    case "photoelectric": return { kind: "object", radius: 43 };
    case "matter-waves": return { kind: "object", radius: 31 };
    case "tunneling": return { kind: "object", radius: 29 };
    case "nuclei": return { kind: "object", radius: 36 };
    case "atoms": return { kind: "handle", axis: "y" };
    case "gravity-spacetime": case "quantum": case "mass-energy": case "semiconductors": return { kind: "handle", axis: "x" };
    case "sandbox": return null;
  }
}

export const hitTest = (point: Point, target: Point, radius = HANDLE_RADIUS): boolean =>
  Math.hypot(point.x - target.x, point.y - target.y) <= radius;

export function graphMarker(snapshot: ModernSnapshot): { x: number; y: number } | null {
  switch (snapshot.mode) {
    case "relativity": return { x: snapshot.speedFraction, y: snapshot.gamma };
    case "gravity-spacetime": return { x: snapshot.gravityStrength, y: snapshot.gravityClockRate * 100 };
    case "atoms": return { x: snapshot.quantumNumber, y: -13.6 / snapshot.quantumNumber ** 2 };
    case "photoelectric": return { x: snapshot.photonFrequency, y: snapshot.electronEnergy };
    case "tunneling": return { x: snapshot.barrierWidth, y: snapshot.transmission };
    case "nuclei": return { x: snapshot.elapsedYears, y: snapshot.remainingNuclei };
    case "mass-energy": return { x: snapshot.massDefect, y: snapshot.releasedEnergyMeV };
    case "semiconductors": return { x: snapshot.voltage, y: snapshot.currentMilliamp };
    case "matter-waves": case "quantum": case "sandbox": return null;
  }
}

export class ModernRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private drag: { type: "primary" } | { type: "device"; id: string } | null = null;
  private animationFrame = 0; private lastTime = 0; private observer: ResizeObserver | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly model: ModernModel, private readonly onChange: () => void) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is required for the modern-physics laboratory.");
    this.ctx = context;
    canvas.addEventListener("pointerdown", this.pointerDown); canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp); canvas.addEventListener("pointercancel", this.pointerUp);
    if (typeof ResizeObserver !== "undefined") { this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); }
    this.resize(); this.animationFrame = requestAnimationFrame(this.animate);
  }
  resize(): void {
    const ratio = Math.max(1, window.devicePixelRatio || 1); const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(Math.max(320, rect.width || 800) * ratio);
    this.canvas.height = Math.round(Math.max(300, rect.height || 520) * ratio);
    this.ctx.setTransform(this.canvas.width / MODERN_WORLD.width, 0, 0, this.canvas.height / MODERN_WORLD.height, 0, 0);
    this.draw(this.model.snapshot());
  }
  destroy(): void {
    cancelAnimationFrame(this.animationFrame); this.observer?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown); this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp); this.canvas.removeEventListener("pointercancel", this.pointerUp);
  }
  private readonly animate = (now: number): void => {
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0; this.lastTime = now;
    this.model.step(dt); this.draw(this.model.snapshot()); this.onChange();
    this.animationFrame = requestAnimationFrame(this.animate);
  };
  private worldPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / Math.max(1, rect.width) * 1000, y: (event.clientY - rect.top) / Math.max(1, rect.height) * 600 };
  }
  private readonly pointerDown = (event: PointerEvent): void => {
    const point = this.worldPoint(event); const snapshot = this.model.snapshot(); const handle = primaryHandle(snapshot);
    if (handle && hitTest(point, handle, this.primaryHitRadius(snapshot))) this.drag = { type: "primary" };
    else if (snapshot.mode === "sandbox") {
      const found = modernDeviceAt(snapshot.devices, point);
      if (found) this.drag = { type: "device", id: found.id };
    }
    if (this.drag) { this.canvas.setPointerCapture(event.pointerId); this.applyDrag(point); }
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    const point = this.worldPoint(event);
    if (this.drag) { this.canvas.style.cursor = "grabbing"; this.applyDrag(point); return; }
    const snapshot = this.model.snapshot();
    if (snapshot.mode === "sandbox") { this.canvas.style.cursor = modernDeviceAt(snapshot.devices, point) ? "grab" : "default"; return; }
    const handle = primaryHandle(snapshot); const affordance = modernInteractionAffordance(snapshot);
    if (!handle || !affordance || !hitTest(point, handle, this.primaryHitRadius(snapshot))) this.canvas.style.cursor = "default";
    else if (affordance.kind === "object") this.canvas.style.cursor = "grab";
    else this.canvas.style.cursor = affordance.axis === "x" ? "ew-resize" : affordance.axis === "y" ? "ns-resize" : "move";
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    if (this.drag && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); this.drag = null; this.canvas.style.cursor = "default";
  };
  private applyDrag(point: Point): void {
    if (this.drag?.type === "primary") this.model.dragPrimary(point.x, point.y);
    if (this.drag?.type === "device") this.model.moveDevice(this.drag.id, point.x, point.y);
    this.draw(this.model.snapshot()); this.onChange();
  }
  private primaryHitRadius(snapshot: ModernSnapshot): number {
    const affordance = modernInteractionAffordance(snapshot);
    const visibleWorldRadius = affordance?.kind === "object" ? affordance.radius : undefined;
    return interactionHitRadius(this.canvas, MODERN_WORLD.width, MODERN_WORLD.height, visibleWorldRadius);
  }

  private draw(snapshot: ModernSnapshot): void {
    const ctx = this.ctx; ctx.clearRect(0, 0, 1000, 600);
    drawLabBackdrop(ctx, MODERN_WORLD.width, MODERN_WORLD.height);
    switch (snapshot.mode) {
      case "relativity": this.relativity(snapshot); break; case "atoms": this.atoms(snapshot); break;
      case "gravity-spacetime": this.gravitySpacetime(snapshot); break;
      case "photoelectric": this.photoelectric(snapshot); break; case "matter-waves": this.matterWaves(snapshot); break;
      case "quantum": this.quantum(snapshot); break; case "tunneling": this.tunneling(snapshot); break;
      case "nuclei": this.nuclei(snapshot); break; case "semiconductors": this.semiconductors(snapshot); break;
      case "mass-energy": this.massEnergy(snapshot); break;
      case "sandbox": this.sandbox(snapshot); break;
    }
    if (!["photoelectric", "relativity", "atoms", "quantum", "nuclei", "semiconductors"].includes(snapshot.mode)) {
      snapshot.devices.forEach((item) => this.device(item));
    }
    const affordance = modernInteractionAffordance(snapshot);
    if (affordance) drawInteractionAffordance(ctx, primaryHandle(snapshot), affordance);
  }
  private relativity(s: ModernSnapshot): void {
    const ctx = this.ctx;
    const earthSeconds = modernVisualPhase(s.animationTime, .14) * 10;
    const shipSeconds = modernVisualPhase(s.animationTime / s.gamma, .14) * 10;
    const earth = s.devices.find((item) => item.id === "earth-clock")!; const ship = s.devices.find((item) => item.id === "ship-clock")!;
    this.clock(earth.x, earth.y, earthSeconds, "지구 시계", "#64748b"); this.clock(ship.x, ship.y, shipSeconds, "우주선 시계 · 느리게", "#168f7a");
    ctx.strokeStyle = "rgba(45,212,191,.55)"; ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(500 + i * 55 / s.gamma, 80); ctx.lineTo(660 + i * 55 / s.gamma, 450); ctx.stroke(); }
    this.label("빠를수록 우주선의 시간 눈금이 벌어져요", 330, 80, LAB_CANVAS.ink);
  }
  private gravitySpacetime(s: ModernSnapshot): void {
    const ctx = this.ctx; const massX = 500; const massY = 300; const bend = 15 + s.gravityStrength * 92;
    ctx.save(); ctx.strokeStyle = "rgba(192,132,252,.42)"; ctx.lineWidth = 2;
    for (let y = 90; y <= 510; y += 42) {
      ctx.beginPath();
      for (let x = 80; x <= 920; x += 10) {
        const distance = Math.abs(x - massX); const warpedY = y + bend * Math.exp(-(distance * distance) / 36000) * Math.sign(massY - y);
        if (x === 80) ctx.moveTo(x, warpedY); else ctx.lineTo(x, warpedY);
      }
      ctx.stroke();
    }
    for (let x = 80; x <= 920; x += 42) { ctx.beginPath(); ctx.moveTo(x, 80); ctx.quadraticCurveTo(massX, 300 + Math.sign(x - massX) * bend * .4, x, 520); ctx.stroke(); }
    ctx.restore();
    const farSeconds = modernVisualPhase(s.animationTime, .14) * 10;
    const nearSeconds = modernVisualPhase(s.animationTime * s.gravityClockRate, .14) * 10;
    this.clock(265, 280, nearSeconds, "가까운 시계 · 느리게", "#8157ba");
    this.clock(835, 280, farSeconds, "먼 시계", "#64748b");
    this.label("질량이 시공간을 휘게 해요", 375, 65, "#6d499e");
  }
  private clock(x: number, y: number, seconds: number, text: string, color: string): void {
    const ctx = this.ctx; ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 84, 0, Math.PI * 2); ctx.stroke();
    const angle = seconds / 10 * Math.PI * 2 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * 58, y + Math.sin(angle) * 58); ctx.stroke(); this.label(text, x - 70, y + 125, color);
  }
  private atoms(s: ModernSnapshot): void {
    const ctx = this.ctx; for (let n = 1; n <= 6; n += 1) {
      const energy = -13.6 / n ** 2; const y = 430 - (energy + 13.6) / 13.6 * 300;
      ctx.strokeStyle = n === s.quantumNumber ? "#a78bfa" : "rgba(196,181,253,.42)"; ctx.lineWidth = n === s.quantumNumber ? 7 : 3;
      ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(720, y); ctx.stroke();
    }
    const fromY = 430 - ((-13.6 / s.quantumNumber ** 2) + 13.6) / 13.6 * 300;
    ctx.strokeStyle = "#facc15"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(470, fromY); ctx.lineTo(470, 430); ctx.stroke();
    ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(470, 440); ctx.lineTo(458, 418); ctx.lineTo(482, 418); ctx.closePath(); ctx.fill();
    const photonProgress = modernVisualPhase(s.animationTime, .62);
    const photonY = fromY + (430 - fromY) * photonProgress;
    ctx.save(); ctx.fillStyle = "#fff4a3"; ctx.shadowColor = "#facc15"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(470, photonY, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    this.energyLevelLegend(s);
  }

  private energyLevelLegend(snapshot: ModernSnapshot): void {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(320, bounds.width || 800);
    const height = Math.max(192, bounds.height || 480);
    const densityX = this.canvas.width / width;
    const densityY = this.canvas.height / height;
    const cardWidth = Math.min(188, Math.max(142, width * 0.38));
    const rowHeight = width < 520 ? 21 : 24;
    const cardHeight = 42 + rowHeight * 6 + 31;
    const x = width - cardWidth - 10;
    const y = 10;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(densityX, 0, 0, densityY, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.strokeStyle = "#d9d2f0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#554473";
    ctx.font = "850 13px system-ui, sans-serif";
    ctx.fillText("에너지 준위", x + 12, y + 24);
    [...Array(6)].forEach((_, index) => {
      const n = 6 - index;
      const energy = -13.6 / n ** 2;
      const rowY = y + 42 + index * rowHeight;
      const selected = n === snapshot.quantumNumber;
      if (selected) {
        ctx.fillStyle = "#efe9ff";
        ctx.beginPath();
        ctx.roundRect(x + 7, rowY - 15, cardWidth - 14, rowHeight - 2, 7);
        ctx.fill();
      }
      ctx.fillStyle = selected ? "#6946b8" : "#66558f";
      ctx.font = `${selected ? "850" : "700"} 12px system-ui, sans-serif`;
      ctx.fillText(`n=${n}`, x + 13, rowY);
      ctx.textAlign = "right";
      ctx.fillText(n === snapshot.quantumNumber ? "선택" : "", x + cardWidth - 13, rowY);
      ctx.textAlign = "left";
    });
    ctx.fillStyle = "#fff4c7";
    ctx.beginPath();
    ctx.roundRect(x + 7, y + cardHeight - 29, cardWidth - 14, 22, 7);
    ctx.fill();
    ctx.fillStyle = "#85620f";
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillText("낮은 준위로 내려가며 광자를 방출해요", x + 13, y + cardHeight - 14);
    ctx.restore();
  }
  private photoelectric(s: ModernSnapshot): void {
    const ctx = this.ctx; const lamp = s.devices.find((d) => d.kind === "photon-source")!;
    const threshold = 2.3 / 4.135667696;
    const active = s.photonFrequency >= threshold;
    const frequencyRatio = clamp((s.photonFrequency - .2) / 1, 0, 1);
    const photonColor = `hsl(${55 - frequencyRatio * 35} 95% 62%)`;

    ctx.save();
    ctx.fillStyle = photonColor; ctx.shadowColor = photonColor; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(lamp.x, 300, 30, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = photonColor; ctx.lineWidth = 4;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      ctx.beginPath(); ctx.moveTo(lamp.x + Math.cos(angle) * 39, 300 + Math.sin(angle) * 39); ctx.lineTo(lamp.x + Math.cos(angle) * 53, 300 + Math.sin(angle) * 53); ctx.stroke();
    }
    this.label(s.photonFrequency >= threshold ? "에너지 큰 빛" : "에너지 작은 빛", lamp.x - 48, 380, photonColor);

    const beamStart = lamp.x + 55; const beamEnd = 490;
    ctx.strokeStyle = `${photonColor}55`; ctx.lineWidth = 3;
    [-34, 0, 34].forEach((offset) => { ctx.beginPath(); ctx.moveTo(beamStart, 300 + offset); ctx.lineTo(beamEnd, 300 + offset); ctx.stroke(); });
    for (let index = 0; index < 9; index += 1) {
      const progress = (s.animationTime * (.32 + frequencyRatio * .28) + index / 9) % 1;
      const lane = index % 3 - 1;
      const x = beamStart + (beamEnd - beamStart) * progress;
      const y = 300 + lane * 34 + Math.sin(progress * Math.PI * 8) * 7;
      ctx.fillStyle = photonColor; ctx.shadowColor = photonColor; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    const metalGradient = ctx.createLinearGradient(500, 0, 570, 0);
    metalGradient.addColorStop(0, "#718096"); metalGradient.addColorStop(.5, "#cbd5e1"); metalGradient.addColorStop(1, "#64748b");
    ctx.fillStyle = metalGradient; ctx.fillRect(500, 125, 70, 350);
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 3; ctx.strokeRect(500, 125, 70, 350);
    for (let row = 0; row < 7; row += 1) for (let column = 0; column < 2; column += 1) {
      ctx.fillStyle = "rgba(226,232,240,.65)"; ctx.beginPath(); ctx.arc(520 + column * 28, 165 + row * 48, 5, 0, Math.PI * 2); ctx.fill();
    }
    this.label(`금속 표면 · 일함수 ${WORK_FUNCTION_LABEL}`, 410, 92, LAB_CANVAS.ink);

    ctx.strokeStyle = active ? "#22d3ee" : "rgba(148,163,184,.45)"; ctx.lineWidth = 6; ctx.strokeRect(790, 205, 90, 190);
    ctx.fillStyle = active ? "rgba(34,211,238,.15)" : "rgba(148,163,184,.08)"; ctx.fillRect(800, 215, 70, 170);
    this.label("전자 검출기", 775, 430, active ? "#087f99" : "#64748b");
    s.detections.forEach((event, index) => {
      const startY = 230 + (index % 5) * 35;
      ctx.strokeStyle = "rgba(103,232,249,.38)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(570, startY); ctx.quadraticCurveTo(665, startY - 55, event.x, event.y); ctx.stroke();
      ctx.fillStyle = "#67e8f9"; ctx.shadowColor = "#67e8f9"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(event.x, event.y, 6 + event.strength * 1.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = active ? "#d1fae5" : "#fff0ec"; ctx.fillRect(650, 64, 280, 54);
    ctx.fillStyle = active ? "#087453" : "#a7442d"; ctx.font = "800 21px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(active ? "전자가 튀어나와요" : "문턱보다 에너지가 작아요", 790, 98);
    ctx.textAlign = "start";
    ctx.restore();
  }
  private matterWaves(s: ModernSnapshot): void {
    this.probabilityArea(s.graph, "#60a5fa", 300, 190);
    s.detections.forEach((event, index) => {
      const pulse = modernVisualPhase(s.animationTime, .72, index / Math.max(1, s.detections.length));
      this.ctx.fillStyle = `rgba(77,142,216,${.38 + pulse * .62})`; this.ctx.beginPath(); this.ctx.arc(event.x, event.y, 4 + pulse * 3, 0, Math.PI * 2); this.ctx.fill();
    });
    const flight = modernVisualPhase(s.animationTime, .34);
    this.ctx.fillStyle = "#bfdbfe"; this.ctx.beginPath(); this.ctx.arc(120 + flight * 760, 340 + Math.sin(flight * Math.PI * 8) * 22, 8, 0, Math.PI * 2); this.ctx.fill();
    this.label(`물질파 파장 · ${s.wavelengthNm > 1 ? "김" : "짧음"}`, 330, 90, "#376db5");
  }
  private quantum(s: ModernSnapshot): void {
    this.probabilityArea(s.graph, "#f472b6", 350, 270);
    s.detections.forEach((event, index) => {
      const pulse = modernVisualPhase(s.animationTime, .8, index / Math.max(1, s.detections.length));
      this.ctx.fillStyle = `rgba(213,82,148,${clamp(0.24 + event.strength + pulse * .3, .24, 1)})`; this.ctx.beginPath(); this.ctx.arc(event.x, event.y, 5 + pulse * 4, 0, Math.PI * 2); this.ctx.fill();
    });
    this.label("위치를 좁히면 운동량의 퍼짐이 커져요", 270, 90, "#a83270");
  }
  private probabilityArea(points: ModernSnapshot["graph"], color: string, baseline: number, height: number): void {
    const ctx = this.ctx; const max = Math.max(...points.map((p) => p.y), 1e-9); ctx.beginPath(); ctx.moveTo(120, baseline);
    points.forEach((p, i) => ctx.lineTo(120 + i / (points.length - 1) * 760, baseline - p.y / max * height));
    ctx.lineTo(880, baseline); ctx.closePath(); const grad = ctx.createLinearGradient(0, baseline - height, 0, baseline); grad.addColorStop(0, color); grad.addColorStop(1, `${color}18`); ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
  }
  private tunneling(s: ModernSnapshot): void {
    const ctx = this.ctx; const left = 460; const width = 90 + s.barrierWidth * 240;
    ctx.fillStyle = "rgba(251,146,60,.38)"; ctx.fillRect(left, 110, width, 350); ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 5; ctx.strokeRect(left, 110, width, 350);
    ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 6; ctx.beginPath();
    for (let x = 120; x <= left; x += 5) { const y = 300 + Math.sin((x - 120) / 24 - s.animationTime * 6) * 55; if (x === 120) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    ctx.strokeStyle = `rgba(147,197,253,${clamp(s.transmission * 2, .15, 1)})`; ctx.beginPath();
    for (let x = left; x <= left + width; x += 5) { const decay = Math.exp(-(x - left) / width * Math.max(1, 5 * s.barrierWidth)); ctx.lineTo(x, 300 + Math.sin((x - left) / 24) * 55 * decay); } ctx.stroke();
    s.detections.forEach((event) => { ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(event.x, event.y, 7, 0, Math.PI * 2); ctx.fill(); });
    this.label(`장벽 뒤 검출 · ${s.transmission > 0.12 ? "자주" : s.transmission > 0.03 ? "가끔" : "드물게"}`, 590, 90, "#a65b13");
  }
  private nuclei(s: ModernSnapshot): void {
    const ctx = this.ctx; const remaining = Math.round(s.remainingNuclei);
    for (let i = 0; i < 100; i += 1) { const x = 180 + (i % 10) * 46; const y = 130 + Math.floor(i / 10) * 34; ctx.fillStyle = i < remaining ? "#4ade80" : "rgba(148,163,184,.2)"; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); }
    const detector = s.devices.find((device) => device.kind === "detector");
    if (detector) this.device(detector);
    const decayPhase = modernVisualPhase(s.animationTime, .7);
    const decayAngle = decayPhase * Math.PI * 2;
    ctx.save(); ctx.strokeStyle = `rgba(250,204,21,${1 - decayPhase * .7})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(410, 300); ctx.lineTo(410 + Math.cos(decayAngle) * (35 + decayPhase * 105), 300 + Math.sin(decayAngle) * (35 + decayPhase * 105)); ctx.stroke(); ctx.restore();
    this.label(`미붕괴 ${remaining}개 · 붕괴 ${100 - remaining}개`, 300, 80, "#267a50");
  }
  private massEnergy(s: ModernSnapshot): void {
    const ctx = this.ctx; const glow = clamp(s.releasedEnergyMeV / 18, .08, 1);
    ctx.strokeStyle = `rgba(56,189,248,${glow})`; ctx.lineWidth = 5;
    for (let ray = 0; ray < 12; ray += 1) { const angle = ray / 12 * Math.PI * 2 + s.animationTime; ctx.beginPath(); ctx.moveTo(555, 300); ctx.lineTo(555 + Math.cos(angle) * (80 + glow * 125), 300 + Math.sin(angle) * (80 + glow * 125)); ctx.stroke(); }
    ctx.fillStyle = `rgba(250,204,21,${.25 + glow * .55})`; ctx.beginPath(); ctx.arc(555, 300, 45 + glow * 22, 0, Math.PI * 2); ctx.fill();
    this.label("가벼운 핵", 315, 220, "#267a50"); this.label("결합한 핵", 515, 220, "#946c00");
    this.label(`방출 에너지 · ${s.releasedEnergyMeV > 100 ? "큼" : "작음"}`, 350, 90, "#287da5");
  }
  private semiconductors(s: ModernSnapshot): void {
    const ctx = this.ctx; ctx.fillStyle = "rgba(96,165,250,.22)"; ctx.fillRect(160, 130, 340, 320); ctx.fillStyle = "rgba(251,113,133,.22)"; ctx.fillRect(500, 130, 340, 320);
    this.label("n형: 전자", 260, 110, "#376db5"); this.label("p형: 정공", 610, 110, "#b44461");
    const flow = clamp(Math.log10(Math.max(s.currentMilliamp, 0) + 1) * 6, 0, 18);
    for (let i = 0; i < 18; i += 1) { const phase = (s.animationTime * 80 + i * 38) % 650; ctx.fillStyle = i < flow ? "#f8fafc" : "rgba(248,250,252,.2)"; ctx.beginPath(); ctx.arc(180 + phase, 210 + (i % 5) * 45, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(250,204,21,${clamp(flow / 18, .08, 1)})`; ctx.fillRect(485, 130, 30, 320);
    this.label(`전류 · ${s.currentMilliamp > 5 ? "많이 흐름" : s.currentMilliamp > 0.1 ? "조금 흐름" : "거의 안 흐름"}`, 400, 485, "#b44461");
  }
  private sandbox(s: ModernSnapshot): void {
    const ctx = this.ctx; const sources = s.devices.filter((d) => d.kind === "photon-source"); const interactions = s.devices.filter((d) => d.kind === "metal" || d.kind === "atom"); const detectors = s.devices.filter((d) => d.kind === "detector"); const nuclei = s.devices.filter((d) => d.kind === "nucleus");
    const photonPath = (start: ModernDevice, end: ModernDevice): void => { const phase = (s.animationTime * 0.4) % 1; ctx.strokeStyle = "rgba(250,204,21,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(start.x + (end.x - start.x) * phase, start.y + (end.y - start.y) * phase, 6, 0, Math.PI * 2); ctx.fill(); };
    sources.forEach((source) => { detectors.forEach((detector) => photonPath(source, detector)); interactions.forEach((interaction) => { photonPath(source, interaction); detectors.forEach((detector) => photonPath(interaction, detector)); }); });
    nuclei.forEach((nucleus) => detectors.forEach((detector) => { ctx.save(); ctx.setLineDash([8, 9]); ctx.strokeStyle = "rgba(74,222,128,.38)"; ctx.beginPath(); ctx.moveTo(nucleus.x, nucleus.y); ctx.lineTo(detector.x, detector.y); ctx.stroke(); ctx.restore(); }));
    s.detections.forEach((event) => { ctx.fillStyle = `rgba(103,232,249,${clamp(0.35 + event.strength, 0.35, 1)})`; ctx.beginPath(); ctx.arc(event.x, event.y, 7, 0, Math.PI * 2); ctx.fill(); });
    if (s.devices.length === 1) this.label("팔레트에서 실험 장치를 추가해 보세요", 300, 90, LAB_CANVAS.muted);
  }
  private device(item: ModernDevice): void {
    const ctx = this.ctx; const color: Record<ModernDevice["kind"], string> = { "photon-source": "#facc15", metal: "#94a3b8", atom: "#a78bfa", barrier: "#fb923c", detector: "#22d3ee", nucleus: "#4ade80" };
    ctx.strokeStyle = color[item.kind]; ctx.fillStyle = color[item.kind]; ctx.lineWidth = 4;
    if (item.kind === "metal" || item.kind === "barrier") { ctx.globalAlpha = .65; ctx.fillRect(item.x - 22, item.y - 70, 44, 140); ctx.globalAlpha = 1; }
    else if (item.kind === "detector") { ctx.strokeRect(item.x - 25, item.y - 55, 50, 110); }
    else { ctx.beginPath(); ctx.arc(item.x, item.y, item.kind === "nucleus" ? 25 : 19, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.stroke(); }
  }
  private label(text: string, x: number, y: number, color: string = LAB_CANVAS.ink): void { this.ctx.fillStyle = color; this.ctx.font = "700 21px system-ui, sans-serif"; this.ctx.fillText(text, x, y); }
  private color(mode: ModernSnapshot["mode"]): string { return ({ relativity: "#2aa68f", "gravity-spacetime": "#9a66cf", atoms: "#8c6bd1", photoelectric: "#d99b00", "matter-waves": "#4d8ed8", quantum: "#d55294", tunneling: "#df792d", nuclei: "#35a66f", "mass-energy": "#2f9ac1", semiconductors: "#d95b78", sandbox: "#5575e8" })[mode]; }
}

const WORK_FUNCTION_LABEL = "2.3 eV";

export function drawModernGraph(canvas: HTMLCanvasElement, snapshot: ModernSnapshot): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1); const rect = canvas.getBoundingClientRect(); const width = Math.max(300, rect.width || 420); const height = 220;
  const targetWidth = Math.round(width * dpr); const targetHeight = Math.round(height * dpr); if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
  const xs = snapshot.graph.map((p) => p.x); const ys = snapshot.graph.map((p) => p.y); const xMin = Math.min(...xs); const xSpan = Math.max(...xs) - xMin || 1; const yMin = Math.min(...ys, 0); const yMax = Math.max(...ys, 1); const ySpan = yMax - yMin || 1;
  ctx.strokeStyle = "#e2e8f0"; for (let y = 30; y < 190; y += 40) { ctx.beginPath(); ctx.moveTo(42, y); ctx.lineTo(width - 14, y); ctx.stroke(); }
  const colors: Record<ModernSnapshot["mode"], string> = { relativity: "#2dd4bf", "gravity-spacetime": "#c084fc", atoms: "#a78bfa", photoelectric: "#facc15", "matter-waves": "#60a5fa", quantum: "#f472b6", tunneling: "#fb923c", nuclei: "#4ade80", "mass-energy": "#38bdf8", semiconductors: "#fb7185", sandbox: "#94a3b8" };
  ctx.strokeStyle = colors[snapshot.mode]; ctx.lineWidth = 3; ctx.beginPath(); snapshot.graph.forEach((p, index) => { const x = 42 + (p.x - xMin) / xSpan * (width - 58); const y = 16 + (1 - (p.y - yMin) / ySpan) * 172; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  const marker = graphMarker(snapshot); if (marker) { const x = 42 + (marker.x - xMin) / xSpan * (width - 58); const y = 16 + (1 - (marker.y - yMin) / ySpan) * 172; ctx.fillStyle = "#fff"; ctx.strokeStyle = colors[snapshot.mode]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = LAB_CANVAS.muted; ctx.font = "12px system-ui"; ctx.fillText("높음", 4, 20); ctx.fillText("낮음", 4, 190);
}
