import type { Vector2 } from "../physics/core";
import { PointGravityField, UniformGravityField } from "../physics/fields";
import {
  AnchoredSpringLaw,
  BuoyancyRegionLaw,
  HorizontalSurfaceFrictionLaw,
} from "../physics/laws/world-mechanics";
import { PhysicsSimulation } from "../physics/simulation";
import type { Body } from "../physics/world";
import {
  PendulumModel,
  PulleyModel,
  RotationBalanceModel,
  type KinematicPose,
} from "./mechanics-scenes";

export type PlaygroundShape = "circle" | "box";
export type PlaygroundPreset =
  | "free-fall"
  | "projectile"
  | "collision"
  | "spring"
  | "friction"
  | "rotation"
  | "orbit"
  | "buoyancy"
  | "constraints"
  | "pulley";
export type PlaygroundMaterial = "rubber" | "wood" | "steel" | "clay";
export type SandboxObjectKind = "ball" | "box" | "block";

export const MATERIALS: Readonly<Record<PlaygroundMaterial, {
  restitution: number;
  friction: number;
}>> = {
  rubber: { restitution: 0.88, friction: 0.42 },
  wood: { restitution: 0.5, friction: 0.22 },
  steel: { restitution: 0.72, friction: 0.08 },
  clay: { restitution: 0.08, friction: 0.58 },
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
  fixed?: boolean;
}

export interface PlaygroundSnapshot {
  paused: boolean;
  gravity: number;
  preset: PlaygroundPreset;
  selected: {
    id: string;
    label: string;
    shape: PlaygroundShape;
    color: string;
    mass: number;
    material: PlaygroundMaterial;
    fixed: boolean;
  } | null;
  graph: PlaygroundGraph | null;
}

