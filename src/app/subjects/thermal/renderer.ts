import type { SubjectGraphDefinition } from "../subject-experience";
import { ThermalWorld, type ThermalObject, type ThermalSnapshot } from "./models";

const COLORS = { hot: "#ef7044", cold: "#4286d5", mixed: "#805fd1", ink: "#26323f", faint: "#d8e1e8" } as const;

export function thermalControlHandle(snapshot: ThermalSnapshot, width: number, height: number): { x: number; y: number } {
  const floor = height - 105;
  switch (snapshot.scene) {
    case "particles": return { x: width * 0.15, y: floor * 0.835 - snapshot.control * floor * 0.423 };
    case "heat-transfer": return { x: width * 0.4 + snapshot.control * width * 0.2225, y: floor * 0.52 };
    case "thermal-expansion": return { x: width * (0.18 + snapshot.control * 0.64), y: height - 52 };
    case "phase-change": return { x: width * 0.82, y: floor * 0.772 - snapshot.control * floor * 0.494 };
    case "gas": return { x: width * (0.42 + snapshot.control * 0.48), y: floor * 0.48 };
    case "heat-energy": return { x: width * (0.2 + snapshot.control * 0.6), y: 72 };
    case "heat-engine": return { x: width * 0.18, y: floor * 0.709 - snapshot.control * floor * 0.475 };
    case "entropy": return { x: width * 0.5, y: floor * 0.84 - snapshot.control * floor * 0.587 };
    case "sandbox": return { x: 70 + snapshot.control * (width - 140), y: height - 52 };
  }
}

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
    const handle = thermalControlHandle(snapshot, point.width, point.height);
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 30) {
      this.dragging = "control";
      this.updateControl(point.x, point.y, point.width, point.height);
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
    if (this.dragging === "control") this.updateControl(point.x, point.y, point.width, point.height);
    else this.world.moveObject(this.dragging, point.x / point.width, point.y / (point.height - 90));
    this.changed();
    this.render();
  }

  private updateControl(x: number, y: number, width: number, height: number): void {
    const floor = height - 105;
    let control: number;
    switch (this.world.scene) {
      case "particles": control = (floor * 0.835 - y) / (floor * 0.423); break;
      case "heat-transfer": control = (x - width * 0.4) / (width * 0.2225); break;
      case "thermal-expansion": control = (x / width - 0.18) / 0.64; break;
      case "phase-change": control = (floor * 0.772 - y) / (floor * 0.494); break;
      case "gas": control = (x / width - 0.42) / 0.48; break;
      case "heat-energy": control = (x / width - 0.2) / 0.6; break;
      case "heat-engine": control = (floor * 0.709 - y) / (floor * 0.475); break;
      case "entropy": control = (floor * 0.84 - y) / (floor * 0.587); break;
      case "sandbox": control = (x - 70) / Math.max(1, width - 140); break;
    }
    this.world.setControl(control);
    this.changed();
    this.render();
  }

  private drawApparatus(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, height: number): void {
    const floor = height - 105;
    context.lineWidth = 3;
    context.strokeStyle = COLORS.ink;
    if (snapshot.scene === "heat-transfer") this.drawTransfer(context, snapshot, width, floor);
    else if (snapshot.scene === "thermal-expansion") this.drawExpansion(context, snapshot, width, floor);
    else if (snapshot.scene === "gas") this.drawGas(context, snapshot, width, floor);
    else if (snapshot.scene === "heat-engine") this.drawEngine(context, snapshot, width, floor);
    else if (snapshot.scene === "phase-change") this.drawPhase(context, snapshot, width, floor);
    else if (snapshot.scene === "entropy") this.drawEntropy(context, snapshot, width, floor);
    else if (snapshot.scene === "heat-energy") this.drawHeatEnergy(context, snapshot, width, floor);
    else this.drawContainer(context, snapshot, width, floor);
    if (snapshot.scene === "sandbox") {
      this.drawSandboxConnections(context, snapshot, width, floor);
      snapshot.objects.forEach((object) => this.drawTool(context, object, snapshot, width, floor));
    }
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
      context.lineTo(
        left + particle.x * boxWidth - particle.velocityX / Math.max(0.001, particle.speed) * tail,
        top + particle.y * boxHeight - particle.velocityY / Math.max(0.001, particle.speed) * tail,
      );
      context.stroke();
    }
    if (snapshot.scene === "particles") {
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

  private drawExpansion(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const left = width * 0.16;
    const referenceLength = width * 0.58;
    const visualChange = snapshot.expansion * 2.4;
    const y = floor * 0.5;
    context.save();
    context.strokeStyle = "#8a99a8"; context.lineWidth = 2; context.setLineDash([6, 6]);
    context.beginPath(); context.moveTo(left + referenceLength, y - 90); context.lineTo(left + referenceLength, y + 90); context.stroke();
    context.setLineDash([]);
    const gradient = context.createLinearGradient(left, y, left + referenceLength + visualChange, y);
    gradient.addColorStop(0, "#7e91a5"); gradient.addColorStop(1, snapshot.temperature > 20 ? "#ef7044" : "#4286d5");
    context.strokeStyle = gradient; context.lineWidth = 34; context.lineCap = "round";
    context.beginPath(); context.moveTo(left, y); context.lineTo(left + referenceLength + visualChange, y); context.stroke();
    context.fillStyle = COLORS.ink; context.font = "700 15px system-ui";
    context.fillText("20 °C 기준선", left + referenceLength - 48, y - 105);
    context.fillText(`길이 변화 ${snapshot.expansion >= 0 ? "+" : ""}${snapshot.expansion.toFixed(2)} mm`, left + referenceLength * 0.34, y + 78);
    const particleCount = 14;
    const spacing = (referenceLength + visualChange) / (particleCount - 1);
    for (let index = 0; index < particleCount; index += 1) {
      context.fillStyle = "#fff"; context.beginPath(); context.arc(left + index * spacing, y, 5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
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

  private drawHeatEnergy(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    this.drawContainer(context, snapshot, width, floor);
    const left = width * 0.2;
    const boxWidth = width * 0.6;
    const y = floor * 0.88;
    context.save();
    context.fillStyle = COLORS.hot;
    for (let index = 0; index < 8; index += 1) {
      const x = left + boxWidth * (index + 1) / 9;
      context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.fill();
    }
    context.font = "800 14px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText("항상 같은 열 80 kJ", left, y + 30);
    context.restore();
  }

  private drawEngine(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const centerX = width / 2; const centerY = floor * 0.48;
    context.save();
    context.fillStyle = "#ffe1d0"; context.fillRect(width * 0.08, centerY - 70, width * 0.2, 140);
    context.fillStyle = "#dceafa"; context.fillRect(width * 0.72, centerY - 70, width * 0.2, 140);
    context.strokeStyle = COLORS.ink; context.strokeRect(centerX - 88, centerY - 82, 176, 164);
    const piston = centerY + 45 * (snapshot.volume - 10.5) / 2.5;
    context.fillStyle = "#566676"; context.fillRect(centerX - 75, piston, 150, 13);
    context.strokeStyle = COLORS.hot; context.lineWidth = 6; context.beginPath(); context.moveTo(width * 0.28, centerY); context.lineTo(centerX - 88, centerY); context.stroke();
    context.strokeStyle = COLORS.cold; context.beginPath(); context.moveTo(centerX + 88, centerY); context.lineTo(width * 0.72, centerY); context.stroke();
    const work = Math.round(snapshot.efficiency * 100); const rejected = 100 - work;
    const arrow = (fromX: number, toX: number, color: string): void => {
      const direction = Math.sign(toX - fromX) || 1;
      context.fillStyle = color; context.beginPath(); context.moveTo(toX, centerY); context.lineTo(toX - direction * 13, centerY - 8); context.lineTo(toX - direction * 13, centerY + 8); context.closePath(); context.fill();
    };
    arrow(width * 0.28, centerX - 88, COLORS.hot); arrow(centerX + 88, width * 0.72, COLORS.cold);
    context.strokeStyle = "#805fd1"; context.lineWidth = 6; context.beginPath(); context.moveTo(centerX, centerY - 82); context.lineTo(centerX, centerY - 142); context.stroke();
    context.fillStyle = "#805fd1"; context.beginPath(); context.moveTo(centerX, centerY - 154); context.lineTo(centerX - 9, centerY - 138); context.lineTo(centerX + 9, centerY - 138); context.closePath(); context.fill();
    for (let index = 0; index < 3; index += 1) {
      const phase = (snapshot.time * 0.8 + index / 3) % 1;
      context.fillStyle = "#ff9b68"; context.beginPath(); context.arc(width * 0.28 + (centerX - 88 - width * 0.28) * phase, centerY, 5, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#79aee8"; context.beginPath(); context.arc(centerX + 88 + (width * 0.72 - centerX - 88) * phase, centerY, 4, 0, Math.PI * 2); context.fill();
    }
    context.font = "700 14px system-ui"; context.fillStyle = COLORS.ink; context.textAlign = "center";
    context.fillText("뜨거운 저장고", width * 0.18, centerY - 88);
    context.fillText("차가운 저장고", width * 0.82, centerY - 88);
    context.fillText(`${snapshot.temperature.toFixed(0)} K`, width * 0.18, centerY + 5);
    context.fillText(`${snapshot.secondaryTemperature.toFixed(0)} K`, width * 0.82, centerY + 5);
    context.fillText("피스톤", centerX, centerY + 112);
    context.fillStyle = COLORS.hot; context.fillText("받은 열 Qₕ = 100", centerX - 142, centerY + 28);
    context.fillStyle = COLORS.cold; context.fillText(`버린 열 Q꜀ = ${rejected}`, centerX + 142, centerY + 28);
    context.fillStyle = "#805fd1"; context.fillText(`한 일 W = ${work}`, centerX, centerY - 168);
    context.font = "800 15px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`효율 ${(snapshot.efficiency * 100).toFixed(0)}%`, centerX, centerY - 106);
    context.restore();
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

  private drawSandboxConnections(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const containers = snapshot.objects.filter((object) => object.type === "container");
    const sources = snapshot.objects.filter((object) => object.type === "heater" || object.type === "cooler");
    context.save();
    for (const source of sources) for (const container of containers) {
      const distance = Math.hypot(source.x - container.x, source.y - container.y);
      context.globalAlpha = Math.max(0.08, Math.exp(-distance * 4.5));
      context.strokeStyle = source.type === "heater" ? COLORS.hot : COLORS.cold;
      context.lineWidth = 5;
      context.beginPath(); context.moveTo(source.x * width, source.y * floor); context.lineTo(container.x * width, container.y * floor); context.stroke();
    }
    context.restore();
  }

  private drawTool(context: CanvasRenderingContext2D, object: ThermalObject, snapshot: ThermalSnapshot, width: number, floor: number): void {
    const x = object.x * width; const y = object.y * floor;
    const symbol: Record<ThermalObject["type"], string> = { container: "▣", heater: "♨", cooler: "❄", conductor: "═", insulator: "▥", piston: "↔", thermometer: "🌡" };
    context.beginPath(); context.fillStyle = "#ffffff"; context.strokeStyle = "#4c6675"; context.lineWidth = 2; context.arc(x, y, 25, 0, Math.PI * 2); context.fill(); context.stroke();
    context.font = "22px system-ui"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillStyle = COLORS.ink; context.fillText(symbol[object.type], x, y);
    const reading = snapshot.thermometerReadings.find((item) => item.id === object.id);
    if (reading) {
      context.font = "700 12px system-ui";
      context.fillText(`${reading.temperature.toFixed(0)} ${reading.unit}`, x, y + 40);
    }
    context.textAlign = "start"; context.textBaseline = "alphabetic";
  }

  private drawReadout(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, x: number, y: number): void {
    context.fillStyle = "rgba(255,255,255,.9)"; context.fillRect(x - 10, y - 20, 230, 54);
    context.font = "700 14px system-ui"; context.fillStyle = COLORS.ink;
    context.fillText(`온도 ${snapshot.temperature.toFixed(1)} ${snapshot.temperatureUnit}`, x, y);
    if (snapshot.pressure > 0) context.fillText(`압력 ${snapshot.pressure.toFixed(1)} kPa`, x, y + 22);
    else context.fillText(`에너지 ${snapshot.energy.toFixed(1)} kJ`, x, y + 22);
  }

  private drawControl(context: CanvasRenderingContext2D, snapshot: ThermalSnapshot, width: number, height: number): void {
    const handle = thermalControlHandle(snapshot, width, height);
    const labels: Record<ThermalSnapshot["scene"], readonly [string, string]> = {
      particles: ["차갑게", "뜨겁게"], "heat-transfer": ["단열체", "전도체"],
      "thermal-expansion": ["차갑게", "뜨겁게"],
      "phase-change": ["열 조금", "열 많이"], gas: ["좁게", "넓게"],
      "heat-energy": ["적은 양", "많은 양"], "heat-engine": ["작은 온도 차", "큰 온도 차"],
      entropy: ["칸막이 닫기", "완전히 섞기"], sandbox: ["약하게", "강하게"],
    };
    const vertical = ["particles", "phase-change", "heat-engine", "entropy"].includes(snapshot.scene);
    const railStart = vertical
      ? { x: handle.x, y: snapshot.scene === "entropy" ? 100 : 90 }
      : { x: snapshot.scene === "gas" ? width * 0.42 : snapshot.scene === "heat-transfer" ? width * 0.4 : snapshot.scene === "thermal-expansion" ? width * 0.18 : snapshot.scene === "heat-energy" ? width * 0.2 : 70, y: handle.y };
    const railEnd = vertical
      ? { x: handle.x, y: snapshot.scene === "entropy" ? height - 168 : height - 170 }
      : { x: snapshot.scene === "gas" ? width * 0.9 : snapshot.scene === "heat-transfer" ? width * 0.6225 : snapshot.scene === "thermal-expansion" ? width * 0.82 : snapshot.scene === "heat-energy" ? width * 0.8 : width - 70, y: handle.y };
    context.save();
    context.strokeStyle = COLORS.faint; context.lineWidth = 9; context.lineCap = "round";
    context.beginPath(); context.moveTo(railStart.x, railStart.y); context.lineTo(railEnd.x, railEnd.y); context.stroke();
    context.fillStyle = snapshot.control > 0.5 ? COLORS.hot : COLORS.cold; context.strokeStyle = "#fff"; context.lineWidth = 3;
    context.beginPath(); context.arc(handle.x, handle.y, 15, 0, Math.PI * 2); context.fill(); context.stroke();
    context.font = "700 13px system-ui"; context.fillStyle = COLORS.ink;
    if (vertical) {
      context.fillText(labels[snapshot.scene][1], handle.x + 22, railStart.y + 4);
      context.fillText(labels[snapshot.scene][0], handle.x + 22, railEnd.y + 4);
    } else {
      context.fillText(labels[snapshot.scene][0], railStart.x, railStart.y + 34);
      context.textAlign = "right"; context.fillText(labels[snapshot.scene][1], railEnd.x, railEnd.y + 34);
    }
    if (snapshot.scene === "heat-energy") {
      const mass = snapshot.mass;
      context.textAlign = "center"; context.fillText(`${mass.toFixed(1)} kg · ${snapshot.particles.length}개 입자`, handle.x, handle.y - 25);
    }
    context.restore();
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
