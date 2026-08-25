import type { Vector2 } from "../../../physics/core";
import {
  capacitorEnergy,
  coulombForceMagnitude,
  currentFromVoltage,
  electricalPower,
  inducedEmf,
  lorentzForce2D,
  magneticFieldAroundWire,
  magneticForceMagnitude,
  parallelPlateCapacitance,
  pointChargeElectricFieldVector,
  pointChargePotential,
} from "../../../physics/laws/electromagnetism";
import type { ElectromagnetismLabId } from "./catalog";

export type ElectromagnetismMode = ElectromagnetismLabId | "sandbox";
export type ElectromagnetismSandboxKind = "charge" | "battery" | "resistor" | "magnet" | "coil" | "probe";

export interface ElectromagnetismSandboxObject {
  readonly id: string;
  readonly kind: ElectromagnetismSandboxKind;
  position: Vector2;
  value: number;
}

export interface GraphPoint { readonly x: number; readonly y: number }

export interface ElectromagnetismSnapshot {
  readonly mode: ElectromagnetismMode;
  readonly running: boolean;
  readonly time: number;
  readonly probe: Vector2;
  readonly level: number;
  readonly sign: 1 | -1;
  readonly direction: 1 | -1;
  readonly coilTurns: number;
  readonly magnetSpeed: number;
  readonly particle: Vector2;
  readonly particleVelocity: Vector2;
  readonly trail: readonly Vector2[];
  readonly measurement: { readonly label: string; readonly value: number; readonly unit: string };
  readonly secondaryMeasurement: { readonly label: string; readonly value: number; readonly unit: string } | null;
  readonly graph: readonly GraphPoint[];
  readonly sandboxObjects: readonly ElectromagnetismSandboxObject[];
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));
const points = (count: number, start: number, end: number, calculate: (x: number) => number): GraphPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const x = start + (end - start) * index / Math.max(1, count - 1);
    return { x, y: calculate(x) };
  });

/** Renderer-independent state and equations for all electromagnetism labs. */
export class ElectromagnetismModel {
  private mode: ElectromagnetismMode;
  private running = false;
  private time = 0;
  private probe: Vector2 = { x: 0.7, y: 0.5 };
  private level = 1;
  private sign: 1 | -1 = 1;
  private direction: 1 | -1 = 1;
  private coilTurns = 80;
  private magnetSpeed = 0;
  private previousDragX = 0.22;
  private particle: Vector2 = { x: 0.25, y: 0.52 };
  private particleVelocity: Vector2 = { x: 0.24, y: -0.02 };
  private trail: Vector2[] = [];
  private sandboxSequence = 0;
  private sandboxObjects: ElectromagnetismSandboxObject[] = [];

  constructor(initialMode: ElectromagnetismMode = "charge") {
    this.mode = initialMode;
    this.reset();
  }

  activate(mode: ElectromagnetismMode): void {
    this.mode = mode;
    this.reset();
  }

  reset(): void {
    this.running = false;
    this.time = 0;
    this.probe = this.mode === "induction" ? { x: 0.22, y: 0.5 } : { x: 0.7, y: 0.5 };
    this.level = 1;
    this.sign = 1;
    this.direction = 1;
    this.coilTurns = 80;
    this.magnetSpeed = 0;
    this.previousDragX = this.probe.x;
    this.particle = { x: 0.25, y: 0.52 };
    this.particleVelocity = { x: 0.24, y: -0.02 };
    this.trail = [{ ...this.particle }];
    this.sandboxSequence = 0;
    this.sandboxObjects = this.mode === "sandbox"
      ? [this.makeSandboxObject("charge", { x: 0.42, y: 0.48 })]
      : [];
  }

  toggle(): void { this.running = !this.running; }
  setRunning(value: boolean): void { this.running = value; }

  setLevel(value: number): void { this.level = clamp(value, 0.5, 1.5); }
  toggleSign(): void { this.sign = this.sign === 1 ? -1 : 1; }
  toggleDirection(): void { this.direction = this.direction === 1 ? -1 : 1; }
  setCoilTurns(value: number): void { this.coilTurns = Math.max(20, Math.min(160, Math.round(value))); }

  drag(normalizedPoint: Vector2, dt = 1 / 60): void {
    const point = { x: clamp(normalizedPoint.x, 0.08, 0.92), y: clamp(normalizedPoint.y, 0.12, 0.88) };
    if (this.mode === "circuits" || this.mode === "capacitors") {
      this.probe = { x: point.x, y: 0.5 };
      return;
    }
    if (this.mode === "electromagnetic-force") {
      const dx = point.x - 0.25;
      const dy = point.y - 0.52;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      this.particleVelocity = { x: dx / length * 0.26, y: dy / length * 0.26 };
      this.trail = [{ ...this.particle }];
      return;
    }
    if (this.mode === "induction") {
      this.magnetSpeed = (point.x - this.previousDragX) / Math.max(dt, 1 / 240);
      this.previousDragX = point.x;
      this.probe = { x: point.x, y: 0.5 };
      return;
    }
    this.probe = point;
  }

