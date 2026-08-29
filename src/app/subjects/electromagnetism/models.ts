import type { Vector2 } from "../../../physics/core";
import {
  capacitorEnergy,
  coulombForceMagnitude,
  currentFromVoltage,
  inducedEmf,
  magneticFieldAroundWire,
  magneticForceMagnitude,
  parallelPlateCapacitance,
  pointChargeElectricFieldVector,
  pointChargePotential,
} from "../../../physics/laws/electromagnetism";
import type { ElectromagnetismLabId } from "./catalog";

type LegacyGuidedElectromagnetismMode = "electric-field" | "potential" | "magnetic-field" | "charged-particle";
export type ElectromagnetismMode = ElectromagnetismLabId | LegacyGuidedElectromagnetismMode | "sandbox";
export type ElectromagnetismSandboxKind = "charge" | "battery" | "resistor" | "bulb" | "switch" | "capacitor" | "current-wire" | "field-region" | "magnet" | "coil" | "iron-load" | "motor" | "generator" | "transformer" | "probe";
export const isElectromagnetismWireConnectable = (kind: ElectromagnetismSandboxKind): boolean =>
  kind === "battery" || kind === "resistor" || kind === "bulb" || kind === "switch" || kind === "capacitor" || kind === "coil" || kind === "motor" || kind === "generator" || kind === "transformer";

export const ELECTROMAGNETISM_WORLD = { width: 2.4, height: 1.5 } as const;
export const CIRCUIT_TRACK = { minX: 0.27, maxX: 0.73 } as const;
export const CAPACITOR_PLATES = { leftX: 0.36, minRightX: 0.46, maxRightX: 0.78 } as const;
export const INDUCTION_COIL = { x: 0.62, y: 0.5 } as const;
export const PARTICLE_START = { x: 0.2, y: 0.55 } as const;
export const PARTICLE_TARGETS = [{ x: 0.34, y: 0.47 }, { x: 0.44, y: 0.38 }, { x: 0.5, y: 0.3 }] as const;
export const GENERATOR_CENTER = { x: 0.36, y: 0.5 } as const;
export const TRANSFORMER_TRACK = { minX: 0.3, maxX: 0.7 } as const;

export interface ElectromagnetismSandboxObject {
  readonly id: string;
  readonly kind: ElectromagnetismSandboxKind;
  position: Vector2;
  value: number;
  secondaryValue?: number;
  enabled?: boolean;
  direction?: 1 | -1;
  velocity?: Vector2;
  moving?: boolean;
  trail?: Vector2[];
  history?: GraphPoint[];
}
export interface GraphPoint { readonly x: number; readonly y: number }
export interface FieldSample { readonly point: Vector2; readonly vector: Vector2 }
export interface FieldLine { readonly points: readonly Vector2[] }
export interface SandboxForce { readonly objectId: string; readonly vector: Vector2 }
export interface SandboxCurrent { readonly objectId: string; readonly current: number }
export type SandboxTerminal = "a" | "b" | "c" | "d";
export const sandboxTerminals = (kind: ElectromagnetismSandboxKind): readonly SandboxTerminal[] => kind === "transformer" ? ["a", "b", "c", "d"] : ["a", "b"];
export interface SandboxWireEndpoint { readonly objectId: string; readonly terminal: SandboxTerminal }
export type SandboxWireTargetState = "available" | "active" | "same-object" | "duplicate";
export type SandboxWireConnection = {
  readonly from: string;
  readonly to: string;
  readonly kind: "wire";
  readonly fromTerminal: SandboxTerminal;
  readonly toTerminal: SandboxTerminal;
};
export type SandboxConnection = SandboxWireConnection | { readonly from: string; readonly to: string; readonly kind: "induction" };

export const sandboxWireTargetState = (
  start: SandboxWireEndpoint,
  target: SandboxWireEndpoint,
  connections: readonly SandboxConnection[],
): SandboxWireTargetState => {
  if (start.objectId === target.objectId && start.terminal === target.terminal) return "active";
  if (start.objectId === target.objectId) return "same-object";
  const duplicate = connections.some((connection) => connection.kind === "wire" && (
    (connection.from === start.objectId && connection.fromTerminal === start.terminal && connection.to === target.objectId && connection.toTerminal === target.terminal)
    || (connection.from === target.objectId && connection.fromTerminal === target.terminal && connection.to === start.objectId && connection.toTerminal === start.terminal)
  ));
  return duplicate ? "duplicate" : "available";
};
export type SandboxBatteryArrangement = "none" | "single" | "series" | "parallel" | "mixed";
export interface SandboxMetrics {
  readonly electricField: Vector2;
  readonly magneticField: Vector2;
  readonly magneticFieldZ: number;
  readonly potential: number;
  readonly current: number;
  readonly inducedVoltage: number;
  readonly circuitVoltage: number;
  readonly loadPower: number;
  readonly batteryArrangement: SandboxBatteryArrangement;
}
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
  readonly rotorAngle: number;
  readonly angularSpeed: number;
  readonly secondaryTurns: number;
  readonly particleTargetsHit: readonly boolean[];
  readonly craneCarrying: number;
  readonly craneDelivered: number;
  readonly capacitorMode: "charging" | "open" | "lamp";
  readonly circuitArrangement: "series" | "parallel";
  readonly capacitorVoltage: number;
  readonly wirePosition: number;
  readonly wireVelocity: number;
  readonly deviceLoad: 1 | 2 | 3;
  readonly motorLoadHeight: number;
  readonly generatorOutputLevel: number;
  readonly applianceTargetVoltage: 6 | 9 | 12;
  readonly particle: Vector2;
  readonly particleVelocity: Vector2;
  readonly trail: readonly Vector2[];
  readonly measurement: { readonly label: string; readonly value: number; readonly unit: string };
  readonly secondaryMeasurement: { readonly label: string; readonly value: number; readonly unit: string } | null;
  readonly graph: readonly GraphPoint[];
  readonly graphMarker: GraphPoint | null;
  readonly fieldSamples: readonly FieldSample[];
  readonly fieldLines: readonly FieldLine[];
  readonly magneticFieldLines: readonly FieldLine[];
  readonly probeField: Vector2;
  readonly capacitorField: number;
  readonly lorentzForce: Vector2;
  readonly sandboxObjects: readonly ElectromagnetismSandboxObject[];
  readonly sandboxConnections: readonly SandboxConnection[];
  readonly sandboxForces: readonly SandboxForce[];
  readonly sandboxCurrents: readonly SandboxCurrent[];
  readonly sandboxMetrics: SandboxMetrics;
  readonly sandboxGraph: { readonly title: string; readonly xLabel: string; readonly yLabel: string; readonly color: string };
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));
const points = (count: number, start: number, end: number, calculate: (x: number) => number): GraphPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const x = start + (end - start) * index / Math.max(1, count - 1);
    return { x, y: calculate(x) };
  });

export const normalizedToWorld = (point: Vector2): Vector2 => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y * ELECTROMAGNETISM_WORLD.height });
export const worldToNormalized = (point: Vector2): Vector2 => ({ x: point.x / ELECTROMAGNETISM_WORLD.width, y: point.y / ELECTROMAGNETISM_WORLD.height });
export const worldDistance = (a: Vector2, b: Vector2): number => {
  const wa = normalizedToWorld(a); const wb = normalizedToWorld(b);
  return Math.hypot(wa.x - wb.x, wa.y - wb.y);
};
export const sandboxVelocityHandle = (object: ElectromagnetismSandboxObject): Vector2 => {
  const velocity = object.velocity ?? { x: 0.18, y: 0 };
  const magnitude = Math.max(1e-9, Math.hypot(velocity.x, velocity.y));
  return { x: object.position.x + velocity.x / magnitude * 0.13, y: object.position.y + velocity.y / magnitude * 0.13 };
};
export const circuitResistanceAtX = (x: number): number =>
  2 + clamp((x - CIRCUIT_TRACK.minX) / (CIRCUIT_TRACK.maxX - CIRCUIT_TRACK.minX)) * 18;
export const sandboxBulbPower = (current: number, resistance: number): number => current * current * Math.max(0, resistance);
export const sandboxBulbBrightness = (current: number, resistance: number): number => 1 - Math.exp(-sandboxBulbPower(current, resistance) / 4);
export const capacitorSeparationMmAtX = (x: number): number =>
  1 + clamp((x - CAPACITOR_PLATES.minRightX) / (CAPACITOR_PLATES.maxRightX - CAPACITOR_PLATES.minRightX)) * 9;
export const guidedCurrentAtLevel = (level: number): number => 2 + clamp(level, 0.5, 1.5) * 2;
export const electromagnetLiftForce = (current: number, turns: number): number => Math.abs(current) * turns / 40;
export const motorTorqueAtCurrent = (current: number): number => Math.abs(current) * 2.2;
export const generatorVoltageAtSpeed = (angularSpeed: number, turns: number): number => angularSpeed * turns / 80 * 1.15;
export const transformerOutputVoltage = (primaryVoltage: number, primaryTurns: number, secondaryTurns: number): number =>
  primaryVoltage * secondaryTurns / primaryTurns;
export const secondaryTurnsAtX = (x: number): number =>
  Math.round(20 + clamp((x - TRANSFORMER_TRACK.minX) / (TRANSFORMER_TRACK.maxX - TRANSFORMER_TRACK.minX)) * 140);

