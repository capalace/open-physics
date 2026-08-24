import { PhysicsSimulation } from "../physics/simulation";
import { UniformGravityField } from "../physics/fields";

export type PlaygroundShape = "circle" | "box";

export interface PlaygroundObject {
  id: string;
  shape: PlaygroundShape;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  fixed?: boolean;
}

export interface PlaygroundOptions {
  gravity?: number;
  width?: number;
  height?: number;
}

/** Browser-facing adapter: keeps rendering/input concerns outside the physics core. */
export class PhysicsPlayground {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly simulation: PhysicsSimulation;
  readonly objects = new Map<string, PlaygroundObject>();
  gravity: number;
  paused = true;
  timeScale = 1;

  private pointerId: number | null = null;
  private draggedId: string | null = null;
  private lastFrame = 0;

  constructor(canvas: HTMLCanvasElement, options: PlaygroundOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.gravity = options.gravity ?? 9.8;
    this.simulation = new PhysicsSimulation({
      fields: [new UniformGravityField({ x: 0, y: this.gravity })],
    });
    this.canvas.width = options.width ?? 960;
    this.canvas.height = options.height ?? 600;
    this.bindPointerEvents();
    requestAnimationFrame((time) => this.frame(time));
  }

  addCircle(x: number, y: number, radius = 24): PlaygroundObject {
    const id = crypto.randomUUID();
    const object: PlaygroundObject = { id, shape: "circle", x, y, width: radius * 2, height: radius * 2, radius, color: "#4f8cff" };
    this.objects.set(id, object);
    this.simulation.addBody({ id, radius, restitution: 0.7, state: { position: { x, y }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    return object;
  }

  addBox(x: number, y: number, width = 48, height = 48): PlaygroundObject {
    const id = crypto.randomUUID();
    const object: PlaygroundObject = { id, shape: "box", x, y, width, height, radius: Math.min(width, height) / 2, color: "#ff8b4f" };
    this.objects.set(id, object);
    this.simulation.addBody({ id, radius: object.radius, restitution: 0.5, state: { position: { x, y }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    return object;
  }

  reset(): void {
    for (const id of [...this.objects.keys()]) this.simulation.removeBody(id);
    this.objects.clear();
    this.addBox(this.canvas.width / 2, 80);
    this.addCircle(this.canvas.width / 2 - 90, 180);
  }

  setGravity(value: number): void {
    this.gravity = value;
    this.simulation.removeField("field.gravity.uniform");
    this.simulation.addField(new UniformGravityField({ x: 0, y: value }));
  }

  private frame(time: number): void {
    const dt = Math.min((time - this.lastFrame) / 1000 || 0, 1 / 30) * this.timeScale;
    this.lastFrame = time;
    if (!this.paused && !this.draggedId) this.simulation.step(dt);
    this.syncObjects();
    this.render();
    requestAnimationFrame((next) => this.frame(next));
  }

  private syncObjects(): void {
    for (const [id, object] of this.objects) {
      const body = this.simulation.getBody(id);
      if (!body) continue;
      object.x = body.state.position.x;
      object.y = body.state.position.y;
    }
  }

  private render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = "#d0d7de";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 1);
    ctx.lineTo(canvas.width, canvas.height - 1);
    ctx.stroke();
    for (const object of this.objects.values()) {
      ctx.fillStyle = object.color;
      if (object.shape === "circle") {
        ctx.beginPath();
        ctx.arc(object.x, object.y, object.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(object.x - object.width / 2, object.y - object.height / 2, object.width, object.height);
      }
    }
    ctx.restore();
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      const point = this.pointFromEvent(event);
      for (const object of [...this.objects.values()].reverse()) {
        const dx = point.x - object.x;
        const dy = point.y - object.y;
        const hit = object.shape === "circle"
          ? dx * dx + dy * dy <= object.radius ** 2
          : Math.abs(dx) <= object.width / 2 && Math.abs(dy) <= object.height / 2;
        if (!hit) continue;
        this.pointerId = event.pointerId;
        this.draggedId = object.id;
        this.canvas.setPointerCapture(event.pointerId);
        return;
      }
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.pointerId || !this.draggedId) return;
      const object = this.objects.get(this.draggedId);
      const body = this.simulation.getBody(this.draggedId);
      if (!object || !body) return;
      const point = this.pointFromEvent(event);
      body.state.position = point;
      body.state.velocity = { x: 0, y: 0 };
      object.x = point.x;
      object.y = point.y;
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.draggedId = null;
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }

  private pointFromEvent(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * this.canvas.width / rect.width, y: (event.clientY - rect.top) * this.canvas.height / rect.height };
  }
}