  step(dt: number): void {
    if (!this.running || dt <= 0) return;
    this.time += dt;
    if (this.mode === "electromagnetic-force") {
      const force = lorentzForce2D(
        this.sign,
        { x: 0, y: 0 },
        this.particleVelocity,
        this.direction * this.level * 2.2,
      );
      this.particleVelocity = {
        x: this.particleVelocity.x + force.x * dt * 0.24,
        y: this.particleVelocity.y + force.y * dt * 0.24,
      };
      this.particle = {
        x: this.particle.x + this.particleVelocity.x * dt,
        y: this.particle.y + this.particleVelocity.y * dt,
      };
      this.trail.push({ ...this.particle });
      if (this.trail.length > 180) this.trail.shift();
      if (this.particle.x < 0.05 || this.particle.x > 0.95 || this.particle.y < 0.08 || this.particle.y > 0.92) {
        this.running = false;
      }
    } else if (this.mode === "induction") {
      this.magnetSpeed *= Math.exp(-dt * 8);
      if (Math.abs(this.magnetSpeed) < 0.001) this.magnetSpeed = 0;
    }
  }

  addSandboxObject(kind: ElectromagnetismSandboxKind): ElectromagnetismSandboxObject {
    if (this.mode !== "sandbox") throw new Error("Sandbox objects require sandbox mode.");
    const column = this.sandboxObjects.length % 4;
    const row = Math.floor(this.sandboxObjects.length / 4) % 3;
    const object = this.makeSandboxObject(kind, { x: 0.28 + column * 0.15, y: 0.34 + row * 0.18 });
    this.sandboxObjects.push(object);
    return object;
  }