const fluxAtDistance = (distanceMeters: number): number => 0.003 / (1 + (distanceMeters / 0.28) ** 2);

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
  private inducedVoltage = 0;
  private rotorAngle = 0;
  private angularSpeed = 0;
  private secondaryTurns = 80;
  private particleTargetsHit: boolean[] = PARTICLE_TARGETS.map(() => false);
  private craneCarrying = 0;
  private craneDelivered = 0;
  private capacitorMode: ElectromagnetismSnapshot["capacitorMode"] = "charging";
  private circuitArrangement: ElectromagnetismSnapshot["circuitArrangement"] = "series";
  private capacitorVoltage = 0;
  private capacitorHistory: GraphPoint[] = [];
  private wirePosition = 0.52;
  private wireVelocity = 0;
  private deviceLoad: ElectromagnetismSnapshot["deviceLoad"] = 2;
  private motorLoadHeight = 0.78;
  private generatorOutputLevel = 0;
  private applianceTargetVoltage: ElectromagnetismSnapshot["applianceTargetVoltage"] = 12;
  private particle: Vector2 = { x: 0.25, y: 0.52 };
  private particleVelocity: Vector2 = { x: 0.24, y: -0.02 };
  private trail: Vector2[] = [];
  private sandboxSequence = 0;
  private sandboxObjects: ElectromagnetismSandboxObject[] = [];
  private sandboxWires: SandboxWireConnection[] = [];
  private sandboxInducedVoltage = 0;

  constructor(initialMode: ElectromagnetismMode = "charge") { this.mode = initialMode; this.reset(); }
  activate(mode: ElectromagnetismMode): void { this.mode = mode; this.reset(); }

  reset(): void {
    this.running = this.mode === "capacitors" || this.mode === "electromagnetic-force" || this.mode === "motor"; this.time = 0;
    this.probe = this.mode === "induction" ? { x: 0.22, y: 0.5 }
      : this.mode === "circuits" ? { x: 0.5, y: 0.3 }
        : this.mode === "capacitors" ? { x: 0.62, y: 0.78 }
          : this.mode === "charged-particle" ? { x: 0.36, y: PARTICLE_START.y }
            : this.mode === "electromagnet" ? { x: 0.5, y: 0.3 }
              : this.mode === "motor" ? { x: 0.5, y: 0.22 }
              : this.mode === "generator" ? { x: GENERATOR_CENTER.x + 0.15, y: GENERATOR_CENTER.y }
                : this.mode === "transformer" ? { x: 0.5, y: 0.78 }
          : { x: 0.7, y: 0.5 };
    this.level = 1; this.sign = 1; this.direction = 1; this.coilTurns = 80;
    this.magnetSpeed = 0; this.inducedVoltage = 0;
    this.rotorAngle = 0; this.angularSpeed = 0; this.secondaryTurns = 80;
    this.particleTargetsHit = PARTICLE_TARGETS.map(() => false);
    this.craneCarrying = 0; this.craneDelivered = 0;
    this.capacitorMode = "charging"; this.circuitArrangement = "series"; this.capacitorVoltage = 0; this.capacitorHistory = [{ x: 0, y: 0 }];
    this.wirePosition = 0.52; this.wireVelocity = 0; this.deviceLoad = 2; this.motorLoadHeight = 0.78;
    this.generatorOutputLevel = 0; this.applianceTargetVoltage = 12;
    this.particle = { ...PARTICLE_START }; this.particleVelocity = { x: 0.28, y: 0 };
    this.trail = [{ ...this.particle }]; this.sandboxSequence = 0; this.sandboxInducedVoltage = 0;
    this.sandboxObjects = []; this.sandboxWires = [];
  }

  toggle(): void { this.running = !this.running; }
  setRunning(value: boolean): void { this.running = value; }
  setLevel(value: number): void {
    this.level = clamp(value, 0.5, 1.5);
    if (this.mode === "motor") this.probe = { x: 0.3 + (this.level - 0.5) * 0.4, y: 0.22 };
  }
  toggleSign(): void { this.sign = this.sign === 1 ? -1 : 1; }
  toggleDirection(): void { this.direction = this.direction === 1 ? -1 : 1; }
  setCapacitorMode(mode: ElectromagnetismSnapshot["capacitorMode"]): void {
    if (this.mode !== "capacitors") return;
    this.capacitorMode = mode; this.running = mode !== "open";
  }
  setCircuitArrangement(arrangement: ElectromagnetismSnapshot["circuitArrangement"]): void {
    if (this.mode === "circuits") this.circuitArrangement = arrangement;
  }
  setDeviceLoad(value: number): void {
    if (value === 1 || value === 2 || value === 3) {
      this.deviceLoad = value;
      if (this.mode === "electromagnet") { this.craneCarrying = 0; this.craneDelivered = 0; }
    }
  }
  setApplianceTargetVoltage(value: number): void {
    if (value === 6 || value === 9 || value === 12) this.applianceTargetVoltage = value;
  }
  setCoilTurns(value: number): void {
    this.coilTurns = Math.max(20, Math.min(160, Math.round(value)));
    if (this.mode === "generator") this.inducedVoltage = generatorVoltageAtSpeed(this.angularSpeed, this.coilTurns);
  }
  setSecondaryTurns(value: number): void { this.secondaryTurns = Math.max(20, Math.min(160, Math.round(value))); }

  drag(normalizedPoint: Vector2, dt = 0): void {
    const point = { x: clamp(normalizedPoint.x, 0.08, 0.92), y: clamp(normalizedPoint.y, 0.12, 0.88) };
    if (this.mode === "circuits") { this.probe = { x: clamp(point.x, CIRCUIT_TRACK.minX, CIRCUIT_TRACK.maxX), y: 0.3 }; return; }
    if (this.mode === "capacitors") {
      const oldSeparation = capacitorSeparationMmAtX(this.probe.x) / 1000;
      const nextX = clamp(point.x, CAPACITOR_PLATES.minRightX, CAPACITOR_PLATES.maxRightX);
      const nextSeparation = capacitorSeparationMmAtX(nextX) / 1000;
      if (this.capacitorMode !== "charging" && this.capacitorVoltage > 0) {
        const oldCapacitance = parallelPlateCapacitance(8.854e-12, 0.02, oldSeparation);
        const nextCapacitance = parallelPlateCapacitance(8.854e-12, 0.02, nextSeparation);
        this.capacitorVoltage = clamp(this.capacitorVoltage * oldCapacitance / nextCapacitance, 0, 120);
      }
      this.probe = { x: nextX, y: 0.78 }; return;
    }
    if (this.mode === "electromagnetic-force") {
      const horizontal = point.x - 0.5;
      if (Math.abs(horizontal) > 0.025) this.sign = horizontal >= 0 ? 1 : -1;
      this.level = clamp(Math.abs(horizontal) / 0.3, 0.5, 1.5);
      return;
    }
    if (this.mode === "charged-particle") {
      const dx = point.x - PARTICLE_START.x; const dy = point.y - PARTICLE_START.y;
      const distance = Math.hypot(dx, dy); if (distance < 0.025) return;
      const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12;
      const speed = clamp(distance * 1.45, 0.16, 0.46);
      this.particle = { ...PARTICLE_START };
      this.particleVelocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      this.probe = { x: this.particle.x + Math.cos(angle) * Math.min(0.18, distance), y: this.particle.y + Math.sin(angle) * Math.min(0.18, distance) };
      this.trail = [{ ...this.particle }]; this.running = false;
      return;
    }
    if (this.mode === "electromagnet") {
      this.probe = { x: clamp(point.x, 0.22, 0.88), y: clamp(point.y, 0.24, 0.72) };
      const force = electromagnetLiftForce(guidedCurrentAtLevel(this.level), this.coilTurns); const requiredForce = [0, 4, 9, 15][this.deviceLoad];
      if (this.craneCarrying === 0 && this.craneDelivered === 0 && force >= requiredForce && Math.hypot(this.probe.x - 0.5, this.probe.y - 0.7) < 0.14) {
        this.craneCarrying = 1;
      }
      if (this.craneCarrying > 0 && Math.hypot(this.probe.x - 0.82, this.probe.y - 0.7) < 0.14) {
        this.craneDelivered = 1; this.craneCarrying = 0;
      }
      return;
    }
    if (this.mode === "motor") {
      const x = clamp(point.x, 0.3, 0.7);
      this.level = 0.5 + (x - 0.3) / 0.4;
      this.probe = { x, y: 0.22 };
      return;
    }
    if (this.mode === "generator") {
      const angle = Math.atan2(point.y - GENERATOR_CENTER.y, point.x - GENERATOR_CENTER.x);
      if (dt > 0 && Number.isFinite(dt)) {
        let delta = angle - this.rotorAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.angularSpeed = clamp(delta / dt, -12, 12);
        this.inducedVoltage = generatorVoltageAtSpeed(this.angularSpeed, this.coilTurns);
        this.generatorOutputLevel = clamp(Math.abs(this.inducedVoltage) / 11);
      } else { this.angularSpeed = 0; this.inducedVoltage = 0; }
      this.rotorAngle = angle;
      this.probe = { x: GENERATOR_CENTER.x + Math.cos(angle) * 0.15, y: GENERATOR_CENTER.y + Math.sin(angle) * 0.15 };
      return;
    }
    if (this.mode === "transformer") {
      const x = clamp(point.x, TRANSFORMER_TRACK.minX, TRANSFORMER_TRACK.maxX);
      this.secondaryTurns = secondaryTurnsAtX(x); this.probe = { x, y: 0.78 };
      return;
    }
    if (this.mode === "induction") {
      if (dt > 0 && Number.isFinite(dt)) {
        const oldLinkage = this.coilTurns * this.guidedFluxAt(this.probe);
        const newLinkage = this.coilTurns * this.guidedFluxAt(point);
        this.inducedVoltage = inducedEmf(1, newLinkage - oldLinkage, dt);
        this.magnetSpeed = (normalizedToWorld(point).x - normalizedToWorld(this.probe).x) / dt;
      } else { this.inducedVoltage = 0; this.magnetSpeed = 0; }
      this.probe = { x: point.x, y: 0.5 }; return;
    }
    this.probe = point;
  }

  step(dt: number): void {
    if (!this.running || dt <= 0) return;
    this.time += dt;
    if (this.mode === "capacitors") {
      const sourceVoltage = 3 + this.level * 6;
      const capacitance = parallelPlateCapacitance(8.854e-12, 0.02, capacitorSeparationMmAtX(this.probe.x) / 1000);
      const responseRate = 1.1e-9 / Math.max(0.08e-9, capacitance);
      if (this.capacitorMode === "charging") this.capacitorVoltage += (sourceVoltage - this.capacitorVoltage) * (1 - Math.exp(-dt * responseRate));
      else if (this.capacitorMode === "lamp") this.capacitorVoltage *= Math.exp(-dt * responseRate * 1.8);
      this.capacitorHistory.push({ x: this.time, y: this.capacitorVoltage });
      if (this.capacitorHistory.length > 240) this.capacitorHistory.splice(0, this.capacitorHistory.length - 240);
      if (this.capacitorMode === "lamp" && this.capacitorVoltage < 0.03) { this.capacitorVoltage = 0; this.running = false; }
    } else if (this.mode === "electromagnetic-force") {
      const acceleration = this.lorentzForceVector().y * 0.07 - this.wireVelocity * 3.2;
      this.wireVelocity += acceleration * dt;
      this.wirePosition += this.wireVelocity * dt;
      if (this.wirePosition <= 0.25 || this.wirePosition >= 0.78) {
        this.wirePosition = clamp(this.wirePosition, 0.25, 0.78); this.wireVelocity = 0;
      }
    } else if (this.mode === "charged-particle") {
      const rotation = -this.sign * this.direction * this.level * 1.7 * dt;
      const cosine = Math.cos(rotation); const sine = Math.sin(rotation);
      const nextVelocity = {
        x: this.particleVelocity.x * cosine - this.particleVelocity.y * sine,
        y: this.particleVelocity.x * sine + this.particleVelocity.y * cosine,
      };
      const next = { x: this.particle.x + nextVelocity.x * dt, y: this.particle.y + nextVelocity.y * dt };
      this.particleVelocity = nextVelocity; this.particle = next;
      this.particleTargetsHit = this.particleTargetsHit.map((hit, index) => hit || Math.hypot(next.x - PARTICLE_TARGETS[index].x, next.y - PARTICLE_TARGETS[index].y) < 0.055);
      if (this.particleTargetsHit.every(Boolean)) this.running = false;
      if (next.x < 0.04 || next.x > 0.96 || next.y < 0.07 || next.y > 0.93) this.running = false;
      this.trail.push({ x: clamp(next.x, 0.04, 0.96), y: clamp(next.y, 0.07, 0.93) });
      if (this.trail.length > 260) this.trail.shift();
    } else if (this.mode === "motor") {
      this.angularSpeed = this.sign * this.direction * this.level * 4.2;
      this.rotorAngle += this.angularSpeed * dt;
      const torque = motorTorqueAtCurrent(guidedCurrentAtLevel(this.level));
      const requiredTorque = [0, 5.5, 8.5, 10.5][this.deviceLoad];
      const liftSpeed = this.sign * this.direction > 0 ? Math.max(0, torque - requiredTorque) * 0.022 : -0.08;
      this.motorLoadHeight = clamp(this.motorLoadHeight - liftSpeed * dt, 0.25, 0.78);
    } else if (this.mode === "generator") {
      this.rotorAngle += this.angularSpeed * dt;
      this.angularSpeed *= Math.exp(-dt * 1.4);
      this.inducedVoltage = generatorVoltageAtSpeed(this.angularSpeed, this.coilTurns);
      this.generatorOutputLevel = clamp(Math.abs(this.inducedVoltage) / 11);
      this.probe = { x: GENERATOR_CENTER.x + Math.cos(this.rotorAngle) * 0.15, y: GENERATOR_CENTER.y + Math.sin(this.rotorAngle) * 0.15 };
      if (Math.abs(this.angularSpeed) < 0.025) { this.angularSpeed = 0; this.inducedVoltage = 0; this.generatorOutputLevel = 0; this.running = false; }
    } else if (this.mode === "induction") {
      const damping = Math.exp(-dt * 8); this.magnetSpeed *= damping; this.inducedVoltage *= damping;
      if (Math.abs(this.magnetSpeed) < 0.001) { this.magnetSpeed = 0; this.inducedVoltage = 0; this.running = false; }
    } else if (this.mode === "sandbox") {
      this.sandboxInducedVoltage *= Math.exp(-dt * 8);
      if (Math.abs(this.sandboxInducedVoltage) < 0.001) this.sandboxInducedVoltage = 0;
      this.stepSandboxCapacitors(dt);
      this.stepSandboxCharges(dt);
      this.stepSandboxIronLoads(dt);
    }
  }

  addSandboxObject(kind: ElectromagnetismSandboxKind, requestedValue?: number): ElectromagnetismSandboxObject {
    if (this.mode !== "sandbox") throw new Error("Sandbox objects require sandbox mode.");
    const column = this.sandboxObjects.length % 4; const row = Math.floor(this.sandboxObjects.length / 4) % 3;
    const circuitPositions: Partial<Record<ElectromagnetismSandboxKind, Vector2>> = {
      battery: { x: 0.28, y: 0.52 }, resistor: { x: 0.5, y: 0.3 }, bulb: { x: 0.72, y: 0.52 }, switch: { x: 0.5, y: 0.74 },
      coil: { x: 0.5, y: 0.52 }, "iron-load": { x: 0.5, y: 0.76 }, motor: { x: 0.76, y: 0.3 }, generator: { x: 0.76, y: 0.72 }, transformer: { x: 0.24, y: 0.72 },
    };
    const sameKind = this.sandboxObjects.filter((object) => object.kind === kind).length;
    const base = circuitPositions[kind];
    const circuitSpread: Partial<Record<ElectromagnetismSandboxKind, Vector2>> = {
      battery: { x: 0, y: 0.14 }, resistor: { x: 0, y: 0.12 }, bulb: { x: 0, y: 0.15 }, switch: { x: 0, y: -0.12 }, coil: { x: 0, y: 0.15 }, "iron-load": { x: 0.1, y: 0 }, motor: { x: 0, y: 0.14 }, generator: { x: 0, y: -0.14 }, transformer: { x: 0, y: -0.16 },
    };
    const spread = circuitSpread[kind];
    const position = base && spread
      ? { x: base.x + spread.x * Math.min(2, sameKind), y: base.y + spread.y * Math.min(2, sameKind) }
      : { x: 0.28 + column * 0.15, y: 0.34 + row * 0.18 };
    const object = this.makeSandboxObject(kind, position, requestedValue);
    this.sandboxObjects.push(object); return object;
  }

  moveSandboxObject(id: string, position: Vector2, dt = 0): boolean {
    if (this.mode !== "sandbox") return false;
    const object = this.sandboxObjects.find((candidate) => candidate.id === id); if (!object) return false;
    const oldLinkage = this.sandboxFluxLinkage();
    object.position = { x: clamp(position.x, 0.05, 0.95), y: clamp(position.y, 0.08, 0.92) };
    if (object.kind === "charge") {
      object.moving = false; object.trail = [{ ...object.position }]; object.history = [{ x: 0, y: Math.hypot(object.velocity?.x ?? 0, object.velocity?.y ?? 0) }];
    }
    if ((object.kind === "magnet" || object.kind === "coil") && dt > 0 && Number.isFinite(dt)) this.sandboxInducedVoltage = inducedEmf(1, this.sandboxFluxLinkage() - oldLinkage, dt);
    return true;
  }
  removeSandboxObject(id: string): boolean {
    if (this.mode !== "sandbox") return false;
    const index = this.sandboxObjects.findIndex((candidate) => candidate.id === id); if (index < 0) return false;
    this.sandboxObjects.splice(index, 1);
    this.sandboxWires = this.sandboxWires.filter((wire) => wire.from !== id && wire.to !== id);
    this.sandboxInducedVoltage = 0; return true;
  }
  hitSandboxObject(point: Vector2, radius?: number): ElectromagnetismSandboxObject | null {
    const hitRadius: Partial<Record<ElectromagnetismSandboxKind, number>> = {
      transformer: 0.09, coil: 0.085, "field-region": 0.13, magnet: 0.08,
      resistor: 0.07, battery: 0.07, capacitor: 0.075, motor: 0.075, generator: 0.075,
    };
    return [...this.sandboxObjects].reverse().find((object) =>
      Math.hypot(point.x - object.position.x, point.y - object.position.y) <= (radius ?? hitRadius[object.kind] ?? 0.055)) ?? null;
  }
  connectSandboxObjects(fromId: string, toId: string, fromTerminal?: SandboxTerminal, toTerminal?: SandboxTerminal): boolean {
    if (this.mode !== "sandbox" || fromId === toId) return false;
    const from = this.sandboxObjects.find((object) => object.id === fromId);
    const to = this.sandboxObjects.find((object) => object.id === toId);
    if (!from || !to || !isElectromagnetismWireConnectable(from.kind) || !isElectromagnetismWireConnectable(to.kind)) return false;
    const resolvedFromTerminal = fromTerminal ?? this.availableTerminal(from, to);
    const resolvedToTerminal = toTerminal ?? this.availableTerminal(to, from);
    const duplicate = this.sandboxWires.some((wire) => wire.kind === "wire" && (
      (wire.from === fromId && wire.fromTerminal === resolvedFromTerminal && wire.to === toId && wire.toTerminal === resolvedToTerminal)
      || (wire.from === toId && wire.fromTerminal === resolvedToTerminal && wire.to === fromId && wire.toTerminal === resolvedFromTerminal)
    ));
    if (duplicate) return false;
    this.sandboxWires.push({ from: fromId, to: toId, kind: "wire", fromTerminal: resolvedFromTerminal, toTerminal: resolvedToTerminal });
    if (from.kind === "capacitor" || to.kind === "capacitor") this.running = true;
    return true;
  }
  toggleSandboxSwitch(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "switch");
    if (!object) return false;
    object.enabled = !object.enabled;
    return true;
  }
  toggleSandboxMagnet(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "magnet");
    if (!object) return false;
    object.direction = object.direction === -1 ? 1 : -1;
    return true;
  }
  toggleSandboxBattery(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "battery");
    if (!object) return false;
    object.direction = object.direction === -1 ? 1 : -1;
    return true;
  }
  toggleSandboxGenerator(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "generator");
    if (!object) return false;
    object.enabled = object.enabled === false; this.running = true; return true;
  }
  toggleSandboxCharge(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "charge");
    if (!object) return false;
    object.value *= -1;
    return true;
  }
  toggleSandboxCurrent(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "current-wire");
    if (!object) return false;
    object.value *= -1;
    return true;
  }
  toggleSandboxFieldDirection(id: string): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "field-region");
    if (!object) return false;
    object.value *= -1;
    return true;
  }
  setSandboxChargeMotion(id: string, moving: boolean): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "charge");
    if (!object) return false;
    object.moving = moving;
    if (moving && (!object.velocity || Math.hypot(object.velocity.x, object.velocity.y) < 1e-6)) object.velocity = { x: 0.18, y: 0 };
    return true;
  }
  setSandboxChargeVelocityFromHandle(id: string, handle: Vector2): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "charge");
    if (!object) return false;
    const dx = handle.x - object.position.x; const dy = handle.y - object.position.y;
    const distance = Math.hypot(dx, dy); if (distance < 1e-5) return false;
    const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12;
    const speed = clamp(distance * 1.8, 0.08, 0.45);
    object.velocity = { x: Math.cos(snappedAngle) * speed, y: Math.sin(snappedAngle) * speed };
    object.moving = false; object.trail = [{ ...object.position }]; object.history = [{ x: 0, y: speed }];
    return true;
  }
  disconnectSandboxObject(id: string): boolean {
    const previousLength = this.sandboxWires.length;
    this.sandboxWires = this.sandboxWires.filter((wire) => wire.from !== id && wire.to !== id);
    return this.sandboxWires.length !== previousLength;
  }
  duplicateSandboxObject(id: string): ElectromagnetismSandboxObject | null {
    const source = this.sandboxObjects.find((candidate) => candidate.id === id);
    if (!source) return null;
    const duplicate = this.makeSandboxObject(source.kind, {
      x: clamp(source.position.x + 0.1, 0.05, 0.95), y: clamp(source.position.y + 0.1, 0.08, 0.92),
    }, source.value);
    duplicate.enabled = source.enabled; duplicate.direction = source.direction; duplicate.secondaryValue = source.secondaryValue;
    duplicate.velocity = source.velocity ? { ...source.velocity } : undefined; duplicate.moving = source.moving;
    duplicate.trail = source.trail?.map((point) => ({ ...point })); duplicate.history = source.history?.map((point) => ({ ...point }));
    this.sandboxObjects.push(duplicate);
    return duplicate;
  }
  setSandboxObjectValue(id: string, value: number): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id);
    if (!object || !Number.isFinite(value)) return false;
    const ranges: Partial<Record<ElectromagnetismSandboxKind, readonly [number, number]>> = {
      charge: [0.5e-6, 6e-6], battery: [1.5, 12], resistor: [1, 30], bulb: [2, 20], capacitor: [1, 10], "current-wire": [0.5, 10], "field-region": [0.5, 1.5], magnet: [0.4, 2], coil: [20, 160], "iron-load": [1, 3], motor: [3, 12], generator: [3, 12], transformer: [20, 160],
    };
    const range = ranges[object.kind]; if (!range) return false;
    const sign = object.kind === "charge" || object.kind === "current-wire" || object.kind === "field-region" ? Math.sign(object.value || 1) : 1;
    object.value = sign * clamp(Math.abs(value), range[0], range[1]);
    return true;
  }
  setSandboxObjectSecondaryValue(id: string, value: number): boolean {
    const object = this.sandboxObjects.find((candidate) => candidate.id === id && candidate.kind === "capacitor");
    if (!object || !Number.isFinite(value)) return false;
    object.secondaryValue = clamp(value, -12, 12);
    return true;
  }

  snapshot(): ElectromagnetismSnapshot {
    const result = this.measurement(); const sandbox = this.sandboxState();
    return {
      mode: this.mode, running: this.running, time: this.time, probe: { ...this.probe }, level: this.level,
      sign: this.sign, direction: this.direction, coilTurns: this.coilTurns, magnetSpeed: this.magnetSpeed,
      rotorAngle: this.rotorAngle, angularSpeed: this.angularSpeed, secondaryTurns: this.secondaryTurns,
      particleTargetsHit: [...this.particleTargetsHit], craneCarrying: this.craneCarrying, craneDelivered: this.craneDelivered,
      capacitorMode: this.capacitorMode, circuitArrangement: this.circuitArrangement, capacitorVoltage: this.capacitorVoltage,
      wirePosition: this.wirePosition, wireVelocity: this.wireVelocity, deviceLoad: this.deviceLoad,
      motorLoadHeight: this.motorLoadHeight, generatorOutputLevel: this.generatorOutputLevel,
      applianceTargetVoltage: this.applianceTargetVoltage,
      particle: { ...this.particle }, particleVelocity: { ...this.particleVelocity }, trail: this.trail.map((point) => ({ ...point })),
      measurement: result.primary, secondaryMeasurement: result.secondary, graph: this.graph(), graphMarker: this.graphMarker(result.primary.value),
      fieldSamples: this.fieldSamples(), fieldLines: this.fieldLines(), magneticFieldLines: this.magneticFieldLines(), probeField: this.guidedProbeField(), capacitorField: this.capacitorField(), lorentzForce: this.lorentzForceVector(),
      sandboxObjects: this.sandboxObjects.map((object) => ({
        ...object, position: { ...object.position }, velocity: object.velocity ? { ...object.velocity } : undefined,
        trail: object.trail?.map((point) => ({ ...point })), history: object.history?.map((point) => ({ ...point })),
      })),
      sandboxConnections: sandbox.connections, sandboxForces: [...this.sandboxWireForces(), ...this.sandboxChargeForces()], sandboxMetrics: sandbox.metrics, sandboxGraph: sandbox.graph,
      sandboxCurrents: sandbox.currents,
    };
  }

  private measurement(): { primary: ElectromagnetismSnapshot["measurement"]; secondary: ElectromagnetismSnapshot["secondaryMeasurement"] } {
    if (this.mode === "sandbox") {
      const sandbox = this.sandboxState();
      const movingCharge = this.sandboxObjects.find((object) => object.kind === "charge" && object.moving);
      if (movingCharge) return {
        primary: { label: "움직이는 전하 속력", value: Math.hypot(movingCharge.velocity?.x ?? 0, movingCharge.velocity?.y ?? 0) * ELECTROMAGNETISM_WORLD.width, unit: "m/s" },
        secondary: { label: "수직 자기장", value: this.sandboxMagneticFieldZAt(movingCharge.position), unit: "상대값" },
      };
      if (sandbox.connections.some((item) => item.kind === "wire")) return { primary: { label: "연결 회로 전류", value: sandbox.metrics.current, unit: "A" }, secondary: { label: "전구에 쓰인 전력", value: sandbox.metrics.loadPower, unit: "W" } };
      if (Math.abs(sandbox.metrics.inducedVoltage) > 0 || sandbox.connections.some((item) => item.kind === "induction")) return { primary: { label: "유도 전압", value: sandbox.metrics.inducedVoltage, unit: "V" }, secondary: null };
      const probe = this.sandboxObjects.some((object) => object.kind === "probe");
      const charges = this.sandboxChargeSources(); const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet"); const capacitors = this.sandboxObjects.filter((object) => object.kind === "capacitor"); const currentWires = this.sandboxObjects.filter((object) => object.kind === "current-wire"); const fieldRegions = this.sandboxObjects.filter((object) => object.kind === "field-region");
      if (probe && charges.length) return { primary: { label: "탐침 전기장", value: Math.hypot(sandbox.metrics.electricField.x, sandbox.metrics.electricField.y), unit: "N/C" }, secondary: magnets.length || currentWires.length || fieldRegions.length ? { label: "탐침 자기장", value: this.sandboxMagneticRelativeAt(this.sandboxObjects.find((object) => object.kind === "probe")!.position), unit: "상대값" } : { label: "탐침 전위", value: sandbox.metrics.potential, unit: "V" } };
      if (probe && (magnets.length || currentWires.length || fieldRegions.length)) return { primary: { label: "탐침 자기장", value: this.sandboxMagneticRelativeAt(this.sandboxObjects.find((object) => object.kind === "probe")!.position), unit: "상대값" }, secondary: null };
      const wireForces = this.sandboxWireForces();
      if (wireForces.some((force) => Math.hypot(force.vector.x, force.vector.y) > 1e-9)) return { primary: { label: "도선에 작용하는 힘", value: wireForces.reduce((sum, force) => sum + Math.hypot(force.vector.x, force.vector.y), 0), unit: "상대값" }, secondary: { label: "도선 전류", value: currentWires.reduce((sum, wire) => sum + Math.abs(wire.value), 0), unit: "A" } };
      if (capacitors.length) {
        const capacitor = capacitors[0]; const capacitance = parallelPlateCapacitance(8.854e-12, 0.02, capacitor.value / 1000) * 1e9;
        return { primary: { label: "전기용량", value: capacitance, unit: "nF" }, secondary: { label: "저장 에너지", value: capacitorEnergy(capacitance / 1e9, capacitor.secondaryValue ?? 9) * 1e9, unit: "nJ" } };
      }
      if (currentWires.length) return { primary: { label: "도선 전류", value: currentWires.reduce((sum, wire) => sum + Math.abs(wire.value), 0), unit: "A" }, secondary: null };
      if (fieldRegions.length) return { primary: { label: "수직 자기장", value: fieldRegions.reduce((sum, field) => sum + Math.abs(field.value), 0), unit: "상대값" }, secondary: null };
      if (magnets.length) return { primary: { label: "자석 세기 합", value: magnets.reduce((sum, magnet) => sum + Math.abs(magnet.value), 0), unit: "상대값" }, secondary: null };
      if (charges.length) return { primary: { label: "전하량 합", value: charges.reduce((sum, charge) => sum + Math.abs(charge.charge), 0) * 1e6, unit: "μC" }, secondary: null };
      return { primary: { label: "배치한 장치", value: this.sandboxObjects.length, unit: "개" }, secondary: null };
    }
    if (this.mode === "charge") {
      const distance = this.distanceFrom({ x: 0.32, y: 0.5 }); const magnitude = coulombForceMagnitude(2e-6, this.sign * this.level * 2e-6, distance);
      return { primary: { label: "전기력", value: magnitude, unit: "N" }, secondary: { label: "전하 사이 거리", value: distance, unit: "m" } };
    }
    if (this.mode === "electric-field") return { primary: { label: "전기장 세기", value: Math.hypot(this.guidedProbeField().x, this.guidedProbeField().y), unit: "N/C" }, secondary: null };
    if (this.mode === "potential") {
      const distance = this.distanceFrom({ x: 0.35, y: 0.5 }); const potential = pointChargePotential(2e-6, distance);
      return { primary: { label: "전위", value: potential, unit: "V" }, secondary: { label: "위치 에너지", value: this.sign * this.level * 1e-6 * potential, unit: "J" } };
    }
    if (this.mode === "circuits") {
      const voltage = 3 + this.level * 6; const bulbResistance = circuitResistanceAtX(this.probe.x); const equivalentResistance = this.circuitArrangement === "series" ? bulbResistance * 2 : bulbResistance / 2;
      const totalCurrent = currentFromVoltage(voltage, equivalentResistance); const bulbCurrent = this.circuitArrangement === "series" ? totalCurrent : totalCurrent / 2;
      return { primary: { label: "전체 회로 전류", value: totalCurrent, unit: "A" }, secondary: { label: "전구 하나의 전력", value: bulbCurrent * bulbCurrent * bulbResistance, unit: "W" } };
    }
    if (this.mode === "capacitors") {
      const separation = capacitorSeparationMmAtX(this.probe.x) / 1000; const capacitance = parallelPlateCapacitance(8.854e-12, 0.02, separation);
      const storedCharge = capacitance * this.capacitorVoltage;
      return { primary: { label: "축전기 전압", value: this.capacitorVoltage, unit: "V" }, secondary: { label: "저장 전하", value: storedCharge * 1e9, unit: "nC" } };
    }
    if (this.mode === "magnetic-field") {
      const distance = this.distanceFrom({ x: 0.44, y: 0.5 }); const field = Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, distance));
      return { primary: { label: "자기장 세기", value: field * 1e6, unit: "μT" }, secondary: { label: "전류", value: this.direction * this.level * 5, unit: "A" } };
    }
    if (this.mode === "electromagnetic-force") {
      return { primary: { label: "도선에 작용하는 힘", value: Math.hypot(this.lorentzForceVector().x, this.lorentzForceVector().y), unit: "상대값" }, secondary: { label: "전류", value: this.sign * this.level * 3, unit: "A" } };
    }
    if (this.mode === "induction") return { primary: { label: "유도 전압", value: this.inducedVoltage, unit: "V" }, secondary: { label: "자석 속도", value: this.magnetSpeed, unit: "m/s" } };
    if (this.mode === "charged-particle") {
      const speed = Math.hypot(this.particleVelocity.x, this.particleVelocity.y) * ELECTROMAGNETISM_WORLD.width;
      const radius = speed / Math.max(0.1, this.level * 1.7);
      return { primary: { label: "궤도 반지름", value: radius, unit: "m" }, secondary: { label: "전하 속력", value: speed, unit: "m/s" } };
    }
    if (this.mode === "electromagnet") {
      const current = guidedCurrentAtLevel(this.level); const force = electromagnetLiftForce(current, this.coilTurns);
      return { primary: { label: "전자석의 힘", value: force, unit: "상대값" }, secondary: { label: "짐에 필요한 힘", value: [0, 4, 9, 15][this.deviceLoad], unit: "상대값" } };
    }
    if (this.mode === "motor") {
      const current = guidedCurrentAtLevel(this.level); const torque = motorTorqueAtCurrent(current);
      const requiredTorque = [0, 5.5, 8.5, 10.5][this.deviceLoad];
      return { primary: { label: "회전 토크", value: torque, unit: "상대값" }, secondary: { label: "짐에 필요한 토크", value: requiredTorque, unit: "상대값" } };
    }
    if (this.mode === "generator") {
      const power = this.inducedVoltage ** 2 / 8;
      return { primary: { label: "발전 전압", value: this.inducedVoltage, unit: "V" }, secondary: { label: "전구 전력", value: power, unit: "W" } };
    }
    const primaryVoltage = 3 + this.level * 6;
    const outputVoltage = transformerOutputVoltage(primaryVoltage, 80, this.secondaryTurns);
    return { primary: { label: "2차 전압", value: outputVoltage, unit: "V" }, secondary: { label: "권수비", value: this.secondaryTurns / 80, unit: "배" } };
  }

  private graph(): GraphPoint[] {
    if (this.mode === "sandbox") return this.sandboxGraphPoints();
    if (this.mode === "charge") return points(48, 0.25, 2.4, (distance) => coulombForceMagnitude(2e-6, this.level * 2e-6, distance));
    if (this.mode === "electric-field") return points(48, 0.08, 0.92, (x) => { const field = this.electricFieldAt({ x, y: this.probe.y }, this.guidedCharges()); return Math.hypot(field.x, field.y); }).map((point) => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y }));
    if (this.mode === "potential") return points(48, 0.25, 2.4, (distance) => pointChargePotential(2e-6, distance));
    if (this.mode === "circuits") { const voltage = 3 + this.level * 6; return points(48, 2, 20, (resistance) => currentFromVoltage(voltage, this.circuitArrangement === "series" ? resistance * 2 : resistance / 2)); }
    if (this.mode === "capacitors") return this.capacitorHistory.map((point) => ({ ...point }));
    if (this.mode === "magnetic-field") return points(48, 1, 80, (centimeters) => Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, centimeters / 100)) * 1e6);
    if (this.mode === "electromagnetic-force") {
      return points(48, 0, 5, (current) => magneticForceMagnitude(current, 1, 2.2, Math.PI / 2));
    }
    if (this.mode === "induction") return points(48, -2.4, 2.4, (speed) => this.inducedVoltageForSpeed(speed, this.probe));
    if (this.mode === "charged-particle") return points(48, 0.2, 1.1, (speed) => speed / Math.max(0.1, this.level * 1.7));
    if (this.mode === "electromagnet") return points(48, 1, 6, (current) => electromagnetLiftForce(current, this.coilTurns));
    if (this.mode === "motor") return points(48, 0, 6, motorTorqueAtCurrent);
    if (this.mode === "generator") return points(48, -120, 120, (rpm) => generatorVoltageAtSpeed(rpm * Math.PI / 30, this.coilTurns));
    const primaryVoltage = 3 + this.level * 6;
    return points(48, 0.25, 2, (ratio) => transformerOutputVoltage(primaryVoltage, 1, ratio));
  }

  private graphMarker(value: number): GraphPoint | null {
    if (this.mode === "sandbox") return this.sandboxGraphMarker();
    if (this.mode === "charge" || this.mode === "potential") return { x: this.distanceFrom({ x: this.mode === "charge" ? 0.32 : 0.35, y: 0.5 }), y: value };
    if (this.mode === "electric-field") return { x: normalizedToWorld(this.probe).x, y: value };
    if (this.mode === "circuits") return { x: circuitResistanceAtX(this.probe.x), y: value };
    if (this.mode === "capacitors") return this.capacitorHistory.length ? { ...this.capacitorHistory[this.capacitorHistory.length - 1] } : { x: this.time, y: value };
    if (this.mode === "magnetic-field") return { x: this.distanceFrom({ x: 0.44, y: 0.5 }) * 100, y: value };
    if (this.mode === "electromagnetic-force") return { x: this.level * 3, y: value };
    if (this.mode === "induction") return { x: this.magnetSpeed, y: value };
    if (this.mode === "charged-particle") return { x: Math.hypot(this.particleVelocity.x, this.particleVelocity.y) * ELECTROMAGNETISM_WORLD.width, y: value };
    if (this.mode === "electromagnet") return { x: guidedCurrentAtLevel(this.level), y: value };
    if (this.mode === "motor") return { x: guidedCurrentAtLevel(this.level), y: value };
    if (this.mode === "generator") return { x: this.angularSpeed * 30 / Math.PI, y: value };
    return { x: this.secondaryTurns / 80, y: value };
  }

  private guidedCharges(): readonly { position: Vector2; charge: number }[] {
    if (this.mode === "charge") return [
      { position: { x: 0.32, y: 0.5 }, charge: 2e-6 },
      { position: this.probe, charge: this.sign * this.level * 2e-6 },
    ];
    return [{ position: { x: 0.35, y: 0.42 }, charge: this.sign * this.level * 2e-6 }, { position: { x: 0.35, y: 0.66 }, charge: -this.sign * this.level * 2e-6 }];
  }
  private electricFieldAt(point: Vector2, charges: readonly { position: Vector2; charge: number }[]): Vector2 {
    return this.electricFieldAtWorld(normalizedToWorld(point), charges);
  }
  private electricFieldAtWorld(target: Vector2, charges: readonly { position: Vector2; charge: number }[]): Vector2 {
    let x = 0; let y = 0;
    for (const source of charges) {
      const sourceWorld = normalizedToWorld(source.position);
      if (Math.hypot(target.x - sourceWorld.x, target.y - sourceWorld.y) < 0.03) continue;
      const field = pointChargeElectricFieldVector(source.charge, sourceWorld, target); x += field.x; y += field.y;
    }
    return { x, y };
  }
  private guidedProbeField(): Vector2 { return this.mode === "electric-field" ? this.electricFieldAt(this.probe, this.guidedCharges()) : { x: 0, y: 0 }; }
  private fieldSamples(): FieldSample[] {
    if (this.mode !== "charge" && this.mode !== "electric-field" && this.mode !== "sandbox") return [];
    const charges = this.mode === "sandbox" ? this.sandboxChargeSources() : this.guidedCharges();
    const columns = 18; const rows = 12;
    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns; const row = Math.floor(index / columns);
      const point = { x: 0.1 + column * 0.8 / (columns - 1), y: 0.12 + row * 0.76 / (rows - 1) };
      return { point, vector: this.electricFieldAt(point, charges) };
    });
  }
  private fieldLines(): FieldLine[] {
    if (this.mode !== "charge" && this.mode !== "electric-field" && this.mode !== "sandbox") return [];
    const charges = this.mode === "sandbox" ? this.sandboxChargeSources() : this.guidedCharges();
    const averageStrength = charges.length ? charges.reduce((sum, source) => sum + Math.abs(source.charge), 0) / charges.length / 2e-6 : 1;
    const seeds = charges.length > 4 ? 8 : Math.round(clamp(8 + averageStrength * 4, 9, 20));
    return this.traceFieldLines(charges, seeds);
  }
  private magneticFieldLines(): FieldLine[] {
    if (this.mode !== "sandbox") return [];
    const poles = this.sandboxMagneticPoles();
    const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet");
    const averageStrength = magnets.length ? magnets.reduce((sum, magnet) => sum + Math.abs(magnet.value), 0) / magnets.length : 1;
    return this.traceFieldLines(poles, poles.length > 8 ? 7 : Math.round(clamp(8 + averageStrength * 4, 9, 18)));
  }
  private traceFieldLines(sources: readonly { position: Vector2; charge: number }[], seedsPerSource: number): FieldLine[] {
    if (sources.length === 0) return [];
    const positiveSources = sources.filter((source) => source.charge > 0);
    const seedSources = positiveSources.length > 0 ? positiveSources : sources.filter((source) => source.charge < 0);
    const stepLength = 0.018;
    const boundary = { left: 0.035, right: ELECTROMAGNETISM_WORLD.width - 0.035, top: 0.035, bottom: ELECTROMAGNETISM_WORLD.height - 0.035 };
    const lines: FieldLine[] = [];

    for (const source of seedSources) {
      const sourceWorld = normalizedToWorld(source.position);
      const integrationDirection = source.charge > 0 ? 1 : -1;
      for (let seed = 0; seed < seedsPerSource; seed += 1) {
        const angle = seed * Math.PI * 2 / seedsPerSource;
        let point = { x: sourceWorld.x + Math.cos(angle) * 0.055, y: sourceWorld.y + Math.sin(angle) * 0.055 };
        const worldPoints: Vector2[] = [{ ...point }];
        for (let iteration = 0; iteration < 180; iteration += 1) {
          const field = this.electricFieldAtWorld(point, sources);
          const magnitude = Math.hypot(field.x, field.y);
          if (!Number.isFinite(magnitude) || magnitude < 1e-12) break;
          point = {
            x: point.x + field.x / magnitude * stepLength * integrationDirection,
            y: point.y + field.y / magnitude * stepLength * integrationDirection,
          };
          worldPoints.push({ ...point });
          const reachedOppositePole = sources.some((target) => target.charge * source.charge < 0
            && Math.hypot(point.x - normalizedToWorld(target.position).x, point.y - normalizedToWorld(target.position).y) < 0.065);
          if (reachedOppositePole || point.x < boundary.left || point.x > boundary.right || point.y < boundary.top || point.y > boundary.bottom) break;
        }
        if (source.charge < 0) worldPoints.reverse();
        if (worldPoints.length > 6) lines.push({ points: worldPoints.map(worldToNormalized) });
      }
    }
    return lines;
  }
  private capacitorField(): number {
    if (this.mode !== "capacitors") return 0;
    return this.capacitorVoltage / (capacitorSeparationMmAtX(this.probe.x) / 1000);
  }
  private lorentzForceVector(): Vector2 {
    if (this.mode === "electromagnetic-force") return { x: 0, y: -this.sign * this.direction * this.level * 3 * 2.2 };
    if (this.mode === "charged-particle") return {
      x: this.sign * this.direction * this.particleVelocity.y * this.level,
      y: -this.sign * this.direction * this.particleVelocity.x * this.level,
    };
    return { x: 0, y: 0 };
  }
  private distanceFrom(source: Vector2): number { return Math.max(0.15, worldDistance(this.probe, source)); }
  private guidedFluxAt(magnet: Vector2): number { return fluxAtDistance(worldDistance(magnet, INDUCTION_COIL)); }
  private inducedVoltageForSpeed(speed: number, position: Vector2): number {
    const epsilon = 0.002; const xWorld = normalizedToWorld(position).x;
    const left = { x: clamp((xWorld - epsilon) / ELECTROMAGNETISM_WORLD.width, 0, 1), y: position.y };
    const right = { x: clamp((xWorld + epsilon) / ELECTROMAGNETISM_WORLD.width, 0, 1), y: position.y };
    const gradient = (this.guidedFluxAt(right) - this.guidedFluxAt(left)) / (2 * epsilon);
    return inducedEmf(this.coilTurns, gradient * speed, 1);
  }

  private stepSandboxCharges(dt: number): void {
    for (const charge of this.sandboxObjects.filter((object) => object.kind === "charge" && object.moving)) {
      const velocity = charge.velocity ?? { x: 0.18, y: 0 };
      const electric = this.electricFieldAt(charge.position, this.sandboxChargeSources(charge.id));
      const magneticZ = this.sandboxMagneticFieldZAt(charge.position);
      const sign = Math.sign(charge.value || 1);
      const acceleration = {
        x: sign * electric.x * 1.8e-6 + sign * velocity.y * magneticZ * 2.8,
        y: sign * electric.y * 1.8e-6 - sign * velocity.x * magneticZ * 2.8,
      };
      let nextVelocity = { x: velocity.x + acceleration.x * dt, y: velocity.y + acceleration.y * dt };
      const speed = Math.hypot(nextVelocity.x, nextVelocity.y);
      if (speed > 0.55) nextVelocity = { x: nextVelocity.x / speed * 0.55, y: nextVelocity.y / speed * 0.55 };
      const nextPosition = { x: charge.position.x + nextVelocity.x * dt, y: charge.position.y + nextVelocity.y * dt };
      const outside = nextPosition.x < 0.04 || nextPosition.x > 0.96 || nextPosition.y < 0.07 || nextPosition.y > 0.93;
      charge.position = { x: clamp(nextPosition.x, 0.04, 0.96), y: clamp(nextPosition.y, 0.07, 0.93) };
      charge.velocity = nextVelocity; charge.moving = !outside;
      charge.trail ??= [];
      if (charge.trail.length === 0 || Math.hypot(charge.position.x - charge.trail[charge.trail.length - 1].x, charge.position.y - charge.trail[charge.trail.length - 1].y) > 0.008) charge.trail.push({ ...charge.position });
      if (charge.trail.length > 220) charge.trail.splice(0, charge.trail.length - 220);
      charge.history ??= [];
      charge.history.push({ x: this.time, y: Math.hypot(nextVelocity.x, nextVelocity.y) * ELECTROMAGNETISM_WORLD.width });
      if (charge.history.length > 180) charge.history.splice(0, charge.history.length - 180);
    }
  }
  private stepSandboxIronLoads(dt: number): void {
    const currentById = new Map(this.sandboxCircuitState().currents.map((entry) => [entry.objectId, entry.current]));
    for (const load of this.sandboxObjects.filter((object) => object.kind === "iron-load")) {
      const coils = this.sandboxObjects.filter((object) => object.kind === "coil" && Math.abs(currentById.get(object.id) ?? 0) > 0.02);
      const nearest = coils.reduce<ElectromagnetismSandboxObject | null>((best, coil) => !best || worldDistance(load.position, coil.position) < worldDistance(load.position, best.position) ? coil : best, null);
      if (!nearest) { load.velocity = { x: 0, y: 0 }; continue; }
      const distance = Math.max(0.04, worldDistance(load.position, nearest.position));
      if (distance > 0.7) { load.velocity = { x: 0, y: 0 }; continue; }
      const current = Math.abs(currentById.get(nearest.id) ?? 0); const strength = current * nearest.value / 80 / Math.max(0.22, load.value);
      const dx = nearest.position.x - load.position.x; const dy = nearest.position.y - load.position.y; const normalizedDistance = Math.max(1e-6, Math.hypot(dx, dy));
      const velocity = load.velocity ?? { x: 0, y: 0 };
      const nextVelocity = { x: (velocity.x + dx / normalizedDistance * strength * dt * 0.09) * Math.exp(-dt * 4), y: (velocity.y + dy / normalizedDistance * strength * dt * 0.09) * Math.exp(-dt * 4) };
      load.velocity = nextVelocity; load.position = { x: clamp(load.position.x + nextVelocity.x * dt, 0.05, 0.95), y: clamp(load.position.y + nextVelocity.y * dt, 0.08, 0.92) };
    }
  }
  private stepSandboxCapacitors(dt: number): void {
    const currentById = new Map(this.sandboxCircuitState().currents.map((entry) => [entry.objectId, entry.current]));
    for (const capacitor of this.sandboxObjects.filter((object) => object.kind === "capacitor")) {
      const current = currentById.get(capacitor.id) ?? 0;
      const simulationCapacitance = clamp(0.9 / Math.max(1, capacitor.value), 0.07, 0.9);
      capacitor.secondaryValue = clamp((capacitor.secondaryValue ?? 0) + current / simulationCapacitance * dt, -12, 12);
    }
  }
  private sandboxChargeSources(excludeId?: string): { position: Vector2; charge: number }[] {
    return this.sandboxObjects.filter((object) => object.kind === "charge" && object.id !== excludeId).map((object) => ({ position: object.position, charge: object.value }));
  }
  private sandboxMagneticFieldZAt(point: Vector2): number {
    return this.sandboxObjects.filter((object) => object.kind === "field-region").reduce((sum, field) => {
      const influence = clamp(1 - worldDistance(point, field.position) / 0.58);
      return sum + field.value * influence;
    }, 0);
  }
  private sandboxMagneticPoles(): { position: Vector2; charge: number }[] {
    const magnetPoles = this.sandboxObjects.filter((object) => object.kind === "magnet").flatMap((magnet) => {
      const direction = magnet.direction ?? 1; const strength = Math.abs(magnet.value) * 2e-6;
      return [
        { position: { x: magnet.position.x - 0.05, y: magnet.position.y }, charge: direction * strength },
        { position: { x: magnet.position.x + 0.05, y: magnet.position.y }, charge: -direction * strength },
      ];
    });
    const currentById = new Map(this.sandboxCircuitState().currents.map((entry) => [entry.objectId, entry.current]));
    const coilPoles = this.sandboxObjects.filter((object) => object.kind === "coil").flatMap((coil) => {
      const current = currentById.get(coil.id) ?? 0;
      if (Math.abs(current) < 1e-6) return [];
      const direction = Math.sign(current); const strength = clamp(Math.abs(current) * coil.value / 80, 0.2, 2.5) * 2e-6;
      return [
        { position: { x: coil.position.x - 0.045, y: coil.position.y }, charge: direction * strength },
        { position: { x: coil.position.x + 0.045, y: coil.position.y }, charge: -direction * strength },
      ];
    });
    return [...magnetPoles, ...coilPoles];
  }
  private sandboxMagneticRelativeAt(point: Vector2): number {
    const perpendicular = Math.abs(this.sandboxMagneticFieldZAt(point));
    const graph = this.sandboxMagneticGraphPoints(); if (graph.length === 0) return perpendicular;
    const x = normalizedToWorld(point).x;
    return Math.hypot(graph.reduce((closest, candidate) => Math.abs(candidate.x - x) < Math.abs(closest.x - x) ? candidate : closest).y, perpendicular);
  }
  private sandboxMagneticFieldAt(point: Vector2): Vector2 {
    const poleField = this.electricFieldAt(point, this.sandboxMagneticPoles());
    let x = poleField.x / 1e5; let y = poleField.y / 1e5;
    const target = normalizedToWorld(point);
    for (const wire of this.sandboxObjects.filter((object) => object.kind === "current-wire")) {
      const source = normalizedToWorld(wire.position); const dx = target.x - source.x; const dy = target.y - source.y;
      const distance = Math.max(0.06, Math.hypot(dx, dy)); const magnitude = wire.value * 0.2 / distance;
      x += -dy / distance * magnitude; y += dx / distance * magnitude;
    }
    return { x, y };
  }
  private sandboxWireForces(): SandboxForce[] {
    const poles = this.sandboxMagneticPoles(); if (poles.length === 0) return [];
    return this.sandboxObjects.filter((object) => object.kind === "current-wire").map((wire) => {
      const field = this.electricFieldAt(wire.position, poles);
      const bx = field.x / 1e5; const by = field.y / 1e5;
      return { objectId: wire.id, vector: { x: -wire.value * by, y: wire.value * bx } };
    });
  }
  private sandboxChargeForces(): SandboxForce[] {
    return this.sandboxObjects.filter((object) => object.kind === "charge" && object.moving).map((charge) => {
      const velocity = charge.velocity ?? { x: 0, y: 0 }; const fieldZ = this.sandboxMagneticFieldZAt(charge.position); const sign = Math.sign(charge.value || 1);
      return { objectId: charge.id, vector: { x: sign * velocity.y * fieldZ * 2.8, y: -sign * velocity.x * fieldZ * 2.8 } };
    });
  }
  private sandboxMagneticGraphPoints(): GraphPoint[] {
    if (this.sandboxMagneticPoles().length === 0 && !this.sandboxObjects.some((object) => object.kind === "current-wire" || object.kind === "field-region")) return [];
    const probe = this.sandboxObjects.find((object) => object.kind === "probe"); const y = probe?.position.y ?? 0.5;
    const raw = points(48, 0.08, 0.92, (x) => {
      const point = { x, y }; const field = this.sandboxMagneticFieldAt(point); return Math.hypot(field.x, field.y, this.sandboxMagneticFieldZAt(point));
    });
    const maximum = Math.max(...raw.map((point) => point.y), 1e-9);
    return raw.map((point) => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y / maximum }));
  }
  private sandboxFluxLinkage(): number {
    const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet"); const coils = this.sandboxObjects.filter((object) => object.kind === "coil");
    return coils.reduce((sum, coil) => sum + magnets.reduce((magnetSum, magnet) => magnetSum + (magnet.direction ?? 1) * magnet.value * coil.value * fluxAtDistance(worldDistance(coil.position, magnet.position)), 0), 0);
  }
  private circuitConnections(): SandboxConnection[] { return this.sandboxWires.map((wire) => ({ ...wire })); }
  private inductionConnections(): SandboxConnection[] {
    const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet"); const coils = this.sandboxObjects.filter((object) => object.kind === "coil");
    return magnets.flatMap((magnet) => coils.map((coil) => ({ from: magnet.id, to: coil.id, kind: "induction" as const })));
  }
  private sandboxCircuitState(): {
    current: number;
    currents: SandboxCurrent[];
    voltage: number;
    loadPower: number;
    resistance: number;
    batteryArrangement: SandboxBatteryArrangement;
  } {
    type Branch = { object: ElectromagnetismSandboxObject; a: string; b: string; resistance: number; sourceDrop: number; role?: "transformer-primary" | "transformer-secondary"; pairIndex?: number; ratio?: number };
    const parent = new Map<string, string>();
    const terminalKey = (objectId: string, terminal: SandboxTerminal): string => `${objectId}:${terminal}`;
    const find = (key: string): string => {
      const current = parent.get(key) ?? key;
      if (!parent.has(key)) parent.set(key, key);
      if (current === key) return key;
      const root = find(current); parent.set(key, root); return root;
    };
    const union = (left: string, right: string): void => {
      const leftRoot = find(left); const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };
    for (const object of this.sandboxObjects.filter((candidate) => isElectromagnetismWireConnectable(candidate.kind))) {
      for (const terminal of sandboxTerminals(object.kind)) find(terminalKey(object.id, terminal));
      if (object.kind === "switch" && object.enabled !== false) union(terminalKey(object.id, "a"), terminalKey(object.id, "b"));
    }
    for (const connection of this.sandboxWires) {
      if (connection.kind !== "wire") continue;
      union(terminalKey(connection.from, connection.fromTerminal), terminalKey(connection.to, connection.toTerminal));
    }
    const branchObjects = this.sandboxObjects.filter((object) => object.kind === "battery" || object.kind === "resistor" || object.kind === "bulb" || object.kind === "capacitor" || object.kind === "coil" || object.kind === "motor" || object.kind === "generator");
    const branches: Branch[] = branchObjects.map((object) => ({
      object,
      a: find(terminalKey(object.id, "a")),
      b: find(terminalKey(object.id, "b")),
      resistance: object.kind === "battery" || object.kind === "generator" ? 0.2 : object.kind === "capacitor" ? 1.2 : object.kind === "coil" ? 2 : object.value,
      sourceDrop: object.kind === "battery" ? -(object.direction ?? 1) * object.value : object.kind === "generator" && object.enabled !== false ? -(object.direction ?? 1) * object.value : object.kind === "capacitor" ? (object.secondaryValue ?? 0) : object.kind === "coil" ? -this.sandboxInducedVoltage : 0,
    }));
    for (const transformer of this.sandboxObjects.filter((object) => object.kind === "transformer")) {
      const primaryIndex = branches.length; const secondaryIndex = primaryIndex + 1; const ratio = transformer.value / 80;
      branches.push({ object: transformer, a: find(terminalKey(transformer.id, "a")), b: find(terminalKey(transformer.id, "b")), resistance: 0, sourceDrop: 0, role: "transformer-primary", pairIndex: secondaryIndex, ratio });
      branches.push({ object: transformer, a: find(terminalKey(transformer.id, "c")), b: find(terminalKey(transformer.id, "d")), resistance: 0, sourceDrop: 0, role: "transformer-secondary", pairIndex: primaryIndex, ratio });
    }
    if (branches.length === 0) return { current: 0, currents: [], voltage: 0, loadPower: 0, resistance: 0, batteryArrangement: "none" };

    const nodeNeighbors = new Map<string, Set<string>>();
    for (const branch of branches) {
      if (!nodeNeighbors.has(branch.a)) nodeNeighbors.set(branch.a, new Set());
      if (!nodeNeighbors.has(branch.b)) nodeNeighbors.set(branch.b, new Set());
      nodeNeighbors.get(branch.a)!.add(branch.b); nodeNeighbors.get(branch.b)!.add(branch.a);
    }
    const grounds = new Set<string>(); const visitedNodes = new Set<string>();
    for (const start of nodeNeighbors.keys()) {
      if (visitedNodes.has(start)) continue;
      grounds.add(start); const pending = [start];
      while (pending.length) {
        const node = pending.pop()!; if (visitedNodes.has(node)) continue; visitedNodes.add(node);
        for (const neighbor of nodeNeighbors.get(node) ?? []) pending.push(neighbor);
      }
    }
    const potentialNodes = [...nodeNeighbors.keys()].filter((node) => !grounds.has(node));
    const potentialIndex = new Map(potentialNodes.map((node, index) => [node, index]));
    const branchOffset = potentialNodes.length; const size = branchOffset + branches.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0)); const rightHand = Array(size).fill(0);
    for (const [node, row] of potentialIndex) {
      branches.forEach((branch, branchIndex) => {
        if (branch.a === node) matrix[row][branchOffset + branchIndex] += 1;
        if (branch.b === node) matrix[row][branchOffset + branchIndex] -= 1;
      });
    }
    branches.forEach((branch, branchIndex) => {
      const row = branchOffset + branchIndex;
      if (branch.role === "transformer-primary") {
        const secondary = branches[branch.pairIndex!];
        const primaryA = potentialIndex.get(branch.a); const primaryB = potentialIndex.get(branch.b); const secondaryA = potentialIndex.get(secondary.a); const secondaryB = potentialIndex.get(secondary.b);
        if (secondaryA !== undefined) matrix[row][secondaryA] += 1;
        if (secondaryB !== undefined) matrix[row][secondaryB] -= 1;
        if (primaryA !== undefined) matrix[row][primaryA] -= branch.ratio!;
        if (primaryB !== undefined) matrix[row][primaryB] += branch.ratio!;
      } else if (branch.role === "transformer-secondary") {
        matrix[row][branchOffset + branch.pairIndex!] += 1;
        matrix[row][branchOffset + branchIndex] += branch.ratio!;
      } else {
        const aIndex = potentialIndex.get(branch.a); const bIndex = potentialIndex.get(branch.b);
        if (aIndex !== undefined) matrix[row][aIndex] += 1;
        if (bIndex !== undefined) matrix[row][bIndex] -= 1;
        matrix[row][branchOffset + branchIndex] -= branch.resistance;
        rightHand[row] = branch.sourceDrop;
      }
    });
    const solved = this.solveLinearSystem(matrix, rightHand) ?? Array(size).fill(0);
    const rawCurrents = branches.map((branch, index) => ({ objectId: branch.object.id, current: solved[branchOffset + index] }));
    const currents = [...new Set(rawCurrents.map((entry) => entry.objectId))].map((objectId) => rawCurrents.filter((entry) => entry.objectId === objectId).reduce((strongest, entry) => Math.abs(entry.current) > Math.abs(strongest.current) ? entry : strongest));
    for (const object of this.sandboxObjects.filter((candidate) => candidate.kind === "switch")) currents.push({ objectId: object.id, current: 0 });
    const potentialValues = [0, ...potentialNodes.map((node) => solved[potentialIndex.get(node)!])].filter(Number.isFinite);
    const voltage = potentialValues.length ? Math.max(...potentialValues) - Math.min(...potentialValues) : 0;
    const currentById = new Map(currents.map((entry) => [entry.objectId, entry.current]));
    const batteries = branches.filter((branch) => branch.object.kind === "battery" || branch.object.kind === "generator");
    const batteryArrangement = this.batteryArrangement(batteries.map((branch) => ({ a: branch.a, b: branch.b })));
    const batteryCurrents = batteries.map((branch) => Math.abs(currentById.get(branch.object.id) ?? 0));
    const sourceCurrent = batteryArrangement === "parallel" || batteryArrangement === "mixed" ? batteryCurrents.reduce((sum, current) => sum + current, 0) : Math.max(0, ...batteryCurrents);
    const inducedCurrent = batteries.length === 0 ? branches.filter((branch) => branch.object.kind === "coil").reduce((sum, branch) => sum + Math.abs(currentById.get(branch.object.id) ?? 0), 0) : 0;
    const loadPower = branches.filter((branch) => branch.object.kind === "bulb" || branch.object.kind === "motor").reduce((sum, branch) => {
      const current = currentById.get(branch.object.id) ?? 0; return sum + current * current * branch.object.value;
    }, 0);
    const totalCurrent = sourceCurrent || inducedCurrent;
    return {
      current: totalCurrent,
      currents,
      voltage,
      loadPower,
      resistance: totalCurrent > 1e-9 ? voltage / totalCurrent : 0,
      batteryArrangement,
    };
  }
  private sandboxState(): { metrics: SandboxMetrics; currents: SandboxCurrent[]; connections: SandboxConnection[]; graph: ElectromagnetismSnapshot["sandboxGraph"] } {
    if (this.mode !== "sandbox") return { metrics: { electricField: { x: 0, y: 0 }, magneticField: { x: 0, y: 0 }, magneticFieldZ: 0, potential: 0, current: 0, inducedVoltage: 0, circuitVoltage: 0, loadPower: 0, batteryArrangement: "none" }, currents: [], connections: [], graph: { title: "장치", xLabel: "종류", yLabel: "개수", color: "#5b7cfa" } };
    const probe = this.sandboxObjects.find((object) => object.kind === "probe"); const charges = this.sandboxChargeSources();
    const electricField = probe ? this.electricFieldAt(probe.position, charges) : { x: 0, y: 0 };
    const magneticField = probe ? this.sandboxMagneticFieldAt(probe.position) : { x: 0, y: 0 };
    const magneticFieldZ = probe ? this.sandboxMagneticFieldZAt(probe.position) : 0;
    const potential = probe ? charges.reduce((sum, charge) => sum + pointChargePotential(charge.charge, Math.max(0.03, worldDistance(probe.position, charge.position))), 0) : 0;
    const circuitConnections = this.circuitConnections(); const circuit = this.sandboxCircuitState();
    const inductionConnections = this.inductionConnections(); const connections = [...circuitConnections, ...inductionConnections];
    const movingCharge = this.sandboxObjects.find((object) => object.kind === "charge" && (object.history?.length ?? 0) > 1);
    const graph = movingCharge ? { title: "시간과 움직이는 전하의 속력", xLabel: "시간 (s)", yLabel: "속력 (m/s)", color: "#a069dc" }
      : circuitConnections.length ? { title: "직접 만든 회로의 저항과 전류", xLabel: "저항 (Ω)", yLabel: "전류 (A)", color: "#f2b84b" }
      : inductionConnections.length ? { title: "자석-코일 거리와 자속", xLabel: "거리 (m)", yLabel: "자속연계 (Wb·turn)", color: "#a069dc" }
        : this.sandboxObjects.some((object) => object.kind === "capacitor") ? { title: "판 간격과 전기용량", xLabel: "판 간격 (mm)", yLabel: "전기용량 (nF)", color: "#5b7cfa" }
          : this.sandboxMagneticGraphPoints().length ? { title: "가로 위치의 자기장", xLabel: "가로 위치 (m)", yLabel: "자기장 (상대값)", color: "#2b9bb5" }
            : { title: "가로 위치의 전기장", xLabel: "가로 위치 (m)", yLabel: "전기장 (N/C)", color: "#25a77a" };
    return { metrics: { electricField, magneticField, magneticFieldZ, potential, current: circuit.current, inducedVoltage: this.sandboxInducedVoltage, circuitVoltage: circuit.voltage, loadPower: circuit.loadPower, batteryArrangement: circuit.batteryArrangement }, currents: circuit.currents, connections, graph };
  }
  private sandboxGraphPoints(): GraphPoint[] {
    const state = this.sandboxState();
    const movingCharge = this.sandboxObjects.find((object) => object.kind === "charge" && (object.history?.length ?? 0) > 1);
    if (movingCharge?.history) return movingCharge.history.map((point) => ({ ...point }));
    if (state.connections.some((item) => item.kind === "wire")) {
      const circuit = this.sandboxCircuitState(); const voltage = circuit.voltage || Math.abs(this.sandboxInducedVoltage);
      return points(40, 1, 30, (resistance) => currentFromVoltage(voltage, resistance));
    }
    if (state.connections.some((item) => item.kind === "induction")) {
      const connection = state.connections.find((item) => item.kind === "induction")!;
      const magnet = this.sandboxObjects.find((object) => object.id === connection.from)!; const coil = this.sandboxObjects.find((object) => object.id === connection.to)!;
      return points(40, 0.05, 1.1, (distance) => coil.value * fluxAtDistance(distance));
    }
    if (this.sandboxObjects.some((object) => object.kind === "capacitor")) return points(48, 1, 10, (millimeters) => parallelPlateCapacitance(8.854e-12, 0.02, millimeters / 1000) * 1e9);
    if (this.sandboxMagneticGraphPoints().length) return this.sandboxMagneticGraphPoints();
    const probe = this.sandboxObjects.find((object) => object.kind === "probe"); const y = probe?.position.y ?? 0.5; const charges = this.sandboxChargeSources();
    return points(48, 0.08, 0.92, (x) => { const field = this.electricFieldAt({ x, y }, charges); return Math.hypot(field.x, field.y); }).map((point) => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y }));
  }
  private sandboxGraphMarker(): GraphPoint | null {
    const state = this.sandboxState();
    const movingCharge = this.sandboxObjects.find((object) => object.kind === "charge" && (object.history?.length ?? 0) > 1);
    if (movingCharge?.history?.length) return { ...movingCharge.history[movingCharge.history.length - 1] };
    if (state.connections.some((item) => item.kind === "wire")) {
      const circuit = this.sandboxCircuitState();
      return { x: circuit.resistance, y: state.metrics.current };
    }
    if (state.connections.some((item) => item.kind === "induction")) {
      const connection = state.connections.find((item) => item.kind === "induction")!;
      const magnet = this.sandboxObjects.find((object) => object.id === connection.from)!; const coil = this.sandboxObjects.find((object) => object.id === connection.to)!;
      return { x: worldDistance(magnet.position, coil.position), y: coil.value * fluxAtDistance(worldDistance(magnet.position, coil.position)) };
    }
    const capacitor = this.sandboxObjects.find((object) => object.kind === "capacitor");
    if (capacitor) return { x: capacitor.value, y: parallelPlateCapacitance(8.854e-12, 0.02, capacitor.value / 1000) * 1e9 };
    if (this.sandboxMagneticGraphPoints().length) {
      const graph = this.sandboxMagneticGraphPoints(); const probe = this.sandboxObjects.find((object) => object.kind === "probe");
      const x = normalizedToWorld(probe?.position ?? { x: 0.5, y: 0.5 }).x;
      return graph.reduce((closest, candidate) => Math.abs(candidate.x - x) < Math.abs(closest.x - x) ? candidate : closest);
    }
    const probe = this.sandboxObjects.find((object) => object.kind === "probe");
    return probe ? { x: normalizedToWorld(probe.position).x, y: Math.hypot(state.metrics.electricField.x, state.metrics.electricField.y) } : null;
  }
  private makeSandboxObject(kind: ElectromagnetismSandboxKind, position: Vector2, requestedValue?: number): ElectromagnetismSandboxObject {
    this.sandboxSequence += 1; const sameKind = this.sandboxObjects.filter((object) => object.kind === kind).length;
    const defaultValue = kind === "charge" ? (sameKind % 2 === 0 ? 2e-6 : -2e-6) : kind === "battery" ? 9 : kind === "resistor" ? 10 : kind === "bulb" ? 6 : kind === "capacitor" ? 5 : kind === "current-wire" ? 5 : kind === "coil" || kind === "transformer" ? 80 : kind === "iron-load" ? 2 : kind === "motor" ? 6 : kind === "generator" ? 9 : 1;
    const value = requestedValue === undefined || !Number.isFinite(requestedValue) ? defaultValue : requestedValue;
    return {
      id: `${kind}-${this.sandboxSequence}`, kind, position, value,
      ...(kind === "capacitor" ? { secondaryValue: 0 } : {}), ...(kind === "switch" || kind === "generator" ? { enabled: kind === "switch" } : {}),
      ...(kind === "magnet" || kind === "battery" || kind === "generator" ? { direction: 1 as const } : {}),
      ...(kind === "charge" ? { velocity: { x: 0.18, y: 0 }, moving: false, trail: [{ ...position }], history: [{ x: 0, y: 0.18 }] } : {}),
      ...(kind === "iron-load" ? { velocity: { x: 0, y: 0 } } : {}),
    };
  }

  private availableTerminal(object: ElectromagnetismSandboxObject, toward: ElectromagnetismSandboxObject): SandboxTerminal {
    const preferred: SandboxTerminal = toward.position.x < object.position.x ? "a" : "b";
    const other: SandboxTerminal = preferred === "a" ? "b" : "a";
    const count = (terminal: SandboxTerminal): number => this.sandboxWires.filter((wire) =>
      (wire.from === object.id && wire.fromTerminal === terminal) || (wire.to === object.id && wire.toTerminal === terminal)).length;
    if (count(preferred) === 0) return preferred;
    if (count(other) === 0) return other;
    return preferred;
  }

  private batteryArrangement(batteries: readonly { a: string; b: string }[]): SandboxBatteryArrangement {
    if (batteries.length === 0) return "none";
    if (batteries.length === 1) return "single";
    const pairKey = ({ a, b }: { a: string; b: string }): string => [a, b].sort().join("|");
    if (batteries.every((battery) => pairKey(battery) === pairKey(batteries[0]))) return "parallel";
    const adjacency = new Map<string, Set<string>>();
    for (const battery of batteries) {
      if (!adjacency.has(battery.a)) adjacency.set(battery.a, new Set());
      if (!adjacency.has(battery.b)) adjacency.set(battery.b, new Set());
      adjacency.get(battery.a)!.add(battery.b); adjacency.get(battery.b)!.add(battery.a);
    }
    const pending = [batteries[0].a]; const visited = new Set<string>();
    while (pending.length) {
      const node = pending.pop()!; if (visited.has(node)) continue; visited.add(node);
      for (const neighbor of adjacency.get(node) ?? []) pending.push(neighbor);
    }
    const isPath = visited.size === batteries.length + 1 && [...adjacency.values()].every((neighbors) => neighbors.size <= 2);
    return isPath ? "series" : "mixed";
  }

  private solveLinearSystem(matrix: number[][], rightHand: number[]): number[] | null {
    const size = rightHand.length; const augmented = matrix.map((row, index) => [...row, rightHand[index]]);
    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
      if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
      const divisor = augmented[column][column];
      for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor;
      for (let row = 0; row < size; row += 1) {
        if (row === column) continue; const factor = augmented[row][column];
        if (Math.abs(factor) < 1e-12) continue;
        for (let index = column; index <= size; index += 1) augmented[row][index] -= factor * augmented[column][index];
      }
    }
    return augmented.map((row) => row[size]);
  }
}