export interface PlaygroundGraph {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Array<{ label: string; color: string }>;
  samples: Array<{ time: number; values: number[] }>;
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
const RESIZE_HANDLE_RADIUS = 13;
const MIN_BLOCK_WIDTH = 28;
const MIN_BLOCK_HEIGHT = 24;
const GRAPH_SAMPLE_INTERVAL = 1 / 12;
const MAX_GRAPH_SAMPLES = 150;
const TRAJECTORY_PREVIEW_STEP = 0.08;
const TRAJECTORY_PREVIEW_STEPS = 45;
const SPRING_MOUNT_CLEARANCE = 8;
const PULLEY_ROPE_LENGTH_LIMIT = 235;
const PULLEY_ROPE_HEIGHT_RATIO = 0.42;
const PULLEY_TRAVEL_LIMIT = 128;
const PULLEY_TRAVEL_HEIGHT_RATIO = 0.23;
const PULLEY_FLOOR_CLEARANCE = 40;
const COLORS = ["#5b7cfa", "#f27a54", "#25a77a", "#a069dc", "#e2a62b"];

type ResizeHandle = "width" | "height" | "both";

const GRAPH_SPECS: Readonly<Record<PlaygroundPreset, Omit<PlaygroundGraph, "samples" | "xLabel">>> = {
  "free-fall": {
    title: "바닥까지 남은 높이",
    yLabel: "높이 (m)",
    series: [
      { label: "가벼운 공", color: "#5b7cfa" },
      { label: "기준 공", color: "#25a77a" },
      { label: "무거운 공", color: "#f27a54" },
    ],
  },
  projectile: {
    title: "발사체의 높이",
    yLabel: "높이 (m)",
    series: [{ label: "발사체", color: "#5b7cfa" }],
  },
  collision: {
    title: "두 물체의 운동량",
    yLabel: "운동량 (kg·m/s)",
    series: [
      { label: "물체 A", color: "#5b7cfa" },
      { label: "물체 B", color: "#f27a54" },
    ],
  },
  spring: {
    title: "에너지가 바뀌는 모습",
    yLabel: "에너지 비율 (%)",
    series: [
      { label: "움직임", color: "#5b7cfa" },
      { label: "용수철", color: "#a069dc" },
    ],
  },
  friction: {
    title: "미끄러지는 속력",
    yLabel: "속력 (m/s)",
    series: [{ label: "공", color: "#e2a62b" }],
  },
  rotation: {
    title: "막대의 기울기",
    yLabel: "각도 (°)",
    series: [{ label: "막대", color: "#5b7cfa" }],
  },
  constraints: {
    title: "두 진자의 각도",
    yLabel: "각도 (°)",
    series: [
      { label: "줄", color: "#5b7cfa" },
      { label: "막대", color: "#25a77a" },
    ],
  },
  pulley: {
    title: "두 추의 높이",
    yLabel: "높이 (m)",
    series: [
      { label: "왼쪽 추", color: "#5b7cfa" },
      { label: "오른쪽 추", color: "#f27a54" },
    ],
  },
  orbit: {
    title: "큰 별에서 떨어진 거리",
    yLabel: "중심 거리 (m)",
    series: [{ label: "작은 별", color: "#5b7cfa" }],
  },
  buoyancy: {
    title: "물에 잠긴 깊이",
    yLabel: "잠긴 깊이 (m)",
    series: [{ label: "공", color: "#f27a54" }],
  },
};

type GuidedMechanicsScene =
  | {
    kind: "rotation";
    leftId: string;
    rightId: string;
    model: RotationBalanceModel;
  }
  | {
    kind: "constraints";
    ropeId: string;
    rodId: string;
    rope: PendulumModel;
    rod: PendulumModel;
  }
  | {
    kind: "pulley";
    leftId: string;
    rightId: string;
    model: PulleyModel;
  };

interface OrbitExperiment {
  field: PointGravityField;
  centerId: string;
  bodyId: string;
  guideRadius: number;
}

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
  private resizingId: string | null = null;
  private resizeHandle: ResizeHandle | null = null;
  private resizeAnchor: Vector2 | null = null;
  private selectedId: string | null = null;
  private labMode = true;
  private graphTime = 0;
  private lastGraphSampleTime = 0;
  private graphSamples: PlaygroundGraph["samples"] = [];
  private lastFrame = 0;
  private lastNotification = 0;
  private accumulator = 0;
  private trailTick = 0;
  private objectSequence = 0;
  private readonly trails = new Map<string, Vector2[]>();
  private springLaw: AnchoredSpringLaw | null = null;
  private frictionLaw: HorizontalSurfaceFrictionLaw | null = null;
  private buoyancyLaw: BuoyancyRegionLaw | null = null;
  private guidedScene: GuidedMechanicsScene | null = null;
  private orbitExperiment: OrbitExperiment | null = null;
  private impulseFlash = 0;

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
    return this.addSandboxObject("ball");
  }

  addSandboxObject(kind: SandboxObjectKind): PlaygroundObject {
    this._paused = true;
    this.accumulator = 0;
    const sequence = this.objects.size + 1;
    if (kind === "ball") {
      return this.addCircle(this.canvas.width * 0.3, 115, 25, {
        label: `공 ${sequence}`,
        material: "rubber",
      });
    }
    if (kind === "box") {
      return this.addBox(this.canvas.width * 0.62, 115, 56, 56, {
        label: `상자 ${sequence}`,
        material: "wood",
      });
    }
    return this.addBox(this.canvas.width * 0.58, this.floorY - 115, 170, 26, {
      label: `고정 블록 ${sequence}`,
      color: "#718099",
      material: "steel",
      fixed: true,
    });
  }

  startSandbox(): void {
    this._paused = true;
    this.labMode = false;
    this.resetGraph();
    this.currentPreset = "free-fall";
    this.accumulator = 0;
    this.trailTick = 0;
    this.selectedId = null;
    this.objects.clear();
    this.trails.clear();
    this.clearExperimentLaws();
    this.simulation.clear();
    this.replaceGravity(9.81);
    this.addCircle(this.canvas.width * 0.5, 120, 28, {
      label: "물체 1",
      color: "#5b7cfa",
      mass: 1,
      material: "rubber",
    });
    this.notify();
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

  loadPreset(preset: PlaygroundPreset, autoPlay = false): void {
    this._paused = true;
    this.labMode = true;
    this.resetGraph();
    this.currentPreset = preset;
    this.accumulator = 0;
    this.trailTick = 0;
    this.selectedId = null;
    this.objects.clear();
    this.trails.clear();
    this.clearExperimentLaws();
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
    } else if (preset === "collision") {
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
    } else if (preset === "spring") {
      this.replaceGravity(0);
      const anchor = { x: this.canvas.width * 0.22, y: this.floorY * 0.52 };
      const restLength = this.canvas.width * 0.28;
      const object = this.addCircle(anchor.x + restLength + this.canvas.width * 0.12, anchor.y, 28, {
        label: "용수철 공",
        color: "#a069dc",
        mass: 1,
        material: "wood",
      });
      this.springLaw = new AnchoredSpringLaw({
        bodyId: object.id,
        anchor,
        restLength,
        stiffness: 5,
        damping: 0.45,
      });
      this.simulation.addLaw(this.springLaw);
      this.simulation.refreshAccelerations();
    } else if (preset === "friction") {
      this.replaceGravity(9.81);
      const object = this.addCircle(145, this.floorY - 27, 27, {
        label: "미끄러지는 공",
        color: "#e2a62b",
        mass: 1,
        material: "wood",
        velocity: { x: 6.2, y: 0 },
      });
      this.frictionLaw = new HorizontalSurfaceFrictionLaw({
        bodyId: object.id,
        surfaceY: this.floorY,
        coefficient: MATERIALS[object.material].friction,
        normalAcceleration: this.gravity * PIXELS_PER_METER,
      });
      this.simulation.addLaw(this.frictionLaw);
      this.simulation.refreshAccelerations();
    } else if (preset === "rotation") {
      this.replaceGravity(9.81);
      const model = new RotationBalanceModel(
        { x: this.canvas.width * 0.5, y: this.floorY * 0.52 },
        this.canvas.width * 0.22,
      );
      const poses = model.poses();
      const left = this.addCircle(poses.left.position.x, poses.left.position.y, 24, {
        label: "가벼운 추",
        color: "#5b7cfa",
        mass: 0.5,
        material: "steel",
        fixed: true,
      });
      const right = this.addCircle(poses.right.position.x, poses.right.position.y, 30, {
        label: "무거운 추",
        color: "#f27a54",
        mass: 3,
        material: "steel",
        fixed: true,
      });
      this.guidedScene = { kind: "rotation", leftId: left.id, rightId: right.id, model };
      this.setBodyPose(left.id, poses.left);
      this.setBodyPose(right.id, poses.right);
    } else if (preset === "orbit") {
      this.replaceGravity(0);
      const center = { x: this.canvas.width * 0.5, y: this.floorY * 0.5 };
      const radius = Math.min(this.canvas.width * 0.24, this.floorY * 0.34);
      const orbitalSpeed = 155;
      const field = new PointGravityField(center, 1, orbitalSpeed ** 2 * radius);
      this.simulation.addField(field);
      const centerObject = this.addCircle(center.x, center.y, 38, {
        label: "큰 별",
        color: "#e2a62b",
        mass: 20,
        material: "steel",
        fixed: true,
      });
      const orbiting = this.addCircle(center.x + radius, center.y, 21, {
        label: "작은 별",
        color: "#5b7cfa",
        mass: 1,
        material: "steel",
        velocity: { x: 0, y: -orbitalSpeed / PIXELS_PER_METER },
      });
      this.orbitExperiment = {
        field,
        centerId: centerObject.id,
        bodyId: orbiting.id,
        guideRadius: radius,
      };
      this.simulation.refreshAccelerations();
    } else if (preset === "buoyancy") {
      this.replaceGravity(9.81);
      const waterline = this.floorY * 0.4;
      const object = this.addCircle(this.canvas.width * 0.5, waterline - 70, 35, {
        label: "물에 띄울 공",
        color: "#f27a54",
        mass: 1,
        material: "wood",
      });
      this.buoyancyLaw = new BuoyancyRegionLaw({
        bodyId: object.id,
        waterline,
        displacedMass: 1.45,
        gravityAcceleration: this.gravity * PIXELS_PER_METER,
      });
      this.simulation.addLaw(this.buoyancyLaw);
      this.simulation.refreshAccelerations();
    } else if (preset === "constraints") {
      this.replaceGravity(9.81);
      const length = Math.min(210, this.floorY * 0.42);
      const rope = new PendulumModel({ x: this.canvas.width * 0.34, y: 105 }, length, 0.62, 0.06);
      const rod = new PendulumModel({ x: this.canvas.width * 0.68, y: 105 }, length, -0.5, 0.03);
      const ropePose = rope.pose();
      const rodPose = rod.pose();
      const ropeObject = this.addCircle(ropePose.position.x, ropePose.position.y, 25, {
        label: "줄 추",
        color: "#5b7cfa",
        mass: 1,
        material: "wood",
        fixed: true,
      });
      const rodObject = this.addCircle(rodPose.position.x, rodPose.position.y, 25, {
        label: "막대 추",
        color: "#25a77a",
        mass: 1,
        material: "steel",
        fixed: true,
      });
      this.guidedScene = {
        kind: "constraints",
        ropeId: ropeObject.id,
        rodId: rodObject.id,
        rope,
        rod,
      };
      this.setBodyPose(ropeObject.id, ropePose);
      this.setBodyPose(rodObject.id, rodPose);
    } else {
      this.replaceGravity(9.81);
      const center = { x: this.canvas.width * 0.5, y: 125 };
      const ropeLength = Math.min(PULLEY_ROPE_LENGTH_LIMIT, this.floorY * PULLEY_ROPE_HEIGHT_RATIO);
      const floorLimitedTravel = Math.max(
        0,
        this.floorY - center.y - ropeLength - PULLEY_FLOOR_CLEARANCE,
      );
      const model = new PulleyModel(
        center,
        Math.min(58, this.canvas.width * 0.07),
        ropeLength,
        Math.min(PULLEY_TRAVEL_LIMIT, this.floorY * PULLEY_TRAVEL_HEIGHT_RATIO, floorLimitedTravel),
      );
      const poses = model.poses();
      const left = this.addCircle(poses.left.position.x, poses.left.position.y, 25, {
        label: "가벼운 추",
        color: "#5b7cfa",
        mass: 1,
        material: "steel",
        fixed: true,
      });
      const right = this.addCircle(poses.right.position.x, poses.right.position.y, 31, {
        label: "무거운 추",
        color: "#f27a54",
        mass: 3,
        material: "steel",
        fixed: true,
      });
      this.guidedScene = { kind: "pulley", leftId: left.id, rightId: right.id, model };
      this.setBodyPose(left.id, poses.left);
      this.setBodyPose(right.id, poses.right);
    }
    this._paused = !autoPlay;
    this.recordGraphSample(true);
    this.notify();
  }

  reset(autoPlay = false): void { this.loadPreset(this.currentPreset, autoPlay); }

  stepOnce(): void {
    if (!this.paused) return;
    this.advance(1 / 60);
    this.syncObjects();
    this.render();
    this.notify();
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    const guidedIds = this.guidedBodyIds();
    if (guidedIds.includes(this.selectedId)) {
      for (const id of guidedIds) {
        this.simulation.removeBody(id);
        this.objects.delete(id);
        this.trails.delete(id);
      }
      this.guidedScene = null;
      this.selectedId = null;
      this.notify();
      return;
    }
    if (
      this.orbitExperiment
      && [this.orbitExperiment.centerId, this.orbitExperiment.bodyId].includes(this.selectedId)
    ) {
      this.simulation.removeBody(this.orbitExperiment.centerId);
      this.simulation.removeBody(this.orbitExperiment.bodyId);
      this.objects.delete(this.orbitExperiment.centerId);
      this.objects.delete(this.orbitExperiment.bodyId);
      this.simulation.removeField(this.orbitExperiment.field.id);
      this.orbitExperiment = null;
      this.selectedId = null;
      this.notify();
      return;
    }
    if (this.springLaw?.bodyId === this.selectedId) {
      this.simulation.removeLaw(this.springLaw.id);
      this.springLaw = null;
    }
    if (this.frictionLaw?.bodyId === this.selectedId) {
      this.simulation.removeLaw(this.frictionLaw.id);
      this.frictionLaw = null;
    }
    if (this.buoyancyLaw?.bodyId === this.selectedId) {
      this.simulation.removeLaw(this.buoyancyLaw.id);
      this.buoyancyLaw = null;
    }
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
      if (this.frictionLaw?.bodyId === object.id) {
        this.frictionLaw.setCoefficient(MATERIALS[update.material].friction);
      }
    }
    this.clearTrails();
    this.simulation.refreshAccelerations();
    this.advanceGuidedScene(0);
    this.recordGraphSample(true);
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
          fixed: Boolean(body.fixed),
        };
      }
    }
    return {
      paused: this.paused,
      gravity: this.gravity,
      preset: this.currentPreset,
      selected,
      graph: this.labMode ? {
        ...GRAPH_SPECS[this.currentPreset],
        xLabel: "시간",
        samples: this.graphSamples.map((sample) => ({ time: sample.time, values: [...sample.values] })),
      } : null,
    };
  }

  clearTrails(): void {
    for (const [id, object] of this.objects) this.trails.set(id, [{ x: object.x, y: object.y }]);
  }

  private resetGraph(): void {
    this.graphTime = 0;
    this.lastGraphSampleTime = 0;
    this.graphSamples = [];
  }

  private recordGraphProgress(dt: number): void {
    if (!this.labMode) return;
    this.graphTime += dt;
    if (this.graphTime - this.lastGraphSampleTime >= GRAPH_SAMPLE_INTERVAL) {
      this.recordGraphSample();
    }
  }

  private recordGraphSample(replaceAtCurrentTime = false): void {
    if (!this.labMode) return;
    const sample = { time: this.graphTime, values: this.currentGraphValues() };
    const last = this.graphSamples.at(-1);
    if (replaceAtCurrentTime && last && Math.abs(last.time - this.graphTime) < 0.0001) {
      this.graphSamples[this.graphSamples.length - 1] = sample;
    } else {
      this.graphSamples.push(sample);
    }
    if (this.graphSamples.length > MAX_GRAPH_SAMPLES) this.graphSamples.shift();
    this.lastGraphSampleTime = this.graphTime;
  }

  private currentGraphValues(): number[] {
    const objects = [...this.objects.values()];
    if (this.currentPreset === "free-fall") {
      return objects.map((object) => this.heightAboveFloor(object));
    }
    if (this.currentPreset === "projectile") {
      return objects[0] ? [this.heightAboveFloor(objects[0])] : [0];
    }
    if (this.currentPreset === "collision") {
      return objects.slice(0, 2).map((object) => {
        const body = this.simulation.getBody(object.id);
        return body ? body.state.mass * body.state.velocity.x / PIXELS_PER_METER : 0;
      });
    }
    if (this.currentPreset === "spring") {
      const law = this.springLaw;
      const object = objects[0];
      const body = object ? this.simulation.getBody(object.id) : undefined;
      if (!law || !body) return [0, 0];
      const speed = Math.hypot(body.state.velocity.x, body.state.velocity.y) / PIXELS_PER_METER;
      const extension = (
        Math.hypot(body.state.position.x - law.anchor.x, body.state.position.y - law.anchor.y)
        - law.restLength
      ) / PIXELS_PER_METER;
      const kinetic = 0.5 * body.state.mass * speed ** 2;
      const spring = 0.5 * law.stiffness * extension ** 2;
      const total = kinetic + spring;
      return total > 0.0001 ? [kinetic / total * 100, spring / total * 100] : [0, 0];
    }
    if (this.currentPreset === "friction") {
      const body = objects[0] ? this.simulation.getBody(objects[0].id) : undefined;
      return [body ? Math.hypot(body.state.velocity.x, body.state.velocity.y) / PIXELS_PER_METER : 0];
    }
    if (this.currentPreset === "rotation") {
      return [this.guidedScene?.kind === "rotation" ? this.toDegrees(this.guidedScene.model.angle) : 0];
    }
    if (this.currentPreset === "constraints") {
      return this.guidedScene?.kind === "constraints"
        ? [this.toDegrees(this.guidedScene.rope.angle), this.toDegrees(this.guidedScene.rod.angle)]
        : [0, 0];
    }
    if (this.currentPreset === "pulley") {
      return objects.slice(0, 2).map((object) => this.heightAboveFloor(object));
    }
    if (this.currentPreset === "orbit") {
      const orbit = this.orbitExperiment;
      const body = orbit ? this.simulation.getBody(orbit.bodyId) : undefined;
      return orbit && body ? [Math.hypot(
        body.state.position.x - orbit.field.sourcePosition.x,
        body.state.position.y - orbit.field.sourcePosition.y,
      ) / PIXELS_PER_METER] : [0];
    }
    const law = this.buoyancyLaw;
    const object = objects[0];
    const body = object ? this.simulation.getBody(object.id) : undefined;
    if (!law || !object || !body) return [0];
    const submergedHeight = Math.max(
      0,
      Math.min(object.height, body.state.position.y + object.height / 2 - law.waterline),
    );
    return [submergedHeight / PIXELS_PER_METER];
  }

  private heightAboveFloor(object: PlaygroundObject): number {
    const body = this.simulation.getBody(object.id);
    if (!body) return 0;
    const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
    return Math.max(0, (this.floorY - body.state.position.y - halfHeight) / PIXELS_PER_METER);
  }

  private toDegrees(radians: number): number { return radians * 180 / Math.PI; }

  private registerObject(object: PlaygroundObject, options: PlaygroundObjectOptions): void {
    this.objects.set(object.id, object);
    this.trails.set(object.id, [{ x: object.x, y: object.y }]);
    this.simulation.addBody({
      id: object.id,
      radius: object.radius,
      collider: object.shape === "circle"
        ? { kind: "circle", radius: object.radius }
        : { kind: "box", halfWidth: object.width / 2, halfHeight: object.height / 2 },
      restitution: MATERIALS[object.material].restitution,
      fixed: options.fixed,
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
    this.frictionLaw?.setNormalAcceleration(value * PIXELS_PER_METER);
    this.buoyancyLaw?.setGravityAcceleration(value * PIXELS_PER_METER);
    this.simulation.refreshAccelerations();
    this.advanceGuidedScene(0);
  }

  private clearExperimentLaws(): void {
    if (this.springLaw) this.simulation.removeLaw(this.springLaw.id);
    if (this.frictionLaw) this.simulation.removeLaw(this.frictionLaw.id);
    if (this.buoyancyLaw) this.simulation.removeLaw(this.buoyancyLaw.id);
    if (this.orbitExperiment) this.simulation.removeField(this.orbitExperiment.field.id);
    this.springLaw = null;
    this.frictionLaw = null;
    this.buoyancyLaw = null;
    this.guidedScene = null;
    this.orbitExperiment = null;
    this.impulseFlash = 0;
  }

  private gravityAcceleration(): Vector2 {
    return { x: 0, y: this.gravity * PIXELS_PER_METER };
  }

  private guidedBodyIds(): string[] {
    const scene = this.guidedScene;
    if (!scene) return [];
    if (scene.kind === "rotation" || scene.kind === "pulley") return [scene.leftId, scene.rightId];
    return [scene.ropeId, scene.rodId];
  }

  private isGuidedBody(id: string): boolean { return this.guidedBodyIds().includes(id); }

  private setBodyPose(id: string, pose: KinematicPose): void {
    const body = this.simulation.getBody(id);
    if (!body) return;
    body.state.position = { ...pose.position };
    body.state.velocity = { ...pose.velocity };
    body.state.acceleration = { ...pose.acceleration };
  }

  private applyGuidedScenePoses(): void {
    const scene = this.guidedScene;
    if (!scene) return;
    if (scene.kind === "rotation") {
      const poses = scene.model.poses();
      this.setBodyPose(scene.leftId, poses.left);
      this.setBodyPose(scene.rightId, poses.right);
    } else if (scene.kind === "constraints") {
      this.setBodyPose(scene.ropeId, scene.rope.pose());
      this.setBodyPose(scene.rodId, scene.rod.pose());
    } else {
      const poses = scene.model.poses();
      this.setBodyPose(scene.leftId, poses.left);
      this.setBodyPose(scene.rightId, poses.right);
    }
  }

  private advanceGuidedScene(dt: number): void {
    const scene = this.guidedScene;
    if (!scene) return;
    const gravity = this.gravity * PIXELS_PER_METER;
    if (scene.kind === "rotation") {
      const leftMass = this.simulation.getBody(scene.leftId)?.state.mass ?? 1;
      const rightMass = this.simulation.getBody(scene.rightId)?.state.mass ?? 1;
      scene.model.step(dt, gravity, leftMass, rightMass);
    } else if (scene.kind === "constraints") {
      scene.rope.step(dt, gravity);
      scene.rod.step(dt, gravity);
    } else {
      const leftMass = this.simulation.getBody(scene.leftId)?.state.mass ?? 1;
      const rightMass = this.simulation.getBody(scene.rightId)?.state.mass ?? 1;
      scene.model.step(dt, gravity, leftMass, rightMass);
    }
    this.applyGuidedScenePoses();
  }

  private dragGuidedBody(id: string, point: Vector2): boolean {
    const scene = this.guidedScene;
    if (!scene || !this.isGuidedBody(id)) return false;
    if (scene.kind === "rotation") {
      scene.model.moveEndpoint(id === scene.leftId ? -1 : 1, point);
    } else if (scene.kind === "constraints") {
      (id === scene.ropeId ? scene.rope : scene.rod).moveTo(point);
    } else {
      scene.model.moveWeight(id === scene.leftId ? "left" : "right", point);
    }
    this.advanceGuidedScene(0);
    this.clearTrails();
    return true;
  }

  private resizeGuidedScene(scaleX: number, scaleY: number): void {
    const scene = this.guidedScene;
    if (!scene) return;
    if (scene.kind === "rotation" || scene.kind === "pulley") {
      scene.model.resize(scaleX, scaleY);
    } else {
      scene.rope.resize(scaleX, scaleY);
      scene.rod.resize(scaleX, scaleY);
    }
    this.applyGuidedScenePoses();
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
    const scaleX = width / previousWidth;
    const scaleY = nextFloorY / previousFloorY;

    if (this.springLaw) {
      const anchor = {
        x: this.springLaw.anchor.x * width / previousWidth,
        y: this.scaleBetweenBounds(this.springLaw.anchor.y, 14, previousFloorY, 14, nextFloorY),
      };
      this.springLaw.setGeometry(anchor, this.springLaw.restLength * width / previousWidth);
    }
    this.frictionLaw?.setSurfaceY(nextFloorY);
    this.buoyancyLaw?.setWaterline(this.buoyancyLaw.waterline * scaleY);
    if (this.orbitExperiment) {
      const orbitScale = Math.min(scaleX, scaleY);
      const previousField = this.orbitExperiment.field;
      const sourcePosition = {
        x: previousField.sourcePosition.x * scaleX,
        y: previousField.sourcePosition.y * scaleY,
      };
      this.simulation.removeField(previousField.id);
      this.orbitExperiment.field = new PointGravityField(
        sourcePosition,
        previousField.sourceMass,
        previousField.G * orbitScale,
      );
      this.simulation.addField(this.orbitExperiment.field);
      this.orbitExperiment.guideRadius *= orbitScale;
    }
    this.resizeGuidedScene(scaleX, scaleY);

    for (const [id, object] of this.objects) {
      const body = this.simulation.getBody(id);
      if (!body || this.isGuidedBody(id)) continue;
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
    this.simulation.refreshAccelerations();
  }

  private scaleBetweenBounds(value: number, oldMin: number, oldMax: number, nextMin: number, nextMax: number): number {
    if (oldMax <= oldMin || nextMax <= nextMin) return nextMin;
    const ratio = Math.max(0, Math.min(1, (value - oldMin) / (oldMax - oldMin)));
    return nextMin + ratio * (nextMax - nextMin);
  }

  private advance(dt: number): void {
    const springBody = this.springLaw ? this.simulation.getBody(this.springLaw.bodyId) : undefined;
    const springPreviousPosition = springBody ? { ...springBody.state.position } : null;
    this.simulation.step(dt);
    this.advanceGuidedScene(dt);
    this.resolveSpringMount(springPreviousPosition);
    if (this.currentPreset === "collision" && this.simulation.collisionEvents.length > 0) {
      this.impulseFlash = 1;
    } else {
      this.impulseFlash = Math.max(0, this.impulseFlash - dt * 2.5);
    }
    this.applyPresetDamping(dt);
    this.resolveWorldBounds();
    this.recordGraphProgress(dt);
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

  private resolveSpringMount(previousPosition: Vector2 | null): void {
    const law = this.springLaw;
    if (!law || !previousPosition) return;
    const body = this.simulation.getBody(law.bodyId);
    const object = this.objects.get(law.bodyId);
    if (!body || !object) return;

    const minimumDistance = object.radius + SPRING_MOUNT_CLEARANCE;
    const start = {
      x: previousPosition.x - law.anchor.x,
      y: previousPosition.y - law.anchor.y,
    };
    const end = {
      x: body.state.position.x - law.anchor.x,
      y: body.state.position.y - law.anchor.y,
    };
    const movement = { x: end.x - start.x, y: end.y - start.y };
    const endDistance = Math.hypot(end.x, end.y);
    let normal: Vector2 | null = null;

    if (endDistance < minimumDistance) {
      const startDistance = Math.hypot(start.x, start.y);
      const direction = endDistance > 0.0001 ? end : start;
      const directionLength = endDistance > 0.0001 ? endDistance : startDistance;
      normal = directionLength > 0.0001
        ? { x: direction.x / directionLength, y: direction.y / directionLength }
        : { x: 1, y: 0 };
    } else {
      const a = movement.x ** 2 + movement.y ** 2;
      if (a === 0) return;
      const b = 2 * (start.x * movement.x + start.y * movement.y);
      const c = start.x ** 2 + start.y ** 2 - minimumDistance ** 2;
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant < 0) return;
      const contactTime = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (contactTime < 0 || contactTime > 1) return;
      const contact = {
        x: start.x + movement.x * contactTime,
        y: start.y + movement.y * contactTime,
      };
      const contactLength = Math.hypot(contact.x, contact.y);
      if (contactLength === 0) return;
      normal = { x: contact.x / contactLength, y: contact.y / contactLength };
      if (movement.x * normal.x + movement.y * normal.y >= 0) return;
    }

    body.state.position = {
      x: law.anchor.x + normal.x * minimumDistance,
      y: law.anchor.y + normal.y * minimumDistance,
    };
    const inwardSpeed = body.state.velocity.x * normal.x + body.state.velocity.y * normal.y;
    if (inwardSpeed < 0) {
      body.state.velocity = {
        x: body.state.velocity.x - normal.x * inwardSpeed,
        y: body.state.velocity.y - normal.y * inwardSpeed,
      };
    }
    this.simulation.refreshAccelerations();
  }

  private resolveWorldBounds(): void {
    const margin = 14;
    for (const object of this.objects.values()) {
      const body = this.simulation.getBody(object.id);
      if (!body || this.isGuidedBody(object.id)) continue;
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
    if (this.buoyancyLaw) this.drawWaterRegion();
    if (this.visualization.trails) this.drawTrails();
    this.drawGround();
    if (this.frictionLaw) this.drawFrictionSurface();
    this.drawOrbitGuide();
    this.drawGuidedScene();
    if (this.springLaw) this.drawSpringConnection();
    this.drawTrajectoryPreview();
    for (const object of this.objects.values()) this.drawObject(object);
    if (this.currentPreset === "collision") this.drawMomentumVisualization();
    if (this.currentPreset === "spring") this.drawEnergyVisualization();
  }

  private drawWaterRegion(): void {
    const law = this.buoyancyLaw;
    if (!law) return;
    const { ctx, canvas } = this;
    const water = ctx.createLinearGradient(0, law.waterline, 0, this.floorY);
    water.addColorStop(0, "#8cd5f080");
    water.addColorStop(1, "#4c9fdbb8");
    ctx.save();
    ctx.fillStyle = water;
    ctx.fillRect(0, law.waterline, canvas.width, this.floorY - law.waterline);
    ctx.strokeStyle = "#318dc9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 12) {
      const y = law.waterline + Math.sin(x / 24) * 3;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#176c9f";
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.fillText("물", 20, law.waterline + 28);
    ctx.restore();
  }

  private drawOrbitGuide(): void {
    const orbit = this.orbitExperiment;
    if (!orbit) return;
    const { ctx } = this;
    const center = orbit.field.sourcePosition;
    ctx.save();
    ctx.strokeStyle = "#6681d788";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, orbit.guideRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#53699d";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.fillText("중력이 안쪽으로 당기는 궤도", center.x - orbit.guideRadius, center.y - orbit.guideRadius - 14);
    ctx.restore();
  }

  private drawGuidedScene(): void {
    const scene = this.guidedScene;
    if (!scene) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (scene.kind === "rotation") {
      const poses = scene.model.poses();
      ctx.strokeStyle = "#46546a";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(poses.left.position.x, poses.left.position.y);
      ctx.lineTo(poses.right.position.x, poses.right.position.y);
      ctx.stroke();
      this.drawPivot(scene.model.center, "회전축");
    } else if (scene.kind === "constraints") {
      this.drawConstraintLink(scene.rope.anchor, scene.rope.pose().position, false, "줄");
      this.drawConstraintLink(scene.rod.anchor, scene.rod.pose().position, true, "단단한 막대");
      this.drawPivot(scene.rope.anchor, "고정점");
      this.drawPivot(scene.rod.anchor, "고정점");
    } else {
      const poses = scene.model.poses();
      const { center, radius, wheelAngle } = scene.model;
      ctx.strokeStyle = "#34405a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(poses.left.position.x, poses.left.position.y);
      ctx.lineTo(poses.left.position.x, center.y);
      ctx.arc(center.x, center.y, radius, Math.PI, 0);
      ctx.lineTo(poses.right.position.x, poses.right.position.y);
      ctx.stroke();
      ctx.fillStyle = "#eef2f7";
      ctx.strokeStyle = "#59667d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const angle = wheelAngle + spoke * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(center.x + Math.cos(angle) * radius * 0.72, center.y + Math.sin(angle) * radius * 0.72);
        ctx.stroke();
      }
      this.drawPivot(center, "도르래", radius + 18);
    }
    ctx.restore();
  }

  private drawConstraintLink(start: Vector2, end: Vector2, rigid: boolean, label: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = rigid ? "#527a6d" : "#68758a";
    ctx.lineWidth = rigid ? 10 : 4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.fillStyle = rigid ? "#315d50" : "#536078";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, (start.x + end.x) / 2 + 18, (start.y + end.y) / 2);
    ctx.restore();
  }

  private drawPivot(point: Vector2, label: string, labelOffset = 17): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#34405a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#34405a";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, point.x, point.y - labelOffset);
    ctx.restore();
  }

  private drawMomentumVisualization(): void {
    for (const object of this.objects.values()) {
      const body = this.simulation.getBody(object.id);
      if (!body) continue;
      this.drawArrow(
        object.x,
        object.y,
        { x: body.state.velocity.x * body.state.mass, y: body.state.velocity.y * body.state.mass },
        0.16,
        "#196ba0",
        "운동량 p = mv",
      );
    }
    if (this.impulseFlash <= 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = this.impulseFlash;
    ctx.fillStyle = "#fff4c7";
    this.roundRect(this.canvas.width / 2 - 80, 32, 160, 42, 12);
    ctx.fill();
    ctx.fillStyle = "#8b6712";
    ctx.font = "800 16px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("충격량이 전달됐어요", this.canvas.width / 2, 58);
    ctx.restore();
  }

  private drawEnergyVisualization(): void {
    const law = this.springLaw;
    if (!law) return;
    const body = this.simulation.getBody(law.bodyId);
    if (!body) return;
    const speedSquared = body.state.velocity.x ** 2 + body.state.velocity.y ** 2;
    const kinetic = 0.5 * body.state.mass * speedSquared;
    const distance = Math.hypot(body.state.position.x - law.anchor.x, body.state.position.y - law.anchor.y);
    const spring = 0.5 * law.stiffness * (distance - law.restLength) ** 2;
    const total = Math.max(1, kinetic + spring);
    const x = 24;
    const y = 54;
    const width = Math.min(280, this.canvas.width * 0.3);
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#ffffffdd";
    this.roundRect(x, y, width, 66, 12);
    ctx.fill();
    ctx.fillStyle = "#536078";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.fillText("움직임 에너지", x + 12, y + 22);
    ctx.fillText("용수철 에너지", x + 12, y + 49);
    ctx.fillStyle = "#5b7cfa";
    ctx.fillRect(x + 126, y + 11, (width - 140) * kinetic / total, 12);
    ctx.fillStyle = "#a069dc";
    ctx.fillRect(x + 126, y + 38, (width - 140) * spring / total, 12);
    ctx.restore();
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

  private drawFrictionSurface(): void {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.fillStyle = "#f4d681";
    ctx.fillRect(0, this.floorY, canvas.width, 8);
    ctx.strokeStyle = "#c7962c";
    ctx.lineWidth = 2;
    for (let x = 8; x < canvas.width; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, this.floorY + 1);
      ctx.lineTo(x + 7, this.floorY + 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#856116";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.fillText("마찰이 있는 바닥", 18, this.floorY + 29);
    ctx.restore();
  }

  private drawSpringConnection(): void {
    const law = this.springLaw;
    if (!law) return;
    const body = this.simulation.getBody(law.bodyId);
    const object = this.objects.get(law.bodyId);
    if (!body || !object) return;
    const start = law.anchor;
    const centerDx = body.state.position.x - start.x;
    const centerDy = body.state.position.y - start.y;
    const centerDistance = Math.hypot(centerDx, centerDy);
    if (centerDistance === 0) return;
    const nx = centerDx / centerDistance;
    const ny = centerDy / centerDistance;
    const px = -ny;
    const py = nx;
    const end = {
      x: body.state.position.x - nx * Math.max(0, object.radius - 3),
      y: body.state.position.y - ny * Math.max(0, object.radius - 3),
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const equilibrium = {
      x: start.x + nx * law.restLength,
      y: start.y + ny * law.restLength,
    };
    const { ctx } = this;
    const leadLength = Math.min(28, length * 0.11);
    const tailLength = Math.min(24, length * 0.09);
    const coilLength = Math.max(0, length - leadLength - tailLength);
    const coilStart = { x: start.x + nx * leadLength, y: start.y + ny * leadLength };
    const coilEnd = { x: end.x - nx * tailLength, y: end.y - ny * tailLength };
    const turns = 11;
    const amplitude = Math.max(5, Math.min(12, coilLength * 0.055));
    const samples = turns * 20;

    const traceSpring = (): void => {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(coilStart.x, coilStart.y);
      for (let sample = 1; sample <= samples; sample += 1) {
        const progress = sample / samples;
        const along = coilLength * progress;
        const offset = Math.sin(progress * turns * Math.PI * 2) * amplitude;
        ctx.lineTo(
          coilStart.x + nx * along + px * offset,
          coilStart.y + ny * along + py * offset,
        );
      }
      ctx.lineTo(coilEnd.x, coilEnd.y);
      ctx.lineTo(end.x, end.y);
    };

    ctx.save();

    // The equilibrium position is a reference mark, not another object.
    ctx.strokeStyle = "#8157ba77";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(equilibrium.x - px * 19, equilibrium.y - py * 19);
    ctx.lineTo(equilibrium.x + px * 19, equilibrium.y + py * 19);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8157ba";
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("제자리", equilibrium.x + px * 32, equilibrium.y + py * 32);

    // A fixed bracket makes the anchor read as a mounted end of the spring.
    const bracketX = start.x - nx * 12;
    const bracketY = start.y - ny * 12;
    ctx.strokeStyle = "#d7deea";
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bracketX - px * 28, bracketY - py * 28);
    ctx.lineTo(bracketX + px * 28, bracketY + py * 28);
    ctx.stroke();
    ctx.strokeStyle = "#44516a";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = "#8b97aa";
    ctx.lineWidth = 2;
    for (let offset = -22; offset <= 22; offset += 11) {
      const hatchX = bracketX + px * offset;
      const hatchY = bracketY + py * offset;
      ctx.beginPath();
      ctx.moveTo(hatchX - nx * 7 - px * 4, hatchY - ny * 7 - py * 4);
      ctx.lineTo(hatchX + nx * 7 + px * 4, hatchY + ny * 7 + py * 4);
      ctx.stroke();
    }

    // Layered strokes give the coil a rounded metal-wire appearance.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "#4b2e7444";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.strokeStyle = "#5f3d91";
    ctx.lineWidth = 7;
    traceSpring();
    ctx.stroke();
    ctx.shadowColor = "transparent";
    const springHighlight = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    springHighlight.addColorStop(0, "#d7b8f3");
    springHighlight.addColorStop(0.48, "#9d6fd0");
    springHighlight.addColorStop(1, "#cda8ed");
    ctx.strokeStyle = springHighlight;
    ctx.lineWidth = 3;
    traceSpring();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#44516a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(start.x, start.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8f61c2";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#34405a";
    ctx.fillText("고정점", start.x - nx * 5 - px * 24, start.y - ny * 5 - py * 24);
    ctx.restore();
  }

  private drawTrajectoryPreview(): void {
    if (!this.paused || !this.selectedId) return;
    if (this.springLaw?.bodyId === this.selectedId || this.isGuidedBody(this.selectedId)) return;
    const object = this.objects.get(this.selectedId);
    const body = this.simulation.getBody(this.selectedId);
    if (!object || !body || body.fixed || Math.hypot(body.state.velocity.x, body.state.velocity.y) < VELOCITY_IDLE_EPSILON) return;
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
      if (this.isGuidedBody(object.id)) {
        if (this.visualization.vectors) {
          this.drawArrow(object.x, object.y, body.state.velocity, 0.22, "#7257d5", "운동 방향");
        }
      } else if (!body.fixed) {
        this.drawVelocityControl(object, body.state.velocity);
      }
      if (this.visualization.vectors && (!body.fixed || this.isGuidedBody(object.id))) {
        this.drawArrow(object.x, object.y, body.state.acceleration, 0.14, "#e05c3f", "가속도");
      }
      if (this.isResizableBlock(object, body)) this.drawResizeHandles(object);
    }
  }

  private drawResizeHandles(object: PlaygroundObject): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#365eea";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const handle of this.resizeHandles(object)) {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      if (handle.kind !== "height") {
        ctx.moveTo(handle.x - 3, handle.y);
        ctx.lineTo(handle.x + 3, handle.y);
      }
      if (handle.kind !== "width") {
        ctx.moveTo(handle.x, handle.y - 3);
        ctx.lineTo(handle.x, handle.y + 3);
      }
      ctx.stroke();
    }
    ctx.restore();
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
    const idle = Math.hypot(velocity.x, velocity.y) < VELOCITY_IDLE_EPSILON;
    const vector = this.velocityControlVector(object, velocity);
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
    if (Math.hypot(velocity.x, velocity.y) < VELOCITY_IDLE_EPSILON) {
      return this.idleVelocityControlVector(object);
    }
    const vector = this.velocityVector(velocity);
    const length = Math.hypot(vector.x, vector.y);
    const minimumLength = (object.shape === "circle"
      ? object.radius
      : Math.max(object.width, object.height) / 2) + VELOCITY_HANDLE_RADIUS + 12;
    if (length >= minimumLength) return vector;
    return {
      x: vector.x * minimumLength / length,
      y: vector.y * minimumLength / length,
    };
  }

  private drawArrow(originX: number, originY: number, vector: Vector2, factor: number, color: string, label: string): void {
    let x = vector.x * factor;
    let y = vector.y * factor;
    const length = Math.hypot(x, y);
    if (length < 3) return;
    if (length < 46) {
      x *= 46 / length;
      y *= 46 / length;
    } else if (length > MAX_VELOCITY_VECTOR_LENGTH) {
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
    const mostlyVertical = Math.abs(y) >= Math.abs(x);
    const labelX = mostlyVertical ? originX + 46 : originX + x * 0.5;
    const labelY = mostlyVertical ? originY + y * 0.5 + 5 : originY + y * 0.5 - 16;
    ctx.textAlign = mostlyVertical ? "left" : "center";
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = "#ffffffeb";
    this.roundRect(
      mostlyVertical ? labelX - 6 : labelX - labelWidth / 2 - 6,
      labelY - 15,
      labelWidth + 12,
      20,
      7,
    );
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      const point = this.pointFromEvent(event);
      const resizeHit = this.hitResizeHandle(point);
      if (resizeHit && this.selectedId) {
        const object = this.objects.get(this.selectedId);
        if (!object) return;
        this.paused = true;
        this.pointerId = event.pointerId;
        this.resizingId = object.id;
        this.resizeHandle = resizeHit;
        this.resizeAnchor = {
          x: object.x - object.width / 2,
          y: object.y - object.height / 2,
        };
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.style.cursor = this.resizeCursor(resizeHit);
        return;
      }
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
      if (event.pointerId === this.pointerId && this.resizingId) {
        this.resizeBlockFromPoint(this.resizingId, point);
        return;
      }
      if (event.pointerId === this.pointerId && this.velocityDraggedId) {
        this.updateVelocityFromPoint(this.velocityDraggedId, point);
        return;
      }
      if (event.pointerId !== this.pointerId || !this.draggedId) {
        const resizeHandle = this.hitResizeHandle(point);
        this.canvas.style.cursor = resizeHandle
          ? this.resizeCursor(resizeHandle)
          : this.hitVelocityHandle(point) ? "pointer" : this.hitTest(point) ? "grab" : "crosshair";
        return;
      }
      const object = this.objects.get(this.draggedId);
      const body = this.simulation.getBody(this.draggedId);
      if (!object || !body) return;
      if (this.dragGuidedBody(this.draggedId, point)) {
        this.syncObjects();
        this.recordGraphSample(true);
        this.notify();
        return;
      }
      const previousPosition = { ...body.state.position };
      const halfWidth = object.shape === "circle" ? object.radius : object.width / 2;
      const halfHeight = object.shape === "circle" ? object.radius : object.height / 2;
      body.state.position = {
        x: Math.max(14 + halfWidth, Math.min(this.canvas.width - 14 - halfWidth, point.x)),
        y: Math.max(14 + halfHeight, Math.min(this.floorY - halfHeight, point.y)),
      };
      body.state.velocity = { x: 0, y: 0 };
      this.resolveSpringMount(previousPosition);
      object.x = body.state.position.x;
      object.y = body.state.position.y;
      this.trails.set(object.id, [{ ...body.state.position }]);
      this.simulation.refreshAccelerations();
      this.recordGraphSample(true);
      this.notify();
    });

    const release = (event: PointerEvent, autoPlay: boolean) => {
      if (event.pointerId !== this.pointerId) return;
      const velocityBody = this.velocityDraggedId
        ? this.simulation.getBody(this.velocityDraggedId)
        : undefined;
      const launchesVelocity = Boolean(
        velocityBody
        && Math.hypot(velocityBody.state.velocity.x, velocityBody.state.velocity.y) >= VELOCITY_IDLE_EPSILON,
      );
      const releasesSpring = Boolean(
        this.draggedId
        && this.springLaw?.bodyId === this.draggedId,
      );
      const releasesGuided = Boolean(this.draggedId && this.isGuidedBody(this.draggedId));
      this.pointerId = null;
      this.draggedId = null;
      this.velocityDraggedId = null;
      this.resizingId = null;
      this.resizeHandle = null;
      this.resizeAnchor = null;
      this.canvas.style.cursor = "grab";
      if (autoPlay && (launchesVelocity || releasesSpring || releasesGuided)) this.paused = false;
    };
    this.canvas.addEventListener("pointerup", (event) => release(event, true));
    this.canvas.addEventListener("pointercancel", (event) => release(event, false));
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
    if (!object || !body || body.fixed || this.isGuidedBody(object.id)) return null;
    const vector = this.velocityControlVector(object, body.state.velocity);
    const dx = point.x - object.x - vector.x;
    const dy = point.y - object.y - vector.y;
    return dx * dx + dy * dy <= VELOCITY_HANDLE_RADIUS ** 2 ? object : null;
  }

  private isResizableBlock(object: PlaygroundObject, body: Body): boolean {
    return object.shape === "box" && Boolean(body.fixed) && !this.isGuidedBody(object.id);
  }

  private resizeHandles(object: PlaygroundObject): Array<Vector2 & { kind: ResizeHandle }> {
    return [
      { kind: "both", x: object.x + object.width / 2, y: object.y + object.height / 2 },
      { kind: "width", x: object.x + object.width / 2, y: object.y },
      { kind: "height", x: object.x, y: object.y + object.height / 2 },
    ];
  }

  private hitResizeHandle(point: Vector2): ResizeHandle | null {
    if (!this.selectedId) return null;
    const object = this.objects.get(this.selectedId);
    const body = this.simulation.getBody(this.selectedId);
    if (!object || !body || !this.isResizableBlock(object, body)) return null;
    let nearest: { kind: ResizeHandle; distanceSquared: number } | null = null;
    for (const handle of this.resizeHandles(object)) {
      const dx = point.x - handle.x;
      const dy = point.y - handle.y;
      const distanceSquared = dx * dx + dy * dy;
      if (
        distanceSquared <= RESIZE_HANDLE_RADIUS ** 2
        && (!nearest || distanceSquared < nearest.distanceSquared)
      ) {
        nearest = { kind: handle.kind, distanceSquared };
      }
    }
    return nearest?.kind ?? null;
  }

  private resizeCursor(handle: ResizeHandle): string {
    if (handle === "width") return "ew-resize";
    if (handle === "height") return "ns-resize";
    return "nwse-resize";
  }

  private resizeBlockFromPoint(id: string, point: Vector2): void {
    const object = this.objects.get(id);
    const body = this.simulation.getBody(id);
    const handle = this.resizeHandle;
    const anchor = this.resizeAnchor;
    if (!object || !body || !handle || !anchor || !this.isResizableBlock(object, body)) return;

    const width = handle === "height"
      ? object.width
      : Math.max(MIN_BLOCK_WIDTH, Math.min(this.canvas.width - 14 - anchor.x, point.x - anchor.x));
    const height = handle === "width"
      ? object.height
      : Math.max(MIN_BLOCK_HEIGHT, Math.min(this.floorY - anchor.y, point.y - anchor.y));
    object.width = width;
    object.height = height;
    object.radius = Math.min(width, height) / 2;
    object.x = anchor.x + width / 2;
    object.y = anchor.y + height / 2;
    body.radius = object.radius;
    body.collider = { kind: "box", halfWidth: width / 2, halfHeight: height / 2 };
    body.state.position = { x: object.x, y: object.y };
    body.state.velocity = { x: 0, y: 0 };
    this.trails.set(id, [{ x: object.x, y: object.y }]);
    this.simulation.refreshAccelerations();
    this.notify();
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
    this.simulation.refreshAccelerations();
    this.recordGraphSample(true);
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
