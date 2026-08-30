import { WAVE_WORLD, type WaveDevice, type WavesModel, type WavesSnapshot } from "./models";

export interface Point { readonly x: number; readonly y: number }

const HANDLE_RADIUS = 18;

export function primaryHandle(snapshot: WavesSnapshot): Point | null {
  switch (snapshot.mode) {
    case "source": return { x: 120, y: 600 * (1 - (snapshot.amplitude - 12) / 76) };
    case "propagation": return { x: 70 + (snapshot.speed - 60) / 240 * 860, y: 500 };
    case "interference": return snapshot.devices.find((item) => item.kind === "second-source") ?? null;
    case "standing-wave": return { x: 70 + (snapshot.harmonic - 1) / 4 * 860, y: 500 };
    case "resonance": return { x: 70 + (snapshot.frequency - 1) / 8 * 860, y: 500 };
    case "sound": return { x: 140, y: 600 * (1 - (snapshot.amplitude - 5) / 65) };
    case "doppler": return snapshot.devices.find((item) => item.kind === "source") ?? null;
    case "communication": return { x: 70 + (snapshot.frequency - 50) / 250 * 860, y: 500 };
    case "sandbox": return null;
  }
}

export function hitTest(point: Point, target: Point, radius = HANDLE_RADIUS): boolean {
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

const deviceAt = (devices: readonly WaveDevice[], point: Point): WaveDevice | undefined =>
  [...devices].reverse().find((item) => hitTest(point, item, 30));

export class WavesRenderer {
  private readonly context: CanvasRenderingContext2D;
  private drag: { type: "primary" } | { type: "device"; id: string } | null = null;
  private frame = 0;
  private lastTime = 0;
  private observer: ResizeObserver | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly model: WavesModel,
    private readonly onChange: () => void,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is required for the waves laboratory.");
    this.context = context;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  resize(): void {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || 800);
    const height = Math.max(300, rect.height || 520);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(this.canvas.width / WAVE_WORLD.width, 0, 0, this.canvas.height / WAVE_WORLD.height, 0, 0);
    this.draw(this.model.snapshot());
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  private readonly animate = (now: number): void => {
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;
    this.model.step(dt);
    this.draw(this.model.snapshot());
    this.onChange();
    this.frame = requestAnimationFrame(this.animate);
  };

  private toWorld(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(rect.width, 1) * WAVE_WORLD.width,
      y: (event.clientY - rect.top) / Math.max(rect.height, 1) * WAVE_WORLD.height,
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const point = this.toWorld(event);
    const snapshot = this.model.snapshot();
    const handle = primaryHandle(snapshot);
    if (handle && hitTest(point, handle, 30)) this.drag = { type: "primary" };
    else if (snapshot.mode === "sandbox") {
      const found = deviceAt(snapshot.devices, point);
      if (found) this.drag = { type: "device", id: found.id };
    }
    if (this.drag) {
      this.canvas.setPointerCapture(event.pointerId);
      this.applyDrag(point);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.drag) this.applyDrag(this.toWorld(event));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.drag && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.drag = null;
  };

  private applyDrag(point: Point): void {
    if (this.drag?.type === "primary") this.model.dragPrimary(point.x, point.y);
    if (this.drag?.type === "device") this.model.moveDevice(this.drag.id, point.x, point.y);
    this.draw(this.model.snapshot());
    this.onChange();
  }

  private draw(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, WAVE_WORLD.width, WAVE_WORLD.height);
    const background = ctx.createLinearGradient(0, 0, 0, 600);
    background.addColorStop(0, "#07182a");
    background.addColorStop(1, "#0c2940");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1000, 600);
    this.drawGrid();

    switch (snapshot.mode) {
      case "interference": this.drawInterference(snapshot); break;
      case "standing-wave": this.drawStandingWave(snapshot); break;
      case "resonance": this.drawResonance(snapshot); break;
      case "sound": this.drawSound(snapshot); break;
      case "doppler": this.drawDoppler(snapshot); break;
      case "communication": this.drawCommunication(snapshot); break;
      case "sandbox": this.drawSandbox(snapshot); break;
      default: this.drawTravelingWave(snapshot); break;
    }
    snapshot.devices.forEach((item) => this.drawDevice(item));
    const handle = primaryHandle(snapshot);
    if (handle) this.drawHandle(handle, this.handleColor(snapshot.mode));
  }

  private drawGrid(): void {
    const ctx = this.context;
    ctx.strokeStyle = "rgba(148, 210, 235, .09)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
    for (let y = 0; y <= 600; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  }

  private drawTravelingWave(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    ctx.strokeStyle = snapshot.mode === "propagation" ? "#a78bfa" : "#38bdf8";
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let px = 120; px <= 900; px += 6) {
      const displacement = this.model.displacementAt((px - 120) / 100);
      const y = 300 - displacement * 1.4;
      if (px === 120) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.stroke();
    if (snapshot.mode === "propagation") {
      const front = 120 + (snapshot.time * snapshot.speed * 1.6) % 750;
      ctx.strokeStyle = "#e9d5ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(front, 120); ctx.lineTo(front, 470); ctx.stroke();
      this.label(`파면 속력 ${snapshot.speed.toFixed(0)} m/s`, front + 10, 150);
    }
    this.drawScaleTrack();
  }

  private drawInterference(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    const sources = snapshot.devices.filter((item) => item.kind === "source" || item.kind === "second-source");
    ctx.save(); ctx.globalAlpha = 0.45;
    sources.forEach((source) => {
      for (let radius = (snapshot.time * snapshot.speed * 1.2) % 70; radius < 720; radius += Math.max(24, snapshot.wavelength * 35)) {
        ctx.strokeStyle = source.kind === "source" ? "#38bdf8" : "#fb923c";
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(source.x, source.y, radius, 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.restore();
    snapshot.graph.forEach((point) => {
      const y = 80 + (point.x + 4) / 8 * 440;
      const width = Math.min(120, point.y * 5);
      ctx.fillStyle = `rgba(251,146,60,${Math.min(0.9, 0.12 + point.y / 12)})`;
      ctx.fillRect(820 - width, y, width, 6);
    });
  }

  private drawStandingWave(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    ctx.strokeStyle = "#34d399"; ctx.lineWidth = 7; ctx.beginPath();
    for (let px = 120; px <= 880; px += 5) {
      const x = (px - 120) / 95;
      const y = 300 - this.model.displacementAt(x) * 1.5;
      if (px === 120) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.stroke();
    for (let index = 0; index <= snapshot.harmonic; index += 1) {
      const x = 120 + index / snapshot.harmonic * 760;
      ctx.fillStyle = "#ecfdf5"; ctx.beginPath(); ctx.arc(x, 300, 7, 0, Math.PI * 2); ctx.fill();
    }
    this.label(`움직이지 않는 마디 ${snapshot.harmonic + 1}개`, 350, 90);
    this.drawScaleTrack();
  }

  private drawResonance(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(180, 300);
    const coils = 14;
    for (let index = 1; index <= coils; index += 1) {
      const x = 180 + index * 22;
      ctx.lineTo(x, 300 + (index % 2 ? -28 : 28));
    }
    ctx.lineTo(500, 300); ctx.stroke();
    const shift = Math.sin(snapshot.time * snapshot.frequency * Math.PI * 2) * Math.min(110, snapshot.response * 18);
    ctx.fillStyle = "#fce7f3"; ctx.fillRect(500 + shift, 235, 115, 130);
    this.label(`고유 주파수 ${snapshot.naturalFrequency} Hz`, 450, 140);
    this.drawScaleTrack();
  }

  private drawSound(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    for (let column = 0; column < 30; column += 1) {
      const baseX = 185 + column * 22;
      const displacement = this.model.displacementAt(column / 8) * 0.45;
      for (let row = 0; row < 9; row += 1) {
        ctx.fillStyle = `rgba(250,204,21,${0.3 + row * 0.055})`;
        ctx.beginPath(); ctx.arc(baseX + displacement, 180 + row * 30, 4.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 4; ctx.strokeRect(830, 230, 35, 140);
    this.label("공기 입자는 제자리 근처에서 앞뒤로 진동해요", 280, 100);
  }

  private drawDoppler(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    const source = snapshot.devices.find((item) => item.kind === "source");
    if (!source) return;
    const emissionPeriod = 1 / snapshot.frequency;
    const visualPeriod = emissionPeriod * 140;
    for (let index = 1; index <= 11; index += 1) {
      const age = index * visualPeriod;
      const centerX = source.x - snapshot.sourceVelocity / snapshot.speed * age;
      ctx.strokeStyle = "rgba(251,113,133,.52)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(centerX, source.y, age, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = "#fb7185"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(source.x - 55, source.y); ctx.lineTo(source.x + 55, source.y); ctx.stroke();
    ctx.fillStyle = "#fb7185"; ctx.beginPath(); ctx.moveTo(source.x + 65, source.y); ctx.lineTo(source.x + 42, source.y - 15); ctx.lineTo(source.x + 42, source.y + 15); ctx.closePath(); ctx.fill();
    this.label(`관찰자가 듣는 소리 ${snapshot.observedFrequency.toFixed(0)} Hz`, 620, 120);
  }

  private drawCommunication(snapshot: WavesSnapshot): void {
    const ctx = this.context;
    const transmitter = snapshot.devices.find((item) => item.id === "transmitter");
    const receiver = snapshot.devices.find((item) => item.id === "receiver");
    if (!transmitter || !receiver) return;
    const spacing = Math.max(34, snapshot.wavelength * 82);
    const phase = (snapshot.time * 190) % spacing;
    ctx.save();
    for (let radius = phase; radius < 720; radius += spacing) {
      const alpha = Math.max(0.08, 0.55 - radius / 1500);
      ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(transmitter.x, transmitter.y, radius, -0.72, 0.72);
      ctx.stroke();
    }
    const antenna = (x: number, y: number, color: string): void => {
      ctx.strokeStyle = color; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x, y + 95); ctx.lineTo(x, y - 85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 42, y + 95); ctx.lineTo(x + 42, y + 95); ctx.stroke();
      ctx.fillStyle = color;
      const chargeOffset = Math.sin(snapshot.time * snapshot.frequency * 0.08) * 58;
      ctx.beginPath(); ctx.arc(x, y + chargeOffset, 10, 0, Math.PI * 2); ctx.fill();
    };
    antenna(transmitter.x, transmitter.y, "#22d3ee");
    antenna(receiver.x, receiver.y, "#facc15");
    ctx.restore();
    this.label(`송신 ${snapshot.frequency.toFixed(0)} MHz`, 105, 145);
    this.label(`수신 파장 ${snapshot.wavelength.toFixed(2)} m`, 650, 145);
    this.drawScaleTrack();
  }

  private drawSandbox(snapshot: WavesSnapshot): void {
    const sources = snapshot.devices.filter((item) => item.kind === "source" || item.kind === "second-source");
    const ctx = this.context;
    sources.forEach((source) => {
      const spacing = Math.max(28, snapshot.wavelength * 35);
      const phase = (snapshot.time * snapshot.speed * 1.2) % spacing;
      for (let radius = phase; radius < 460; radius += spacing) {
        ctx.strokeStyle = source.kind === "source" ? "rgba(56,189,248,.3)" : "rgba(251,146,60,.3)";
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(source.x, source.y, radius, 0, Math.PI * 2); ctx.stroke();
      }
    });
    if (sources.length) {
      ctx.strokeStyle = "rgba(224,242,254,.88)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let px = 0; px <= WAVE_WORLD.width; px += 5) {
        const displacement = this.model.displacementAt(px / 100, 3);
        const y = 300 - displacement * 1.25;
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    if (!sources.length) this.label("아래 팔레트에서 파원을 추가해 보세요", 310, 100);
  }

  private drawDevice(item: WaveDevice): void {
    const ctx = this.context;
    const colors: Record<WaveDevice["kind"], string> = {
      source: "#38bdf8", "second-source": "#fb923c", boundary: "#dbeafe",
      medium: "#a78bfa", observer: "#fb7185", detector: "#facc15",
    };
    ctx.fillStyle = colors[item.kind];
    if (item.kind === "boundary") ctx.fillRect(item.x - 10, item.y - 80, 20, 160);
    else if (item.kind === "medium") { ctx.globalAlpha = 0.25; ctx.fillRect(item.x - 150, item.y - 90, 300, 180); ctx.globalAlpha = 1; }
    else {
      ctx.beginPath(); ctx.arc(item.x, item.y, item.kind === "observer" ? 24 : 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#07182a"; ctx.lineWidth = 4; ctx.stroke();
    }
  }

  private drawHandle(point: Point, color: string): void {
    const ctx = this.context;
    ctx.fillStyle = color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(point.x, point.y, HANDLE_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  private handleColor(mode: WavesSnapshot["mode"]): string {
    return ({ source: "#38bdf8", propagation: "#a78bfa", interference: "#fb923c", "standing-wave": "#34d399", resonance: "#f472b6", sound: "#facc15", doppler: "#fb7185", communication: "#22d3ee", sandbox: "#fff" })[mode];
  }

  private drawScaleTrack(): void {
    const ctx = this.context;
    ctx.strokeStyle = "rgba(255,255,255,.24)"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(70, 500); ctx.lineTo(930, 500); ctx.stroke(); ctx.lineCap = "butt";
  }

  private label(text: string, x: number, y: number): void {
    const ctx = this.context;
    ctx.font = "700 22px system-ui, sans-serif"; ctx.fillStyle = "#e0f2fe"; ctx.fillText(text, x, y);
  }
}

export function drawGraph(canvas: HTMLCanvasElement, snapshot: WavesSnapshot): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const targetWidth = Math.round(Math.max(300, rect.width || 420) * ratio);
  const targetHeight = Math.round(220 * ratio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#071827"; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(148,210,235,.18)"; ctx.lineWidth = 1;
  for (let y = 30; y < height - 25; y += 40) { ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(width - 16, y); ctx.stroke(); }
  const values = snapshot.graph.map((point) => point.y);
  const xValues = snapshot.graph.map((point) => point.x);
  const xMin = Math.min(...xValues); const xMax = Math.max(...xValues); const xSpan = xMax - xMin || 1;
  const min = Math.min(...values, 0); const max = Math.max(...values, 1); const span = max - min || 1;
  const colors: Record<WavesSnapshot["mode"], string> = { source: "#38bdf8", propagation: "#a78bfa", interference: "#fb923c", "standing-wave": "#34d399", resonance: "#f472b6", sound: "#facc15", doppler: "#fb7185", communication: "#22d3ee", sandbox: "#94a3b8" };
  ctx.strokeStyle = colors[snapshot.mode]; ctx.lineWidth = 3; ctx.beginPath();
  snapshot.graph.forEach((point, index) => {
    const x = 44 + (point.x - xMin) / xSpan * (width - 64);
    const y = 18 + (1 - (point.y - min) / span) * (height - 50);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  snapshot.graph.filter((point) => point.current).forEach((point) => {
    const x = 44 + (point.x - xMin) / xSpan * (width - 64);
    const y = 18 + (1 - (point.y - min) / span) * (height - 50);
    ctx.fillStyle = colors[snapshot.mode]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = "#bae6fd"; ctx.font = "12px system-ui"; ctx.fillText(max.toFixed(1), 6, 24); ctx.fillText(min.toFixed(1), 6, height - 25);
}