  moveSandboxObject(id: string, position: Vector2): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id);
    if (!object) return false;
    object.position = { x: clamp(position.x, 0.05, 0.95), y: clamp(position.y, 0.08, 0.92) };
    return true;
  }

  removeSandboxObject(id: string): boolean {
    const index = this.sandboxObjects.findIndex((candidate) => candidate.id === id);
    if (index < 0) return false;
    this.sandboxObjects.splice(index, 1);
    return true;
  }

  hitSandboxObject(point: Vector2, radius = 0.055): ElectromagnetismSandboxObject | null {
    return [...this.sandboxObjects].reverse().find((object) =>
      Math.hypot(point.x - object.position.x, point.y - object.position.y) <= radius) ?? null;
  }

  snapshot(): ElectromagnetismSnapshot {
    const result = this.measurement();
    return {
      mode: this.mode,
      running: this.running,
      time: this.time,
      probe: { ...this.probe },
      level: this.level,
      sign: this.sign,
      direction: this.direction,
      coilTurns: this.coilTurns,
      magnetSpeed: this.magnetSpeed,
      particle: { ...this.particle },
      particleVelocity: { ...this.particleVelocity },
      trail: this.trail.map((point) => ({ ...point })),
      measurement: result.primary,
      secondaryMeasurement: result.secondary,
      graph: this.graph(),
      sandboxObjects: this.sandboxObjects.map((object) => ({ ...object, position: { ...object.position } })),
    };
  }

  private measurement(): {
    primary: ElectromagnetismSnapshot["measurement"];
    secondary: ElectromagnetismSnapshot["secondaryMeasurement"];
  } {
    if (this.mode === "sandbox") {
      const charges = this.sandboxObjects.filter((object) => object.kind === "charge");
      return {
        primary: { label: "배치한 전하", value: charges.length, unit: "개" },
        secondary: { label: "전체 장치", value: this.sandboxObjects.length, unit: "개" },
      };
    }
    if (this.mode === "charge") {
      const distance = this.distanceFrom({ x: 0.32, y: 0.5 });
      const magnitude = coulombForceMagnitude(2e-6, this.sign * 2e-6, distance, 8.9875517923e9);
      return { primary: { label: "전기력", value: magnitude, unit: "N" }, secondary: { label: "전하 사이 거리", value: distance, unit: "m" } };
    }
    if (this.mode === "electric-field") {
      const point = this.toMeters(this.probe);
      const positive = pointChargeElectricFieldVector(2e-6, this.toMeters({ x: 0.35, y: 0.42 }), point);
      const negative = pointChargeElectricFieldVector(-2e-6, this.toMeters({ x: 0.35, y: 0.66 }), point);
      const strength = Math.hypot(positive.x + negative.x, positive.y + negative.y);
      return { primary: { label: "전기장 세기", value: strength, unit: "N/C" }, secondary: null };
    }
    if (this.mode === "potential") {
      const distance = this.distanceFrom({ x: 0.35, y: 0.5 });
      const potential = pointChargePotential(this.sign * 2e-6, distance);
      return { primary: { label: "전위", value: potential, unit: "V" }, secondary: { label: "위치 에너지", value: potential * 1e-6, unit: "J" } };
    }
    if (this.mode === "circuits") {
      const voltage = 3 + this.level * 6;
      const resistance = 2 + this.probe.x * 18;
      const current = currentFromVoltage(voltage, resistance);
      return { primary: { label: "회로 전류", value: current, unit: "A" }, secondary: { label: "전구 전력", value: electricalPower(voltage, current), unit: "W" } };
    }
    if (this.mode === "capacitors") {
      const separation = 0.001 + this.probe.x * 0.009;
      const capacitance = parallelPlateCapacitance(8.854e-12, 0.02, separation);
      const voltage = 3 + this.level * 6;
      return { primary: { label: "전기용량", value: capacitance * 1e9, unit: "nF" }, secondary: { label: "저장 에너지", value: capacitorEnergy(capacitance, voltage) * 1e9, unit: "nJ" } };
    }
    if (this.mode === "magnetic-field") {
      const distance = this.distanceFrom({ x: 0.44, y: 0.5 });
      const field = Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, distance));
      return { primary: { label: "자기장 세기", value: field * 1e6, unit: "μT" }, secondary: { label: "전류", value: this.direction * this.level * 5, unit: "A" } };
    }
    if (this.mode === "electromagnetic-force") {
      const angle = Math.atan2(this.particleVelocity.y, this.particleVelocity.x);
      const force = magneticForceMagnitude(this.sign, Math.hypot(this.particleVelocity.x, this.particleVelocity.y), this.level, Math.PI / 2);
      return { primary: { label: "자기력", value: force, unit: "상대값" }, secondary: { label: "속도 방향", value: angle * 180 / Math.PI, unit: "°" } };
    }
    const emf = inducedEmf(this.coilTurns, this.magnetSpeed * 0.003, 1);
    return { primary: { label: "유도 전압", value: emf, unit: "V" }, secondary: { label: "자석 속도", value: this.magnetSpeed, unit: "m/s" } };
  }

  private graph(): GraphPoint[] {
    if (this.mode === "sandbox") return points(2, 0, 1, () => this.sandboxObjects.length);
    if (this.mode === "charge") return points(48, 0.25, 2.4, (distance) => coulombForceMagnitude(2e-6, 2e-6, distance));
    if (this.mode === "electric-field") return points(48, 0.25, 2.4, (distance) => pointChargeElectricFieldVector(2e-6, { x: 0, y: 0 }, { x: distance, y: 0 }).x);
    if (this.mode === "potential") return points(48, 0.25, 2.4, (distance) => pointChargePotential(this.sign * 2e-6, distance));
    if (this.mode === "circuits") {
      const voltage = 3 + this.level * 6;
      return points(48, 2, 20, (resistance) => currentFromVoltage(voltage, resistance));
    }
    if (this.mode === "capacitors") return points(48, 1, 10, (millimeters) =>
      parallelPlateCapacitance(8.854e-12, 0.02, millimeters / 1000) * 1e9);
    if (this.mode === "magnetic-field") return points(48, 1, 80, (centimeters) =>
      Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, centimeters / 100)) * 1e6);
    if (this.mode === "electromagnetic-force") return points(48, 0, 180, (degrees) =>
      magneticForceMagnitude(this.sign, 1, this.level, degrees * Math.PI / 180));
    return points(48, -2.4, 2.4, (speed) => inducedEmf(this.coilTurns, speed * 0.003, 1));
  }

  private distanceFrom(source: Vector2): number {
    return Math.max(0.15, Math.hypot(this.probe.x - source.x, this.probe.y - source.y) * 2.4);
  }

  private toMeters(point: Vector2): Vector2 { return { x: point.x * 2.4, y: point.y * 2.4 }; }

  private makeSandboxObject(kind: ElectromagnetismSandboxKind, position: Vector2): ElectromagnetismSandboxObject {
    this.sandboxSequence += 1;
    return { id: `${kind}-${this.sandboxSequence}`, kind, position, value: kind === "charge" ? 1 : 1 };
  }
}
