import type { Vector2 } from "../physics/core";
import { UniformGravityField } from "../physics/fields";
import { PhysicsSimulation } from "../physics/simulation";

export type PlaygroundShape = "circle" | "box";
export type PlaygroundPreset = "free-fall" | "projectile" | "collision";
export type PlaygroundMaterial = "rubber" | "wood" | "steel" | "clay";

export const MATERIALS: Readonly<Record<PlaygroundMaterial, {
  label: string;
  description: string;
  restitution: number;
}>> = {
  rubber: { label: "고무", description: "탄성이 높아 충돌 후에도 운동을 많이 유지합니다.", restitution: 0.88 },
  wood: { label: "나무", description: "중간 정도의 탄성으로 충돌합니다.", restitution: 0.5 },
  steel: { label: "금속", description: "단단하고 비교적 탄성 있게 충돌합니다.", restitution: 0.72 },
  clay: { label: "점토", description: "충돌 에너지를 흡수해 거의 튀지 않습니다.", restitution: 0.08 },
};

export interface PlaygroundObject {
  id: string;
  label: string;
  shape: PlaygroundShape;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  material: PlaygroundMaterial;
}

export interface PlaygroundObjectOptions {
  label?: string;
  color?: string;
  mass?: number;
  material?: PlaygroundMaterial;
  velocity?: Vector2;
}

export interface PlaygroundSnapshot {
  paused: boolean;
  gravity: number;
  selected: {
    id: string;
    label: string;
    shape: PlaygroundShape;
    color: string;
    mass: number;
    material: PlaygroundMaterial;
  } | null;
}

export interface PlaygroundOptions {
  gravity?: number;
  width?: number;
  height?: number;
  onUpdate?: (snapshot: PlaygroundSnapshot) => void;
}

export interface VisualizationOptions {
  grid: boolean;
  trails: boolean;
  vectors: boolean;
}

export interface SelectedObjectUpdate {
  label?: string;
  color?: string;
  mass?: number;
  material?: PlaygroundMaterial;
}

const PIXELS_PER_METER = 48;
const FIXED_STEP = 1 / 120;
const FLOOR_HEIGHT = 48;
const RESTING_REBOUND_SPEED = 10;
const COLLISION_WORLD_DAMPING = 0.15;
const MOTION_SLEEP_SPEED = 2;
const VELOCITY_VECTOR_SCALE = 0.22;
const MAX_VELOCITY_VECTOR_LENGTH = 96;
const DEFAULT_VELOCITY_HANDLE_OFFSET = 64;
const VELOCITY_HANDLE_RADIUS = 12;
const VELOCITY_IDLE_EPSILON = 0.01;
const VELOCITY_ANGLE_SNAP_RADIANS = 15 * Math.PI / 180;
const TRAJECTORY_PREVIEW_STEP = 0.08;
const TRAJECTORY_PREVIEW_STEPS = 45;
const COLORS = ["#5b7cfa", "#f27a54", "#25a77a", "#a069dc", "#e2a62b"];

/** Connects browser input and rendering to the renderer-independent physics core. */
export class PhysicsPlayground {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly simulation: PhysicsSimulation;
  readonly objects = new Map<string, PlaygroundObject>();
  readonly visualization: VisualizationOptions = { grid: true, trails: true, vectors: true };

  gravity: number;
  currentPreset: PlaygroundPreset = "free-fall";
  onUpdate?: (snapshot: PlaygroundSnapshot) => void;

  private _paused = true;
  private pointerId: number | null = null;
  private draggedId: string | null = null;
  private velocityDraggedId: string | null = null;
  private selectedId: string | null = null;
  private lastFrame = 0;
  private lastNotification = 0;
  private accumulator = 0;
  private trailTick = 0;
  private objectSequence = 0;
  private readonly trails = new Map<string, Vector2[]>();

