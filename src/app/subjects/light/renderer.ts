import type { LightDevice, LightSnapshot, Point } from "./models";

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
    const background = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    background.addColorStop(0, "#081426");
    background.addColorStop(1, "#111d33");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawGrid(ctx);
    if (snapshot.sceneId === "refraction") {
      ctx.fillStyle = "rgba(50, 150, 220, .18)";
      ctx.fillRect(0, 300, WORLD_WIDTH, 300);
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
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(snapshot.normal.from.x, snapshot.normal.from.y);
      ctx.lineTo(snapshot.normal.to.x, snapshot.normal.to.y);
      ctx.stroke();
      ctx.restore();
    }
    for (const item of snapshot.devices) this.drawDevice(ctx, item, snapshot.screenIntensity);
    if (snapshot.image && Number.isFinite(snapshot.image.x)) this.drawImageArrow(ctx, snapshot.image);
    if (snapshot.screenPattern) this.drawPattern(ctx, snapshot.screenPattern);
    if (snapshot.handle) this.drawHandle(ctx, snapshot.handle);
    this.drawGraph(snapshot);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = "rgba(154, 187, 230, .07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke();
    }
    ctx.restore();
  }

  private drawDevice(ctx: CanvasRenderingContext2D, item: LightDevice, intensity = 1): void {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle ?? 0);
    ctx.lineWidth = 4;
    switch (item.kind) {
      case "source":
        ctx.fillStyle = "#ffd34d"; ctx.shadowColor = "#ffd34d"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
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
        ctx.fillStyle = `rgba(255,224,102,${0.12 + intensity * 0.55})`; ctx.strokeStyle = "#d8e5ff";
        ctx.fillRect(-8, -110, 16, 220); ctx.strokeRect(-8, -110, 16, 220);
        break;
    }
    ctx.rotate(-(item.angle ?? 0));
    ctx.fillStyle = "rgba(235,243,255,.86)";
    ctx.font = "600 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.label, 0, 132);
    ctx.restore();
  }

  private drawHandle(ctx: CanvasRenderingContext2D, handle: Point): void {
    ctx.save();
    ctx.fillStyle = "#ff9f1c"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(handle.x, handle.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
    ctx.fillStyle = "#0c1830"; ctx.fillRect(0, 0, width, height);
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
    const tick = (value: number) => Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
    ctx.strokeStyle = "rgba(220,235,255,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, height - bottom); ctx.lineTo(width - right, height - bottom); ctx.stroke();
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(220,235,255,.72)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const xValue = minX + (maxX - minX) * fraction;
      const x = sx(xValue);
      ctx.beginPath(); ctx.moveTo(x, height - bottom); ctx.lineTo(x, height - bottom + 4); ctx.stroke();
      ctx.fillText(tick(xValue), x, height - bottom + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const yValue = minY + (maxY - minY) * fraction;
      const y = sy(yValue);
      ctx.beginPath(); ctx.moveTo(left - 4, y); ctx.lineTo(left, y); ctx.stroke();
      ctx.fillText(tick(yValue), left - 7, y);
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
    ctx.fillStyle = "#e7f0ff";
    ctx.font = "600 12px system-ui";
    ctx.fillText(`${snapshot.graphIsCurrentState ? "현재 " : ""}${snapshot.graphSeries.label}`, left + 25, 16);
  }
}
