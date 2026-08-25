import type { SubjectGraphDefinition } from "../subject-experience";
import { ThermalWorld, type ThermalObject, type ThermalSnapshot } from "./models";

const COLORS = { hot: "#ef7044", cold: "#4286d5", mixed: "#805fd1", ink: "#26323f", faint: "#d8e1e8" } as const;

export class ThermalRenderer {
  private dragging: "control" | string | null = null;
  private readonly listeners: Array<[string, EventListener]> = [];

  constructor(
    readonly world: ThermalWorld,
    readonly canvas: HTMLCanvasElement,
    private readonly changed: () => void = () => undefined,
  ) {
    this.listen("pointerdown", (event) => this.pointerDown(event as PointerEvent));
    this.listen("pointermove", (event) => this.pointerMove(event as PointerEvent));
    this.listen("pointerup", () => { this.dragging = null; });
    this.listen("pointercancel", () => { this.dragging = null; });
  }

  resize(width = this.canvas.clientWidth || 800, height = this.canvas.clientHeight || 520): void {
    const ratio = Math.max(1, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.render();
  }

  render(): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.max(1, globalThis.devicePixelRatio || 1);
    const width = this.canvas.width / ratio;
    const height = this.canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fbfc";
    context.fillRect(0, 0, width, height);
    const snapshot = this.world.snapshot();
    this.drawApparatus(context, snapshot, width, height);
    this.drawControl(context, snapshot, width, height);
  }

  destroy(): void {
    for (const [type, listener] of this.listeners) this.canvas.removeEventListener(type, listener);
    this.listeners.length = 0;
  }

  private listen(type: string, listener: EventListener): void {
    this.canvas.addEventListener(type, listener);
    this.listeners.push([type, listener]);
  }

  private coordinates(event: PointerEvent): { x: number; y: number; width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  }

  private pointerDown(event: PointerEvent): void {
    const point = this.coordinates(event);
    const snapshot = this.world.snapshot();
    if (point.y >= point.height - 86) {
      this.dragging = "control";
      this.updateControl(point.x, point.width);
    } else if (snapshot.scene === "sandbox") {
      const hit = [...snapshot.objects].reverse().find((object) =>
        Math.hypot(point.x - object.x * point.width, point.y - object.y * (point.height - 90)) <= 30,
      );
      if (hit) this.dragging = hit.id;
    }
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  private pointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const point = this.coordinates(event);
    if (this.dragging === "control") this.updateControl(point.x, point.width);
    else this.world.moveObject(this.dragging, point.x / point.width, point.y / (point.height - 90));
    this.changed();
    this.render();
  }

  private updateControl(x: number, width: number): void {
    this.world.setControl((x - 70) / Math.max(1, width - 140));
    this.changed();
    this.render();
  }

  private drawApparatus(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, height: number): void {
    const floor = height - 105;
    context.lineWidth = 3;
    context.strokeStyle = COLORS.ink;
    if (snapshot.scene === "heat-transfer") this.drawTransfer(context, snapshot, width, floor);
    else if (snapshot.scene === "gas") this.drawGas(context, snapshot, width, floor);
    else if (snapshot.scene === "heat-engine") this.drawEngine(context, snapshot, width, floor);
    else if (snapshot.scene === "phase-change") this.drawPhase(context, snapshot, width, floor);
    else if (snapshot.scene === "entropy") this.drawEntropy(context, snapshot, width, floor);
    else this.drawContainer(context, snapshot, width, floor);
    if (snapshot.scene === "sandbox") snapshot.objects.forEach((object) => this.drawTool(context, object, width, floor));
    this.drawReadout(context, snapshot, 24, 30);
  }

