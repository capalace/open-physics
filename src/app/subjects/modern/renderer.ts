import { modernPrimaryHandle, MODERN_WORLD, type ModernDevice, type ModernModel, type ModernSnapshot } from "./models";

export interface Point { readonly x: number; readonly y: number }
const HANDLE_RADIUS = 18;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function primaryHandle(snapshot: ModernSnapshot): Point | null {
  return modernPrimaryHandle(snapshot);
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
    if (handle && hitTest(point, handle, 30)) this.drag = { type: "primary" };
    else if (snapshot.mode === "sandbox") {
      const found = [...snapshot.devices].reverse().find((item) => hitTest(point, item, 32));
      if (found) this.drag = { type: "device", id: found.id };
    }
    if (this.drag) { this.canvas.setPointerCapture(event.pointerId); this.applyDrag(point); }
  };
  private readonly pointerMove = (event: PointerEvent): void => { if (this.drag) this.applyDrag(this.worldPoint(event)); };
  private readonly pointerUp = (event: PointerEvent): void => {
    if (this.drag && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); this.drag = null;
  };
  private applyDrag(point: Point): void {
    if (this.drag?.type === "primary") this.model.dragPrimary(point.x, point.y);
    if (this.drag?.type === "device") this.model.moveDevice(this.drag.id, point.x, point.y);
    this.draw(this.model.snapshot()); this.onChange();
  }

  private draw(snapshot: ModernSnapshot): void {
    const ctx = this.ctx; ctx.clearRect(0, 0, 1000, 600);
    const gradient = ctx.createRadialGradient(500, 260, 40, 500, 300, 700);
    gradient.addColorStop(0, "#172554"); gradient.addColorStop(1, "#070b1e"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1000, 600);
    this.grid();
    switch (snapshot.mode) {
      case "relativity": this.relativity(snapshot); break; case "atoms": this.atoms(snapshot); break;
      case "gravity-spacetime": this.gravitySpacetime(snapshot); break;
      case "photoelectric": this.photoelectric(snapshot); break; case "matter-waves": this.matterWaves(snapshot); break;
      case "quantum": this.quantum(snapshot); break; case "tunneling": this.tunneling(snapshot); break;
      case "nuclei": this.nuclei(snapshot); break; case "semiconductors": this.semiconductors(snapshot); break;
      case "mass-energy": this.massEnergy(snapshot); break;
      case "sandbox": this.sandbox(snapshot); break;
    }
    snapshot.devices.forEach((item) => this.device(item));
    const handle = primaryHandle(snapshot); if (handle) this.handle(handle, this.color(snapshot.mode));
  }
  private grid(): void {
    const ctx = this.ctx; ctx.strokeStyle = "rgba(129,140,248,.08)"; ctx.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
    for (let y = 0; y <= 600; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  }
  private relativity(s: ModernSnapshot): void {
    const ctx = this.ctx; const proper = 10 / s.gamma;
    const earth = s.devices.find((item) => item.id === "earth-clock")!; const ship = s.devices.find((item) => item.id === "ship-clock")!;
    this.clock(earth.x, earth.y, 10, "지구 10.0 s", "#e2e8f0"); this.clock(ship.x, ship.y, proper, `우주선 ${proper.toFixed(1)} s`, "#2dd4bf");
    ctx.strokeStyle = "rgba(45,212,191,.55)"; ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(500 + i * 55 / s.gamma, 80); ctx.lineTo(660 + i * 55 / s.gamma, 450); ctx.stroke(); }
    this.label(`공간과 시간의 눈금 변화 γ=${s.gamma.toFixed(2)}`, 330, 80);
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
    const nearSeconds = 10 * s.gravityClockRate;
    this.clock(265, 280, nearSeconds, `가까운 시계 ${nearSeconds.toFixed(1)} s`, "#c084fc");
    this.clock(835, 280, 10, "먼 시계 10.0 s", "#e2e8f0");
    this.label("질량이 시공간을 휘게 해요", 375, 65, "#e9d5ff");
  }
  private clock(x: number, y: number, seconds: number, text: string, color: string): void {
    const ctx = this.ctx; ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 84, 0, Math.PI * 2); ctx.stroke();
    const angle = seconds / 10 * Math.PI * 2 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * 58, y + Math.sin(angle) * 58); ctx.stroke(); this.label(text, x - 70, y + 125, color);
  }
  private atoms(s: ModernSnapshot): void {
    const ctx = this.ctx; for (let n = 1; n <= 6; n += 1) {
      const energy = -13.6 / n ** 2; const y = 430 - (energy + 13.6) / 13.6 * 300;
      ctx.strokeStyle = n === s.quantumNumber ? "#a78bfa" : "rgba(196,181,253,.42)"; ctx.lineWidth = n === s.quantumNumber ? 7 : 3;
      ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(720, y); ctx.stroke(); this.label(`n=${n}  ${energy.toFixed(2)} eV`, 735, y + 6, "#ddd6fe");
    }
    const fromY = 430 - ((-13.6 / s.quantumNumber ** 2) + 13.6) / 13.6 * 300;
    ctx.strokeStyle = "#facc15"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(470, fromY); ctx.lineTo(470, 430); ctx.stroke();
    ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(470, 440); ctx.lineTo(458, 418); ctx.lineTo(482, 418); ctx.closePath(); ctx.fill();
    this.label(`${s.transitionEnergy.toFixed(2)} eV 광자 방출`, 390, 95, "#fde68a");
  }
  private photoelectric(s: ModernSnapshot): void {
    const ctx = this.ctx; const lamp = s.devices.find((d) => d.kind === "photon-source")!;
    for (let i = 0; i < 7; i += 1) { const phase = (s.animationTime * 150 + i * 55) % 350; ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(lamp.x + phase, 250 + Math.sin(phase / 20) * 25, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#64748b"; ctx.fillRect(500, 135, 65, 330); this.label(`일함수 ${WORK_FUNCTION_LABEL}`, 455, 105);
    s.detections.forEach((event) => { ctx.fillStyle = "#67e8f9"; ctx.beginPath(); ctx.arc(event.x, event.y, 7 + event.strength * 2, 0, Math.PI * 2); ctx.fill(); });
    this.label(s.electronEnergy > 0 ? "전자 검출 사건" : "아직 전자가 검출되지 않아요", 640, 105, s.electronEnergy > 0 ? "#67e8f9" : "#fda4af");
  }
  private matterWaves(s: ModernSnapshot): void {
    this.probabilityArea(s.graph, "#60a5fa", 300, 190);
    s.detections.forEach((event) => { this.ctx.fillStyle = "#bfdbfe"; this.ctx.beginPath(); this.ctx.arc(event.x, event.y, 6, 0, Math.PI * 2); this.ctx.fill(); });
    this.label(`계산된 드브로이 파장 ${s.wavelengthNm.toFixed(2)} nm`, 330, 90, "#bfdbfe");
  }
  private quantum(s: ModernSnapshot): void {
    this.probabilityArea(s.graph, "#f472b6", 350, 270);
    s.detections.forEach((event) => { this.ctx.fillStyle = `rgba(251,207,232,${clamp(0.25 + event.strength, .25, 1)})`; this.ctx.beginPath(); this.ctx.arc(event.x, event.y, 7, 0, Math.PI * 2); this.ctx.fill(); });
    this.label(`위치를 좁히면 운동량 불확정성 ${s.momentumUncertainty.toFixed(2)} ℏ/nm`, 270, 90, "#fbcfe8");
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
    this.label(`장벽 뒤 검출 확률 ${(s.transmission * 100).toFixed(1)}%`, 590, 90, "#fed7aa");
  }
  private nuclei(s: ModernSnapshot): void {
    const ctx = this.ctx; const remaining = Math.round(s.remainingNuclei);
    for (let i = 0; i < 100; i += 1) { const x = 180 + (i % 10) * 46; const y = 130 + Math.floor(i / 10) * 34; ctx.fillStyle = i < remaining ? "#4ade80" : "rgba(148,163,184,.2)"; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); }
    this.label(`미붕괴 ${remaining}개 · 붕괴 ${100 - remaining}개`, 300, 80, "#bbf7d0");
  }
  private massEnergy(s: ModernSnapshot): void {
    const ctx = this.ctx; const glow = clamp(s.releasedEnergyMeV / 18, .08, 1);
    ctx.strokeStyle = `rgba(56,189,248,${glow})`; ctx.lineWidth = 5;
    for (let ray = 0; ray < 12; ray += 1) { const angle = ray / 12 * Math.PI * 2 + s.animationTime; ctx.beginPath(); ctx.moveTo(555, 300); ctx.lineTo(555 + Math.cos(angle) * (80 + glow * 125), 300 + Math.sin(angle) * (80 + glow * 125)); ctx.stroke(); }
    ctx.fillStyle = `rgba(250,204,21,${.25 + glow * .55})`; ctx.beginPath(); ctx.arc(555, 300, 45 + glow * 22, 0, Math.PI * 2); ctx.fill();
    this.label("가벼운 핵", 315, 220, "#bbf7d0"); this.label("결합한 핵", 515, 220, "#fde68a");
    this.label(`방출 에너지 ${s.releasedEnergyMeV.toFixed(2)} MeV`, 350, 90, "#bae6fd");
  }
  private semiconductors(s: ModernSnapshot): void {
    const ctx = this.ctx; ctx.fillStyle = "rgba(96,165,250,.22)"; ctx.fillRect(160, 130, 340, 320); ctx.fillStyle = "rgba(251,113,133,.22)"; ctx.fillRect(500, 130, 340, 320);
    this.label("n형: 전자", 260, 110, "#93c5fd"); this.label("p형: 정공", 610, 110, "#fda4af");
    const flow = clamp(Math.log10(Math.max(s.currentMilliamp, 0) + 1) * 6, 0, 18);
    for (let i = 0; i < 18; i += 1) { const phase = (s.animationTime * 80 + i * 38) % 650; ctx.fillStyle = i < flow ? "#f8fafc" : "rgba(248,250,252,.2)"; ctx.beginPath(); ctx.arc(180 + phase, 210 + (i % 5) * 45, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(250,204,21,${clamp(flow / 18, .08, 1)})`; ctx.fillRect(485, 130, 30, 320);
    this.label(`전류 ${s.currentMilliamp.toFixed(2)} mA`, 400, 485, "#fecdd3");
  }
  private sandbox(s: ModernSnapshot): void {
    const ctx = this.ctx; const sources = s.devices.filter((d) => d.kind === "photon-source"); const interactions = s.devices.filter((d) => d.kind === "metal" || d.kind === "atom"); const detectors = s.devices.filter((d) => d.kind === "detector"); const nuclei = s.devices.filter((d) => d.kind === "nucleus");
    const photonPath = (start: ModernDevice, end: ModernDevice): void => { const phase = (s.animationTime * 0.4) % 1; ctx.strokeStyle = "rgba(250,204,21,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(start.x + (end.x - start.x) * phase, start.y + (end.y - start.y) * phase, 6, 0, Math.PI * 2); ctx.fill(); };
    sources.forEach((source) => { detectors.forEach((detector) => photonPath(source, detector)); interactions.forEach((interaction) => { photonPath(source, interaction); detectors.forEach((detector) => photonPath(interaction, detector)); }); });
    nuclei.forEach((nucleus) => detectors.forEach((detector) => { ctx.save(); ctx.setLineDash([8, 9]); ctx.strokeStyle = "rgba(74,222,128,.38)"; ctx.beginPath(); ctx.moveTo(nucleus.x, nucleus.y); ctx.lineTo(detector.x, detector.y); ctx.stroke(); ctx.restore(); }));
    s.detections.forEach((event) => { ctx.fillStyle = `rgba(103,232,249,${clamp(0.35 + event.strength, 0.35, 1)})`; ctx.beginPath(); ctx.arc(event.x, event.y, 7, 0, Math.PI * 2); ctx.fill(); });
    if (s.devices.length === 1) this.label("팔레트에서 실험 장치를 추가해 보세요", 300, 90);
  }
  private device(item: ModernDevice): void {
    const ctx = this.ctx; const color: Record<ModernDevice["kind"], string> = { "photon-source": "#facc15", metal: "#94a3b8", atom: "#a78bfa", barrier: "#fb923c", detector: "#22d3ee", nucleus: "#4ade80" };
    ctx.strokeStyle = color[item.kind]; ctx.fillStyle = color[item.kind]; ctx.lineWidth = 4;
    if (item.kind === "metal" || item.kind === "barrier") { ctx.globalAlpha = .65; ctx.fillRect(item.x - 22, item.y - 70, 44, 140); ctx.globalAlpha = 1; }
    else if (item.kind === "detector") { ctx.strokeRect(item.x - 25, item.y - 55, 50, 110); }
    else { ctx.beginPath(); ctx.arc(item.x, item.y, item.kind === "nucleus" ? 25 : 19, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#070b1e"; ctx.stroke(); }
  }
  private handle(p: Point, color: string): void { const ctx = this.ctx; ctx.fillStyle = color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  private label(text: string, x: number, y: number, color = "#e0e7ff"): void { this.ctx.fillStyle = color; this.ctx.font = "700 21px system-ui, sans-serif"; this.ctx.fillText(text, x, y); }
  private color(mode: ModernSnapshot["mode"]): string { return ({ relativity: "#2dd4bf", "gravity-spacetime": "#c084fc", atoms: "#a78bfa", photoelectric: "#facc15", "matter-waves": "#60a5fa", quantum: "#f472b6", tunneling: "#fb923c", nuclei: "#4ade80", "mass-energy": "#38bdf8", semiconductors: "#fb7185", sandbox: "#fff" })[mode]; }
}

const WORK_FUNCTION_LABEL = "2.3 eV";

export function drawModernGraph(canvas: HTMLCanvasElement, snapshot: ModernSnapshot): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1); const rect = canvas.getBoundingClientRect(); const width = Math.max(300, rect.width || 420); const height = 220;
  const targetWidth = Math.round(width * dpr); const targetHeight = Math.round(height * dpr); if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#080d22"; ctx.fillRect(0, 0, width, height);
  const xs = snapshot.graph.map((p) => p.x); const ys = snapshot.graph.map((p) => p.y); const xMin = Math.min(...xs); const xSpan = Math.max(...xs) - xMin || 1; const yMin = Math.min(...ys, 0); const yMax = Math.max(...ys, 1); const ySpan = yMax - yMin || 1;
  ctx.strokeStyle = "rgba(165,180,252,.15)"; for (let y = 30; y < 190; y += 40) { ctx.beginPath(); ctx.moveTo(42, y); ctx.lineTo(width - 14, y); ctx.stroke(); }
  const colors: Record<ModernSnapshot["mode"], string> = { relativity: "#2dd4bf", "gravity-spacetime": "#c084fc", atoms: "#a78bfa", photoelectric: "#facc15", "matter-waves": "#60a5fa", quantum: "#f472b6", tunneling: "#fb923c", nuclei: "#4ade80", "mass-energy": "#38bdf8", semiconductors: "#fb7185", sandbox: "#94a3b8" };
  ctx.strokeStyle = colors[snapshot.mode]; ctx.lineWidth = 3; ctx.beginPath(); snapshot.graph.forEach((p, index) => { const x = 42 + (p.x - xMin) / xSpan * (width - 58); const y = 16 + (1 - (p.y - yMin) / ySpan) * 172; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  const marker = graphMarker(snapshot); if (marker) { const x = 42 + (marker.x - xMin) / xSpan * (width - 58); const y = 16 + (1 - (marker.y - yMin) / ySpan) * 172; ctx.fillStyle = "#fff"; ctx.strokeStyle = colors[snapshot.mode]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = "#c7d2fe"; ctx.font = "12px system-ui"; ctx.fillText(yMax.toFixed(2), 4, 20); ctx.fillText(yMin.toFixed(2), 4, 190);
}
