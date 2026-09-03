import { lightInteractiveDeviceId, type LightDevice, type LightSnapshot, type Point } from "./models";
import {
  drawInteractionLabel,
  drawLabBackdrop,
  LAB_CANVAS,
} from "../canvas-theme";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;

export class LightRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly graphContext: CanvasRenderingContext2D;
  private graphRatio = 1;
  private graphWidth = 420;
  private readonly graphHeight = 230;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly graphCanvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    const graphContext = graphCanvas.getContext("2d");
    if (!context || !graphContext) throw new Error("Light experience requires 2D canvas support.");
    this.context = context;
    this.graphContext = graphContext;
    this.resize();
  }

  resize(): void {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = this.canvas.clientWidth || WORLD_WIDTH;
    const height = Math.max(360, this.canvas.clientHeight || width * 0.625);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(this.canvas.width / WORLD_WIDTH, 0, 0, this.canvas.height / WORLD_HEIGHT, 0, 0);
    this.graphRatio = ratio;
    this.graphWidth = this.graphCanvas.clientWidth || 420;
    this.graphCanvas.width = Math.round(this.graphWidth * ratio);
    this.graphCanvas.height = Math.round(this.graphHeight * ratio);
  }

  worldPoint(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * WORLD_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * WORLD_HEIGHT / bounds.height,
    };
  }

  draw(snapshot: LightSnapshot): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawLabBackdrop(ctx, WORLD_WIDTH, WORLD_HEIGHT, 40);
    if (snapshot.sceneId === "refraction" || snapshot.sceneId === "total-internal-reflection") {
      const water = ctx.createLinearGradient(0, 300, 0, WORLD_HEIGHT);
      water.addColorStop(0, "rgba(76, 169, 220, .13)");
      water.addColorStop(1, "rgba(76, 145, 205, .28)");
      ctx.fillStyle = water;
      ctx.fillRect(0, 300, WORLD_WIDTH, 300);
      ctx.strokeStyle = "rgba(49,141,201,.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(WORLD_WIDTH, 300); ctx.stroke();
    }
    for (const ray of snapshot.rays) {
      ctx.save();
      ctx.strokeStyle = ray.color;
      ctx.lineWidth = ray.width ?? 3;
      ctx.shadowColor = ray.color;
      ctx.shadowBlur = 12;
      if (ray.dashed) ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(ray.from.x, ray.from.y);
      ctx.lineTo(ray.to.x, ray.to.y);
      ctx.stroke();
      ctx.restore();
    }
    if (snapshot.normal) {
      ctx.save();
      ctx.strokeStyle = "rgba(83,96,120,.58)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(snapshot.normal.from.x, snapshot.normal.from.y);
      ctx.lineTo(snapshot.normal.to.x, snapshot.normal.to.y);
      ctx.stroke();
      ctx.restore();
    }
    const interactiveDeviceId = lightInteractiveDeviceId(snapshot.sceneId);
    for (const item of snapshot.devices) this.drawDevice(ctx, item, snapshot.screenIntensity, item.id === interactiveDeviceId);
    const interactiveDevice = snapshot.devices.find((item) => item.id === interactiveDeviceId);
    if (interactiveDevice && snapshot.handle) {
      const offset = interactiveDevice.id === "object" ? 96
        : interactiveDevice.kind === "lens" || interactiveDevice.kind === "slit" ? 106
          : interactiveDevice.kind === "mirror" || interactiveDevice.kind === "boundary" || interactiveDevice.kind === "prism" ? 76
            : 38;
      drawInteractionLabel(ctx, snapshot.handle, "직접 끌기", offset);
    }
    if (snapshot.image && Number.isFinite(snapshot.image.x)) this.drawImageArrow(ctx, snapshot.image);
    if (snapshot.screenPattern) this.drawPattern(ctx, snapshot.screenPattern);
    this.drawGraph(snapshot);
  }

  private drawDevice(ctx: CanvasRenderingContext2D, item: LightDevice, intensity = 1, interactive = false): void {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle ?? 0);
    ctx.lineWidth = 4;
    if (interactive) this.drawInteractiveGlow(ctx, item);
    if (item.id === "object") {
      ctx.strokeStyle = "#e58b37"; ctx.fillStyle = "#e58b37"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -80); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(-10, -68); ctx.lineTo(10, -68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = LAB_CANVAS.ink; ctx.font = "600 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(item.label, 0, 32);
      ctx.restore(); return;
    }
    if (item.id === "eye") {
      ctx.strokeStyle = "#536078"; ctx.fillStyle = "#fff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 0, 42, 23, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#5575e8"; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = LAB_CANVAS.ink; ctx.font = "600 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(item.label, 0, 55);
      ctx.restore(); return;
    }
    switch (item.kind) {
      case "source":
        ctx.fillStyle = "#ffd34d"; ctx.shadowColor = "#ffd34d"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = "#b97700"; ctx.stroke();
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 24, Math.sin(angle) * 24); ctx.lineTo(Math.cos(angle) * 34, Math.sin(angle) * 34); ctx.strokeStyle = "#ffd34d"; ctx.stroke();
        }
        break;
      case "mirror":
        ctx.strokeStyle = "#70d6ff"; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.stroke();
        ctx.strokeStyle = "rgba(112,214,255,.35)";
        for (let x = -65; x < 70; x += 14) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x - 8, 15); ctx.stroke(); }
        break;
      case "boundary":
        ctx.strokeStyle = "#4cc9f0"; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.stroke();
        break;
      case "lens":
        ctx.strokeStyle = "#80edff"; ctx.fillStyle = "rgba(84,205,255,.18)";
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case "prism":
        ctx.strokeStyle = "#caa8ff"; ctx.fillStyle = "rgba(183,123,255,.16)";
        ctx.beginPath(); ctx.moveTo(0, -65); ctx.lineTo(62, 45); ctx.lineTo(-62, 45); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case "slit":
        {
          const separation = item.separation ?? 44;
          const upper = -separation / 2;
          const lower = separation / 2;
          const halfOpening = 6;
          ctx.fillStyle = "#ff70a6";
          ctx.fillRect(-7, -100, 14, Math.max(0, upper - halfOpening + 100));
          ctx.fillRect(-7, upper + halfOpening, 14, Math.max(0, lower - upper - halfOpening * 2));
          ctx.fillRect(-7, lower + halfOpening, 14, Math.max(0, 100 - lower - halfOpening));
        }
        break;
      case "screen":
        ctx.fillStyle = `rgba(255,224,102,${0.12 + intensity * 0.55})`; ctx.strokeStyle = "#718096";
        ctx.fillRect(-8, -110, 16, 220); ctx.strokeRect(-8, -110, 16, 220);
        break;
    }
    ctx.rotate(-(item.angle ?? 0));
    ctx.fillStyle = LAB_CANVAS.ink;
    ctx.font = "600 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.label, 0, 132);
    ctx.restore();
  }

  private drawInteractiveGlow(ctx: CanvasRenderingContext2D, item: LightDevice): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 159, 28, .82)";
    ctx.shadowColor = "#ffb347";
    ctx.shadowBlur = 22;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    if (item.id === "object") {
      ctx.moveTo(0, 5); ctx.lineTo(0, -94);
    } else if (item.kind === "source") {
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
    } else if (item.kind === "mirror") {
      ctx.moveTo(-76, 0); ctx.lineTo(76, 0);
    } else if (item.kind === "boundary") {
      ctx.moveTo(-96, 0); ctx.lineTo(96, 0);
    } else if (item.kind === "lens") {
      ctx.ellipse(0, 0, 27, 102, 0, 0, Math.PI * 2);
    } else if (item.kind === "prism") {
      ctx.moveTo(0, -72); ctx.lineTo(69, 50); ctx.lineTo(-69, 50); ctx.closePath();
    } else if (item.kind === "slit") {
      ctx.rect(-16, -108, 32, 216);
    } else if (item.kind === "screen") {
      ctx.rect(-17, -118, 34, 236);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawImageArrow(ctx: CanvasRenderingContext2D, image: NonNullable<LightSnapshot["image"]>): void {
    ctx.save();
    ctx.strokeStyle = image.virtual ? "#ffadad" : "#80ed99";
    if (image.virtual) ctx.setLineDash([6, 5]);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(image.x, 300); ctx.lineTo(image.x, 300 + image.height); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(image.x, 300 + image.height); ctx.lineTo(image.x - 8, 300 + image.height - Math.sign(image.height) * 14); ctx.lineTo(image.x + 8, 300 + image.height - Math.sign(image.height) * 14); ctx.fill();
    ctx.restore();
  }

  private drawPattern(ctx: CanvasRenderingContext2D, pattern: readonly { x: number; y: number }[]): void {
    for (const point of pattern) {
      ctx.fillStyle = `rgba(255,112,166,${Math.max(.04, point.y)})`;
      ctx.fillRect(814, 300 + point.x * 8 - 2, 14, 4);
    }
  }

  private drawGraph(snapshot: LightSnapshot): void {
    const ctx = this.graphContext;
    const width = this.graphWidth;
    const height = this.graphHeight;
    ctx.setTransform(this.graphRatio, 0, 0, this.graphRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    const left = 48;
    const right = 16;
    const top = 36;
    const bottom = 34;
    const points = snapshot.graph;
    if (!points.length) return;
    const minX = Math.min(...points.map((point) => point.x), snapshot.graphCurrent?.x ?? Number.POSITIVE_INFINITY);
    const maxX = Math.max(...points.map((point) => point.x), snapshot.graphCurrent?.x ?? Number.NEGATIVE_INFINITY);
    const minY = Math.min(0, ...points.map((point) => point.y), snapshot.graphCurrent?.y ?? Number.POSITIVE_INFINITY);
    const maxY = Math.max(0, ...points.map((point) => point.y), snapshot.graphCurrent?.y ?? Number.NEGATIVE_INFINITY, minY + 1e-6);
    const sx = (value: number) => left + (value - minX) / Math.max(1e-9, maxX - minX) * (width - left - right);
    const sy = (value: number) => height - bottom - (value - minY) / Math.max(1e-9, maxY - minY) * (height - top - bottom);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, height - bottom); ctx.lineTo(width - right, height - bottom); ctx.stroke();
    ctx.font = "11px system-ui";
    ctx.fillStyle = LAB_CANVAS.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const xValue = minX + (maxX - minX) * fraction;
      const x = sx(xValue);
      ctx.beginPath(); ctx.moveTo(x, height - bottom); ctx.lineTo(x, height - bottom + 4); ctx.stroke();
      if (index === 0 || index === 4) ctx.fillText(index === 0 ? "작음" : "큼", x, height - bottom + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const yValue = minY + (maxY - minY) * fraction;
      const y = sy(yValue);
      ctx.beginPath(); ctx.moveTo(left - 4, y); ctx.lineTo(left, y); ctx.stroke();
      if (index === 0 || index === 4) ctx.fillText(index === 0 ? "낮음" : "높음", left - 7, y);
    }
    ctx.strokeStyle = snapshot.graphSeries.color; ctx.lineWidth = 3; ctx.beginPath();
    points.forEach((point, index) => index === 0 ? ctx.moveTo(sx(point.x), sy(point.y)) : ctx.lineTo(sx(point.x), sy(point.y)));
    ctx.stroke();
    if (snapshot.graphCurrent) {
      ctx.fillStyle = snapshot.graphSeries.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(snapshot.graphCurrent.x), sy(snapshot.graphCurrent.y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = snapshot.graphSeries.color;
    ctx.fillRect(left, 14, 18, 4);
    ctx.fillStyle = LAB_CANVAS.ink;
    ctx.font = "600 12px system-ui";
    ctx.fillText(`${snapshot.graphIsCurrentState ? "현재 " : ""}${snapshot.graphSeries.label}`, left + 25, 16);
  }
}