  private drawContainer(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const left = width * 0.2;
    const top = floor * 0.16;
    const boxWidth = width * 0.6;
    const boxHeight = floor * 0.68;
    context.strokeRect(left, top, boxWidth, boxHeight);
    for (const particle of snapshot.particles) {
      context.beginPath();
      context.fillStyle = snapshot.scene === "heat-energy" ? "#e98342" : COLORS[particle.group];
      context.arc(left + particle.x * boxWidth, top + particle.y * boxHeight, 4 + Math.min(2, particle.speed), 0, Math.PI * 2);
      context.fill();
      const tail = Math.min(14, particle.speed * 6);
      context.strokeStyle = context.fillStyle;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(left + particle.x * boxWidth, top + particle.y * boxHeight);
      context.lineTo(left + particle.x * boxWidth - tail, top + particle.y * boxHeight + ((particle.x * 10) % 5 - 2));
      context.stroke();
    }
    if (snapshot.scene === "particles" || snapshot.scene === "heat-energy") {
      const flames = 3 + Math.round(snapshot.control * 6);
      context.fillStyle = "#f28342";
      for (let index = 0; index < flames; index += 1) {
        context.beginPath();
        context.arc(left + boxWidth * (index + 1) / (flames + 1), top + boxHeight + 17, 5 + snapshot.control * 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  private drawTransfer(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const boxY = floor * 0.28;
    const boxW = width * 0.24;
    const boxH = floor * 0.46;
    const leftX = width * 0.1;
    const rightX = width * 0.66;
    context.fillStyle = "#fde0d3"; context.fillRect(leftX, boxY, boxW, boxH);
    context.fillStyle = "#d8eafd"; context.fillRect(rightX, boxY, boxW, boxH);
    context.strokeStyle = COLORS.ink; context.strokeRect(leftX, boxY, boxW, boxH); context.strokeRect(rightX, boxY, boxW, boxH);
    const barStart = leftX + boxW;
    const barEnd = rightX;
    context.lineWidth = snapshot.control < 0.5 ? 10 : 18;
    context.strokeStyle = snapshot.control < 0.5 ? "#b9a47c" : "#d99c35";
    context.beginPath(); context.moveTo(barStart, boxY + boxH / 2); context.lineTo(barEnd, boxY + boxH / 2); context.stroke();
    const packetCount = Math.min(8, Math.max(1, Math.round(Math.abs(snapshot.heatFlow) * 16)));
    context.fillStyle = COLORS.hot;
    for (let index = 0; index < packetCount; index += 1) {
      const progress = (snapshot.time * 0.4 + index / packetCount) % 1;
      context.beginPath(); context.arc(barStart + (barEnd - barStart) * progress, boxY + boxH / 2, 4, 0, Math.PI * 2); context.fill();
    }
    context.font = "700 15px system-ui"; context.fillStyle = COLORS.hot; context.fillText(`${snapshot.temperature.toFixed(0)} K`, leftX + 20, boxY + 30);
    context.fillStyle = COLORS.cold; context.fillText(`${snapshot.secondaryTemperature.toFixed(0)} K`, rightX + 20, boxY + 30);
  }

  private drawGas(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const left = width * 0.2;
    const right = left + width * (0.22 + snapshot.control * 0.48);
    const top = floor * 0.18;
    const bottom = floor * 0.78;
    context.strokeRect(left, top, right - left, bottom - top);
    context.fillStyle = "#556678"; context.fillRect(right - 7, top - 18, 14, bottom - top + 36);
    for (const particle of snapshot.particles) {
      context.beginPath(); context.fillStyle = COLORS.hot;
      context.arc(left + particle.x * (right - left), top + particle.y * (bottom - top), 4, 0, Math.PI * 2); context.fill();
    }
    context.font = "700 16px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`V ${snapshot.volume.toFixed(1)} L`, left, bottom + 31);
    context.fillText(`P ${snapshot.pressure.toFixed(0)} kPa`, left + 125, bottom + 31);
  }

  private drawPhase(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const left = width * 0.25; const top = floor * 0.18; const w = width * 0.5; const h = floor * 0.62;
    context.strokeRect(left, top, w, h);
    const solidCount = Math.round(snapshot.particles.length * (1 - snapshot.liquidFraction));
    snapshot.particles.forEach((particle, index) => {
      const isSolid = index < solidCount;
      const x = isSolid ? left + 35 + (index % 9) * Math.min(34, (w - 70) / 8) : left + particle.x * w;
      const y = isSolid ? top + h - 28 - Math.floor(index / 9) * 25 : top + particle.y * h;
      context.fillStyle = isSolid ? "#83b9df" : "#4e91cf"; context.fillRect(x - 5, y - 5, 10, 10);
    });
    context.font = "700 16px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`액체 ${(snapshot.liquidFraction * 100).toFixed(0)}% · ${snapshot.temperature.toFixed(1)} °C`, left, top - 18);
  }

  private drawEngine(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const centerX = width / 2; const centerY = floor * 0.48;
    context.fillStyle = "#ffe1d0"; context.fillRect(width * 0.08, centerY - 70, width * 0.2, 140);
    context.fillStyle = "#dceafa"; context.fillRect(width * 0.72, centerY - 70, width * 0.2, 140);
    context.strokeStyle = COLORS.ink; context.strokeRect(centerX - 88, centerY - 82, 176, 164);
    const piston = centerY + 45 * Math.sin(snapshot.time * 2);
    context.fillStyle = "#566676"; context.fillRect(centerX - 75, piston, 150, 13);
    context.strokeStyle = COLORS.hot; context.lineWidth = 6; context.beginPath(); context.moveTo(width * 0.28, centerY); context.lineTo(centerX - 88, centerY); context.stroke();
    context.strokeStyle = COLORS.cold; context.beginPath(); context.moveTo(centerX + 88, centerY); context.lineTo(width * 0.72, centerY); context.stroke();
    context.font = "700 15px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`${snapshot.temperature.toFixed(0)} K`, width * 0.12, centerY);
    context.fillText(`${snapshot.secondaryTemperature.toFixed(0)} K`, width * 0.77, centerY);
    context.fillText(`효율 ${(snapshot.efficiency * 100).toFixed(0)}%`, centerX - 54, centerY - 102);
  }

  private drawEntropy(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    this.drawContainer(context, snapshot, width, floor);
    const dividerOpacity = 1 - snapshot.control;
    context.globalAlpha = dividerOpacity;
    context.fillStyle = "#3c4652"; context.fillRect(width / 2 - 5, floor * 0.16, 10, floor * 0.68);
    context.globalAlpha = 1;
    context.font = "700 15px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`ΔS ${snapshot.entropy.toFixed(2)} J/K`, width * 0.42, floor * 0.12);
  }

  private drawTool(context: CanvasRenderingContext2D, object: ThermalObject, width: number, floor: number): void {
    const x = object.x * width; const y = object.y * floor;
    const symbol: Record<ThermalObject["type"], string> = { container: "▣", heater: "♨", cooler: "❄", conductor: "═", insulator: "▥", piston: "↔", thermometer: "🌡" };
    context.beginPath(); context.fillStyle = "#ffffff"; context.strokeStyle = "#4c6675"; context.lineWidth = 2; context.arc(x, y, 25, 0, Math.PI * 2); context.fill(); context.stroke();
    context.font = "22px system-ui"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillStyle = COLORS.ink; context.fillText(symbol[object.type], x, y);
    context.textAlign = "start"; context.textBaseline = "alphabetic";
  }

  private drawReadout(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, x: number, y: number): void {
    context.fillStyle = "rgba(255,255,255,.9)"; context.fillRect(x - 10, y - 20, 230, 54);
    context.font = "700 14px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`온도 ${snapshot.temperature.toFixed(1)} K`, x, y);
    if (snapshot.pressure > 0) context.fillText(`압력 ${snapshot.pressure.toFixed(1)} kPa`, x, y + 22);
    else context.fillText(`에너지 ${snapshot.energy.toFixed(1)} kJ`, x, y + 22);
  }

  private drawControl(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, height: number): void {
    const y = height - 52; const left = 70; const right = width - 70;
    context.strokeStyle = COLORS.faint; context.lineWidth = 12; context.lineCap = "round"; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
    const x = left + snapshot.control * (right - left);
    context.fillStyle = snapshot.control > 0.5 ? COLORS.hot : COLORS.cold; context.beginPath(); context.arc(x, y, 15, 0, Math.PI * 2); context.fill();
    const labels: Record<ThermalSnapshot["scene"], readonly [string, string]> = {
      particles: ["차갑게", "뜨겁게"], "heat-transfer": ["단열체", "전도체"],
      "phase-change": ["열 조금", "열 많이"], gas: ["좁게", "넓게"],
      "heat-energy": ["적은 양", "많은 양"], "heat-engine": ["작은 온도 차", "큰 온도 차"],
      entropy: ["칸막이 닫기", "완전히 섞기"], sandbox: ["약하게", "강하게"],
    };
    context.font = "700 13px system-ui"; context.fillStyle = COLORS.ink; context.fillText(labels[snapshot.scene][0], left, y + 34); context.textAlign = "right"; context.fillText(labels[snapshot.scene][1], right, y + 34); context.textAlign = "start";
  }
}

export function renderThermalGraph(canvas: HTMLCanvasElement, snapshot: ThermalSnapshot, definition: SubjectGraphDefinition): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = Math.max(260, canvas.clientWidth || 320); const height = Math.max(170, canvas.clientHeight || 190);
  const ratio = Math.max(1, globalThis.devicePixelRatio || 1); canvas.width = width * ratio; canvas.height = height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const points = snapshot.graph; const all = points.flatMap((point) => point.values).filter(Number.isFinite); const xs = points.map((point) => point.x);
  const minX = Math.min(...xs, 0); const maxX = Math.max(...xs, 1); const minY = Math.min(...all, 0); const maxY = Math.max(...all, 1); const left = 48; const top = 18; const plotW = width - 62; const plotH = height - 56;
  context.strokeStyle = "#d8e1e8"; context.lineWidth = 1; context.beginPath(); context.moveTo(left, top); context.lineTo(left, top + plotH); context.lineTo(left + plotW, top + plotH); context.stroke();
  definition.series.forEach((series, seriesIndex) => { context.strokeStyle = series.color; context.lineWidth = 2.5; context.beginPath(); points.forEach((point, index) => { const x = left + (point.x - minX) / Math.max(0.001, maxX - minX) * plotW; const value = point.values[seriesIndex] ?? point.values[0]; const y = top + (maxY - value) / Math.max(0.001, maxY - minY) * plotH; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); });
  context.font = "600 11px system-ui"; context.fillStyle = "#657582"; context.fillText(definition.yLabel, 6, 12); context.textAlign = "right"; context.fillText(definition.xLabel, width - 6, height - 7); context.textAlign = "start";
}