  constructor(canvas: HTMLCanvasElement, options: PlaygroundOptions = {}) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is not available.");
    this.ctx = context;
    this.gravity = options.gravity ?? 9.81;
    this.onUpdate = options.onUpdate;
    this.simulation = new PhysicsSimulation({
      fields: [new UniformGravityField({ x: 0, y: this.gravity * PIXELS_PER_METER })],
    });
    this.canvas.width = options.width ?? 960;
    this.canvas.height = options.height ?? 600;
    this.bindPointerEvents();
    requestAnimationFrame((time) => this.frame(time));
  }

  get paused(): boolean { return this._paused; }
  set paused(value: boolean) {
    this._paused = value;
    this.accumulator = 0;
    this.notify();
  }
  get floorY(): number { return this.canvas.height - FLOOR_HEIGHT; }

  toggle(): void { this.paused = !this.paused; }

  addObject(): PlaygroundObject {
    this._paused = true;
    this.accumulator = 0;
    return this.addCircle(420 + Math.random() * 120, 100, 25, { label: `물체 ${this.objects.size + 1}` });
  }

  addCircle(x = this.canvas.width / 2, y = 120, radius = 25, options: PlaygroundObjectOptions = {}): PlaygroundObject {
    const id = this.nextObjectId();
    const object: PlaygroundObject = {
      id,
      label: options.label ?? `원 ${this.objects.size + 1}`,
      shape: "circle",
      x,
      y,
      width: radius * 2,
      height: radius * 2,
      radius,
      color: options.color ?? this.nextColor(),
      material: options.material ?? "rubber",
    };
    this.registerObject(object, options);
    return object;
  }

  addBox(x = this.canvas.width / 2, y = 110, width = 54, height = 54, options: PlaygroundObjectOptions = {}): PlaygroundObject {
    const id = this.nextObjectId();
    const object: PlaygroundObject = {
      id,
      label: options.label ?? `상자 ${this.objects.size + 1}`,
      shape: "box",
      x,
      y,
      width,
      height,
      radius: Math.min(width, height) / 2,
      color: options.color ?? this.nextColor(),
      material: options.material ?? "wood",
    };
    this.registerObject(object, options);
    return object;
  }

  loadPreset(preset: PlaygroundPreset): void {
    this._paused = true;
    this.currentPreset = preset;
    this.accumulator = 0;
    this.trailTick = 0;
    this.selectedId = null;
    this.objects.clear();
    this.trails.clear();
    this.simulation.clear();

    if (preset === "free-fall") {
      this.replaceGravity(9.81);
      this.addCircle(350, 125, 24, { label: "가벼운 공", color: "#5b7cfa", mass: 0.5, material: "wood" });
      this.addCircle(480, 125, 24, { label: "기준 공", color: "#25a77a", mass: 1, material: "wood" });
      this.addCircle(610, 125, 24, { label: "무거운 공", color: "#f27a54", mass: 3, material: "wood" });
    } else if (preset === "projectile") {
      this.replaceGravity(9.81);
      this.addCircle(145, this.floorY - 42, 22, {
        label: "발사체",
        color: "#5b7cfa",
        mass: 1,
        material: "rubber",
        velocity: { x: 5.6, y: -7.2 },
      });
    } else {
      this.replaceGravity(0);
      this.addCircle(285, 300, 32, {
        label: "물체 A",
        color: "#5b7cfa",
        mass: 1,
        material: "rubber",
        velocity: { x: 3.4, y: 0 },
      });
      this.addCircle(675, 300, 40, {
        label: "물체 B",
        color: "#f27a54",
        mass: 2,
        material: "rubber",
        velocity: { x: -1.7, y: 0 },
      });
    }
    this.notify();
  }

  reset(): void { this.loadPreset(this.currentPreset); }

  stepOnce(): void {
    if (!this.paused) return;
    this.advance(1 / 60);
    this.syncObjects();
    this.render();
    this.notify();
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    this.simulation.removeBody(this.selectedId);
    this.objects.delete(this.selectedId);
    this.trails.delete(this.selectedId);
    this.selectedId = null;
    this.notify();
  }

  select(id: string | null): void {
    this.selectedId = id && this.objects.has(id) ? id : null;
    this.notify();
  }

  setGravity(value: number): void {
    if (!Number.isFinite(value)) return;
    this.replaceGravity(Math.max(0, Math.min(30, value)));
    this.notify();
  }

  setVisualization(option: keyof VisualizationOptions, value: boolean): void {
    this.visualization[option] = value;
    if (option === "trails" && !value) this.clearTrails();
    this.notify();
  }

  updateSelected(update: SelectedObjectUpdate): void {
    if (!this.selectedId) return;
    const object = this.objects.get(this.selectedId);
    const body = this.simulation.getBody(this.selectedId);
    if (!object || !body) return;

    if (update.label !== undefined) object.label = update.label.trim().slice(0, 24) || object.label;
    if (update.color !== undefined) object.color = update.color;
    if (update.mass !== undefined && Number.isFinite(update.mass)) {
      body.state.mass = Math.max(0.1, Math.min(20, update.mass));
    }
    if (update.material !== undefined) {
      object.material = update.material;
      body.restitution = MATERIALS[update.material].restitution;
    }
    this.clearTrails();
    this.notify();
  }

  snapshot(): PlaygroundSnapshot {
    let selected: PlaygroundSnapshot["selected"] = null;
    if (this.selectedId) {
      const object = this.objects.get(this.selectedId);
      const body = this.simulation.getBody(this.selectedId);
      if (object && body) {
        selected = {
          id: object.id,
          label: object.label,
          shape: object.shape,
          color: object.color,
          mass: body.state.mass,
          material: object.material,
        };
      }
    }
    return {
      paused: this.paused,
      gravity: this.gravity,
      selected,
    };
  }

  clearTrails(): void {
    for (const [id, object] of this.objects) this.trails.set(id, [{ x: object.x, y: object.y }]);
  }

  private registerObject(object: PlaygroundObject, options: PlaygroundObjectOptions): void {
    this.objects.set(object.id, object);
    this.trails.set(object.id, [{ x: object.x, y: object.y }]);
    this.simulation.addBody({
      id: object.id,
      radius: object.radius,
      restitution: MATERIALS[object.material].restitution,
      state: {
        position: { x: object.x, y: object.y },
        velocity: this.toPixels(options.velocity ?? { x: 0, y: 0 }),
        acceleration: this.gravityAcceleration(),
        mass: options.mass ?? 1,
      },
    });
    this.select(object.id);
  }

  private replaceGravity(value: number): void {
    this.gravity = value;
    this.simulation.removeField("field.gravity.uniform");
    this.simulation.addField(new UniformGravityField({ x: 0, y: value * PIXELS_PER_METER }));
    for (const body of this.simulation.allBodies) {
      body.state.acceleration = this.gravityAcceleration();
    }
  }

  private gravityAcceleration(): Vector2 {
    return { x: 0, y: this.gravity * PIXELS_PER_METER };
  }

  private frame(time: number): void {
    this.resizeToDisplaySize();
    const elapsed = Math.min((time - this.lastFrame) / 1000 || 0, 0.05);
    this.lastFrame = time;

    if (!this.paused && !this.draggedId) {
      this.accumulator += elapsed;
      let iterations = 0;
      while (this.accumulator >= FIXED_STEP && iterations < 12) {
        this.advance(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        iterations += 1;
      }
    }

    this.syncObjects();
    this.render();
    if (time - this.lastNotification > 80) {
      this.lastNotification = time;
      this.notify();
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  private resizeToDisplaySize(): void {
    if (typeof this.canvas.getBoundingClientRect !== "function") return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width <= 0 || height <= FLOOR_HEIGHT || (width === this.canvas.width && height === this.canvas.height)) return;
    this.resizeWorld(width, height);
  }

  private resizeWorld(width: number, height: number): void {
    const previousWidth = this.canvas.width;
    const previousFloorY = this.floorY;
    const nextFloorY = height - FLOOR_HEIGHT;

    for (const [id, object] of this.objects) {
      const body = this.simulation.getBody(id);
      if (!body) continue;
      const halfWidth = object.shape === "circle" ? object.radius : object.width / 2;
      const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
      body.state.position = {
        x: this.scaleBetweenBounds(
          body.state.position.x,
          14 + halfWidth,
          previousWidth - 14 - halfWidth,
          14 + halfWidth,
          width - 14 - halfWidth,
        ),
        y: this.scaleBetweenBounds(
          body.state.position.y,
          14 + halfHeight,
          previousFloorY - halfHeight,
          14 + halfHeight,
          nextFloorY - halfHeight,
        ),
      };
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.syncObjects();
    this.clearTrails();
  }

  private scaleBetweenBounds(value: number, oldMin: number, oldMax: number, nextMin: number, nextMax: number): number {
    if (oldMax <= oldMin || nextMax <= nextMin) return nextMin;
    const ratio = Math.max(0, Math.min(1, (value - oldMin) / (oldMax - oldMin)));
    return nextMin + ratio * (nextMax - nextMin);
  }

  private advance(dt: number): void {
    this.simulation.step(dt);
    this.applyPresetDamping(dt);
    this.resolveWorldBounds();
    this.trailTick += 1;
    if (this.trailTick % 4 === 0) this.recordTrails();
  }

  private applyPresetDamping(dt: number): void {
    if (this.currentPreset !== "collision") return;
    const damping = Math.exp(-COLLISION_WORLD_DAMPING * dt);
    for (const body of this.simulation.allBodies) {
      if (body.fixed) continue;
      body.state.velocity.x *= damping;
      body.state.velocity.y *= damping;
      if (Math.hypot(body.state.velocity.x, body.state.velocity.y) < MOTION_SLEEP_SPEED) {
        body.state.velocity = { x: 0, y: 0 };
      }
    }
  }

  private resolveWorldBounds(): void {
    const margin = 14;
    for (const object of this.objects.values()) {
      const body = this.simulation.getBody(object.id);
      if (!body) continue;
      const halfWidth = object.shape === "circle" ? object.radius : object.width / 2;
      const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
      const left = margin + halfWidth;
      const right = this.canvas.width - margin - halfWidth;
      const top = margin + halfHeight;
      const bottom = this.floorY - halfHeight;
      const restitution = body.restitution ?? 0.6;

      if (body.state.position.x < left) {
        body.state.position.x = left;
        if (body.state.velocity.x < 0) {
          body.state.velocity.x *= -restitution;
        }
      } else if (body.state.position.x > right) {
        body.state.position.x = right;
        if (body.state.velocity.x > 0) {
          body.state.velocity.x *= -restitution;
        }
      }

      if (body.state.position.y < top) {
        body.state.position.y = top;
        if (body.state.velocity.y < 0) {
          body.state.velocity.y *= -restitution;
        }
      } else if (body.state.position.y >= bottom) {
        body.state.position.y = bottom;
        if (body.state.velocity.y > 0) {
          const reboundSpeed = body.state.velocity.y * restitution;
          body.state.velocity.y = reboundSpeed < RESTING_REBOUND_SPEED ? 0 : -reboundSpeed;
          body.state.velocity.x *= 0.992;
        }
      }
    }
  }

  private recordTrails(): void {
    for (const object of this.objects.values()) {
      const body = this.simulation.getBody(object.id);
      if (!body) continue;
      const points = this.trails.get(object.id) ?? [];
      const last = points.at(-1);
      if (!last || Math.hypot(body.state.position.x - last.x, body.state.position.y - last.y) > 2) {
        points.push({ ...body.state.position });
      }
      if (points.length > 90) points.shift();
      this.trails.set(object.id, points);
    }
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
    const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, "#fbfdff");
    background.addColorStop(1, "#f3f6fb");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.visualization.grid) this.drawGrid();
    if (this.visualization.trails) this.drawTrails();
    this.drawGround();
    this.drawTrajectoryPreview();
    for (const object of this.objects.values()) this.drawObject(object);
  }

  private drawGrid(): void {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = 40; x < canvas.width; x += 40) {
      ctx.strokeStyle = x % 200 === 0 ? "#dbe3ef" : "#e9eef6";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.floorY);
      ctx.stroke();
    }
    for (let y = 40; y < this.floorY; y += 40) {
      ctx.strokeStyle = y % 200 === 0 ? "#dbe3ef" : "#e9eef6";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTrails(): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [id, points] of this.trails) {
      if (points.length < 2) continue;
      const object = this.objects.get(id);
      if (!object) continue;
      ctx.strokeStyle = `${object.color}55`;
      ctx.beginPath();
      points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGround(): void {
    const { ctx, canvas } = this;
    const ground = ctx.createLinearGradient(0, this.floorY, 0, canvas.height);
    ground.addColorStop(0, "#dce7e1");
    ground.addColorStop(1, "#cbdad3");
    ctx.fillStyle = ground;
    ctx.fillRect(0, this.floorY, canvas.width, 48);
    ctx.fillStyle = "#9cb7aa";
    ctx.fillRect(0, this.floorY, canvas.width, 3);
    ctx.save();
    ctx.strokeStyle = "#b4c8be";
    for (let x = -30; x < canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + 48, this.floorY);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTrajectoryPreview(): void {
    if (!this.paused || !this.selectedId) return;
    const object = this.objects.get(this.selectedId);
    const body = this.simulation.getBody(this.selectedId);
    if (!object || !body || Math.hypot(body.state.velocity.x, body.state.velocity.y) < VELOCITY_IDLE_EPSILON) return;
    const points = this.predictedPath(object, body.state.velocity, body.state.acceleration);
    if (points.length < 2) return;

    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = "#7257d599";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
  }

  private predictedPath(object: PlaygroundObject, velocity: Vector2, acceleration: Vector2): Vector2[] {
    const points: Vector2[] = [{ x: object.x, y: object.y }];
    const halfWidth = object.shape === "circle" ? object.radius : object.width / 2;
    const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
    const minX = 14 + halfWidth;
    const maxX = this.canvas.width - 14 - halfWidth;
    const minY = 14 + halfHeight;
    const maxY = this.floorY - halfHeight;

    for (let step = 1; step <= TRAJECTORY_PREVIEW_STEPS; step += 1) {
      const time = step * TRAJECTORY_PREVIEW_STEP;
      const point = {
        x: object.x + velocity.x * time + 0.5 * acceleration.x * time ** 2,
        y: object.y + velocity.y * time + 0.5 * acceleration.y * time ** 2,
      };
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) break;
      points.push(point);
      if (this.previewHitsObject(point, object)) break;
    }
    return points;
  }

  private previewHitsObject(point: Vector2, movingObject: PlaygroundObject): boolean {
    for (const object of this.objects.values()) {
      if (object.id === movingObject.id) continue;
      const combinedRadius = movingObject.radius + object.radius;
      if (Math.hypot(point.x - object.x, point.y - object.y) <= combinedRadius) return true;
    }
    return false;
  }

  private drawObject(object: PlaygroundObject): void {
    const { ctx } = this;
    const selected = object.id === this.selectedId;
    const body = this.simulation.getBody(object.id);
    if (!body) return;

    ctx.save();
    ctx.shadowColor = selected ? `${object.color}77` : "#22304a22";
    ctx.shadowBlur = selected ? 18 : 9;
    ctx.shadowOffsetY = selected ? 0 : 5;
    if (selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 7;
      if (object.shape === "circle") {
        ctx.beginPath();
        ctx.arc(object.x, object.y, object.radius + 6, 0, Math.PI * 2);
      } else {
        this.roundRect(
          object.x - object.width / 2 - 6,
          object.y - object.height / 2 - 6,
          object.width + 12,
          object.height + 12,
          14,
        );
      }
      ctx.stroke();
      ctx.strokeStyle = object.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (object.shape === "circle") {
      const fill = ctx.createRadialGradient(
        object.x - object.radius * 0.35,
        object.y - object.radius * 0.4,
        object.radius * 0.12,
        object.x,
        object.y,
        object.radius,
      );
      fill.addColorStop(0, "#ffffff");
      fill.addColorStop(0.18, object.color);
      fill.addColorStop(1, this.shadeColor(object.color, -22));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(object.x, object.y, object.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const left = object.x - object.width / 2;
      const top = object.y - object.height / 2;
      const fill = ctx.createLinearGradient(left, top, left, top + object.height);
      fill.addColorStop(0, this.shadeColor(object.color, 18));
      fill.addColorStop(1, this.shadeColor(object.color, -18));
      ctx.fillStyle = fill;
      this.roundRect(left, top, object.width, object.height, 10);
      ctx.fill();
    }
    ctx.restore();

    this.drawLabel(object);
    if (selected) {
      this.drawVelocityControl(object, body.state.velocity);
      if (this.visualization.vectors) {
        this.drawArrow(object.x, object.y, body.state.acceleration, 0.14, "#e05c3f", "가속도");
      }
    }
  }

  private drawLabel(object: PlaygroundObject): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = "600 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    const labelY = object.y - object.height / 2 - 14;
    const width = ctx.measureText(object.label).width + 14;
    ctx.fillStyle = "#ffffffdd";
    this.roundRect(object.x - width / 2, labelY - 13, width, 20, 8);
    ctx.fill();
    ctx.fillStyle = "#33405a";
    ctx.fillText(object.label, object.x, labelY + 1);
    ctx.restore();
  }

  private drawVelocityControl(object: PlaygroundObject, velocity: Vector2): void {
    const actualVector = this.velocityVector(velocity);
    const idle = Math.hypot(velocity.x, velocity.y) < VELOCITY_IDLE_EPSILON;
    const vector = idle ? this.idleVelocityControlVector(object) : actualVector;
    const endX = object.x + vector.x;
    const endY = object.y + vector.y;
    const angle = Math.atan2(vector.y, vector.x);
    const { ctx } = this;

    ctx.save();
    ctx.strokeStyle = idle ? "#7257d588" : "#7257d5";
    ctx.fillStyle = "#7257d5";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (idle) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(object.x, object.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!idle) {
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#7257d5";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(endX, endY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7257d5";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    const label = idle ? "여기서 끌어 보세요" : `속도 · ${this.displayAngle(velocity)}°`;
    ctx.fillText(label, endX + 11, endY - 10);
    ctx.restore();
  }

  private displayAngle(vector: Vector2): number {
    const degrees = Math.round(Math.atan2(-vector.y, vector.x) * 180 / Math.PI);
    return (degrees + 360) % 360;
  }

  private velocityVector(velocity: Vector2): Vector2 {
    let x = velocity.x * VELOCITY_VECTOR_SCALE;
    let y = velocity.y * VELOCITY_VECTOR_SCALE;
    const displayLength = Math.hypot(x, y);
    if (displayLength > MAX_VELOCITY_VECTOR_LENGTH) {
      x *= MAX_VELOCITY_VECTOR_LENGTH / displayLength;
      y *= MAX_VELOCITY_VECTOR_LENGTH / displayLength;
    }
    return { x, y };
  }

  private idleVelocityControlVector(object: PlaygroundObject): Vector2 {
    const objectExtent = object.shape === "circle"
      ? object.radius
      : Math.max(object.width, object.height) / 2;
    return {
      x: Math.max(DEFAULT_VELOCITY_HANDLE_OFFSET, objectExtent + VELOCITY_HANDLE_RADIUS + 8),
      y: 0,
    };
  }

  private velocityControlVector(object: PlaygroundObject, velocity: Vector2): Vector2 {
    return Math.hypot(velocity.x, velocity.y) < VELOCITY_IDLE_EPSILON
      ? this.idleVelocityControlVector(object)
      : this.velocityVector(velocity);
  }

  private drawArrow(originX: number, originY: number, vector: Vector2, factor: number, color: string, label: string): void {
    let x = vector.x * factor;
    let y = vector.y * factor;
    const length = Math.hypot(x, y);
    if (length < 3) return;
    if (length > MAX_VELOCITY_VECTOR_LENGTH) {
      x *= MAX_VELOCITY_VECTOR_LENGTH / length;
      y *= MAX_VELOCITY_VECTOR_LENGTH / length;
    }
    const endX = originX + x;
    const endY = originY + y;
    const angle = Math.atan2(y, x);
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.fillText(label, endX + 8, endY - 8);
    ctx.restore();
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      const point = this.pointFromEvent(event);
      const velocityHit = this.hitVelocityHandle(point);
      if (velocityHit) {
        this.paused = true;
        this.pointerId = event.pointerId;
        this.velocityDraggedId = velocityHit.id;
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.style.cursor = "grabbing";
        return;
      }
      const hit = this.hitTest(point);
      this.select(hit?.id ?? null);
      if (!hit) return;
      this.pointerId = event.pointerId;
      this.draggedId = hit.id;
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.style.cursor = "grabbing";
    });

    this.canvas.addEventListener("pointermove", (event) => {
      const point = this.pointFromEvent(event);
      if (event.pointerId === this.pointerId && this.velocityDraggedId) {
        this.updateVelocityFromPoint(this.velocityDraggedId, point);
        return;
      }
      if (event.pointerId !== this.pointerId || !this.draggedId) {
        this.canvas.style.cursor = this.hitVelocityHandle(point)
          ? "pointer"
          : this.hitTest(point) ? "grab" : "crosshair";
        return;
      }
      const object = this.objects.get(this.draggedId);
      const body = this.simulation.getBody(this.draggedId);
      if (!object || !body) return;
      const halfWidth = object.shape === "circle" ? object.radius : object.width / 2;
      const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
      body.state.position = {
        x: Math.max(14 + halfWidth, Math.min(this.canvas.width - 14 - halfWidth, point.x)),
        y: Math.max(14 + halfHeight, Math.min(this.floorY - halfHeight, point.y)),
      };
      body.state.velocity = { x: 0, y: 0 };
      object.x = body.state.position.x;
      object.y = body.state.position.y;
      this.trails.set(object.id, [{ ...body.state.position }]);
      this.notify();
    });

    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.draggedId = null;
      this.velocityDraggedId = null;
      this.canvas.style.cursor = "grab";
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }

  private hitTest(point: Vector2): PlaygroundObject | null {
    for (const object of [...this.objects.values()].reverse()) {
      const dx = point.x - object.x;
      const dy = point.y - object.y;
      const hit = object.shape === "circle"
        ? dx * dx + dy * dy <= object.radius ** 2
        : Math.abs(dx) <= object.width / 2 && Math.abs(dy) <= object.height / 2;
      if (hit) return object;
    }
    return null;
  }

  private hitVelocityHandle(point: Vector2): PlaygroundObject | null {
    if (!this.selectedId) return null;
    const object = this.objects.get(this.selectedId);
    const body = this.simulation.getBody(this.selectedId);
    if (!object || !body) return null;
    const vector = this.velocityControlVector(object, body.state.velocity);
    const dx = point.x - object.x - vector.x;
    const dy = point.y - object.y - vector.y;
    return dx * dx + dy * dy <= VELOCITY_HANDLE_RADIUS ** 2 ? object : null;
  }

  private updateVelocityFromPoint(id: string, point: Vector2): void {
    const object = this.objects.get(id);
    const body = this.simulation.getBody(id);
    if (!object || !body) return;
    let x = point.x - object.x;
    let y = point.y - object.y;
    const length = Math.hypot(x, y);
    if (length < 8) {
      body.state.velocity = { x: 0, y: 0 };
    } else {
      const angle = Math.round(Math.atan2(y, x) / VELOCITY_ANGLE_SNAP_RADIANS) * VELOCITY_ANGLE_SNAP_RADIANS;
      x = Math.cos(angle) * length;
      y = Math.sin(angle) * length;
      if (length > MAX_VELOCITY_VECTOR_LENGTH) {
        x *= MAX_VELOCITY_VECTOR_LENGTH / length;
        y *= MAX_VELOCITY_VECTOR_LENGTH / length;
      }
      body.state.velocity = {
        x: x / VELOCITY_VECTOR_SCALE,
        y: y / VELOCITY_VECTOR_SCALE,
      };
    }
    this.trails.set(id, [{ ...body.state.position }]);
    this.notify();
  }

  private pointFromEvent(event: PointerEvent): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.canvas.width / rect.width,
      y: (event.clientY - rect.top) * this.canvas.height / rect.height,
    };
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const { ctx } = this;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private toPixels(vector: Vector2): Vector2 {
    return { x: vector.x * PIXELS_PER_METER, y: vector.y * PIXELS_PER_METER };
  }

  private nextColor(): string { return COLORS[this.objects.size % COLORS.length]; }

  private nextObjectId(): string {
    this.objectSequence += 1;
    return `body-${this.objectSequence}`;
  }

  private shadeColor(hex: string, amount: number): string {
    const value = Number.parseInt(hex.slice(1), 16);
    const channels = [
      Math.max(0, Math.min(255, (value >> 16) + amount)),
      Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount)),
      Math.max(0, Math.min(255, (value & 0xff) + amount)),
    ];
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  private notify(): void { this.onUpdate?.(this.snapshot()); }
}
