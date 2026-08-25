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

export const ELECTROMAGNETISM_WORLD = { width: 2.4, height: 1.5 } as const;
export const CIRCUIT_TRACK = { minX: 0.27, maxX: 0.73 } as const;
export const CAPACITOR_PLATES = { leftX: 0.36, minRightX: 0.46, maxRightX: 0.78 } as const;
export const INDUCTION_COIL = { x: 0.62, y: 0.5 } as const;

export interface ElectromagnetismSandboxObject {
  readonly id: string;
  readonly kind: ElectromagnetismSandboxKind;
  position: Vector2;
  value: number;
}
export interface GraphPoint { readonly x: number; readonly y: number }
export interface FieldSample { readonly point: Vector2; readonly vector: Vector2 }
export interface SandboxConnection { readonly from: string; readonly to: string; readonly kind: "circuit" | "induction" }
export interface SandboxMetrics {
  readonly electricField: Vector2;
  readonly potential: number;
  readonly current: number;
  readonly inducedVoltage: number;
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
  readonly particle: Vector2;
  readonly particleVelocity: Vector2;
  readonly trail: readonly Vector2[];
  readonly measurement: { readonly label: string; readonly value: number; readonly unit: string };
  readonly secondaryMeasurement: { readonly label: string; readonly value: number; readonly unit: string } | null;
  readonly graph: readonly GraphPoint[];
  readonly graphMarker: GraphPoint | null;
  readonly fieldSamples: readonly FieldSample[];
  readonly probeField: Vector2;
  readonly capacitorField: number;
  readonly lorentzForce: Vector2;
  readonly sandboxObjects: readonly ElectromagnetismSandboxObject[];
  readonly sandboxConnections: readonly SandboxConnection[];
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
export const circuitResistanceAtX = (x: number): number =>
  2 + clamp((x - CIRCUIT_TRACK.minX) / (CIRCUIT_TRACK.maxX - CIRCUIT_TRACK.minX)) * 18;
export const capacitorSeparationMmAtX = (x: number): number =>
  1 + clamp((x - CAPACITOR_PLATES.minRightX) / (CAPACITOR_PLATES.maxRightX - CAPACITOR_PLATES.minRightX)) * 9;

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
  private particle: Vector2 = { x: 0.25, y: 0.52 };
  private particleVelocity: Vector2 = { x: 0.24, y: -0.02 };
  private trail: Vector2[] = [];
  private sandboxSequence = 0;
  private sandboxObjects: ElectromagnetismSandboxObject[] = [];
  private sandboxInducedVoltage = 0;

  constructor(initialMode: ElectromagnetismMode = "charge") { this.mode = initialMode; this.reset(); }
  activate(mode: ElectromagnetismMode): void { this.mode = mode; this.reset(); }

  reset(): void {
    this.running = false; this.time = 0;
    this.probe = this.mode === "induction" ? { x: 0.22, y: 0.5 }
      : this.mode === "circuits" ? { x: 0.5, y: 0.3 }
        : this.mode === "capacitors" ? { x: 0.62, y: 0.78 }
          : { x: 0.7, y: 0.5 };
    this.level = 1; this.sign = 1; this.direction = 1; this.coilTurns = 80;
    this.magnetSpeed = 0; this.inducedVoltage = 0;
    this.particle = { x: 0.25, y: 0.52 }; this.particleVelocity = { x: 0.24, y: -0.02 };
    this.trail = [{ ...this.particle }]; this.sandboxSequence = 0; this.sandboxInducedVoltage = 0;
    this.sandboxObjects = [];
    this.sandboxObjects = this.mode === "sandbox"
      ? [this.makeSandboxObject("charge", { x: 0.38, y: 0.48 }), this.makeSandboxObject("probe", { x: 0.66, y: 0.48 })]
      : [];
  }

  toggle(): void { this.running = !this.running; }
  setRunning(value: boolean): void { this.running = value; }
  setLevel(value: number): void { this.level = clamp(value, 0.5, 1.5); }
  toggleSign(): void { this.sign = this.sign === 1 ? -1 : 1; }
  toggleDirection(): void { this.direction = this.direction === 1 ? -1 : 1; }
  setCoilTurns(value: number): void { this.coilTurns = Math.max(20, Math.min(160, Math.round(value))); }

  drag(normalizedPoint: Vector2, dt = 0): void {
    const point = { x: clamp(normalizedPoint.x, 0.08, 0.92), y: clamp(normalizedPoint.y, 0.12, 0.88) };
    if (this.mode === "circuits") { this.probe = { x: clamp(point.x, CIRCUIT_TRACK.minX, CIRCUIT_TRACK.maxX), y: 0.3 }; return; }
    if (this.mode === "capacitors") { this.probe = { x: clamp(point.x, CAPACITOR_PLATES.minRightX, CAPACITOR_PLATES.maxRightX), y: 0.78 }; return; }
    if (this.mode === "electromagnetic-force") {
      const target = normalizedToWorld(point); const origin = normalizedToWorld(this.particle);
      const dx = target.x - origin.x; const dy = target.y - origin.y;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      this.particleVelocity = { x: dx / length * 0.26, y: dy / length * 0.26 };
      this.trail = [{ ...this.particle }]; return;
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
    if (this.mode === "electromagnetic-force") {
      const force = this.lorentzForceVector();
      this.particleVelocity = { x: this.particleVelocity.x + force.x * dt * 0.24, y: this.particleVelocity.y + force.y * dt * 0.24 };
      const worldPosition = normalizedToWorld(this.particle);
      this.particle = worldToNormalized({ x: worldPosition.x + this.particleVelocity.x * dt, y: worldPosition.y + this.particleVelocity.y * dt });
      this.trail.push({ ...this.particle }); if (this.trail.length > 180) this.trail.shift();
      if (this.particle.x < 0.05 || this.particle.x > 0.95 || this.particle.y < 0.08 || this.particle.y > 0.92) this.running = false;
    } else if (this.mode === "induction") {
      const damping = Math.exp(-dt * 8); this.magnetSpeed *= damping; this.inducedVoltage *= damping;
      if (Math.abs(this.magnetSpeed) < 0.001) { this.magnetSpeed = 0; this.inducedVoltage = 0; this.running = false; }
    } else if (this.mode === "sandbox") {
      this.sandboxInducedVoltage *= Math.exp(-dt * 8);
      if (Math.abs(this.sandboxInducedVoltage) < 0.001) this.sandboxInducedVoltage = 0;
    }
  }

  addSandboxObject(kind: ElectromagnetismSandboxKind): ElectromagnetismSandboxObject {
    if (this.mode !== "sandbox") throw new Error("Sandbox objects require sandbox mode.");
    const column = this.sandboxObjects.length % 4; const row = Math.floor(this.sandboxObjects.length / 4) % 3;
    const object = this.makeSandboxObject(kind, { x: 0.28 + column * 0.15, y: 0.34 + row * 0.18 });
    this.sandboxObjects.push(object); return object;
  }

  moveSandboxObject(id: string, position: Vector2, dt = 0): boolean {
    if (this.mode !== "sandbox") return false;
    const object = this.sandboxObjects.find((candidate) => candidate.id === id); if (!object) return false;
    const oldLinkage = this.sandboxFluxLinkage();
    object.position = { x: clamp(position.x, 0.05, 0.95), y: clamp(position.y, 0.08, 0.92) };
    if ((object.kind === "magnet" || object.kind === "coil") && dt > 0 && Number.isFinite(dt)) this.sandboxInducedVoltage = inducedEmf(1, this.sandboxFluxLinkage() - oldLinkage, dt);
    return true;
  }
  removeSandboxObject(id: string): boolean {
    if (this.mode !== "sandbox") return false;
    const index = this.sandboxObjects.findIndex((candidate) => candidate.id === id); if (index < 0) return false;
    this.sandboxObjects.splice(index, 1); this.sandboxInducedVoltage = 0; return true;
  }
  hitSandboxObject(point: Vector2, radius = 0.055): ElectromagnetismSandboxObject | null {
    return [...this.sandboxObjects].reverse().find((object) => Math.hypot(point.x - object.position.x, point.y - object.position.y) <= radius) ?? null;
  }

  snapshot(): ElectromagnetismSnapshot {
    const result = this.measurement(); const sandbox = this.sandboxState();
    return {
      mode: this.mode, running: this.running, time: this.time, probe: { ...this.probe }, level: this.level,
      sign: this.sign, direction: this.direction, coilTurns: this.coilTurns, magnetSpeed: this.magnetSpeed,
      particle: { ...this.particle }, particleVelocity: { ...this.particleVelocity }, trail: this.trail.map((point) => ({ ...point })),
      measurement: result.primary, secondaryMeasurement: result.secondary, graph: this.graph(), graphMarker: this.graphMarker(result.primary.value),
      fieldSamples: this.fieldSamples(), probeField: this.guidedProbeField(), capacitorField: this.capacitorField(), lorentzForce: this.lorentzForceVector(),
      sandboxObjects: this.sandboxObjects.map((object) => ({ ...object, position: { ...object.position } })),
      sandboxConnections: sandbox.connections, sandboxMetrics: sandbox.metrics, sandboxGraph: sandbox.graph,
    };
  }

  private measurement(): { primary: ElectromagnetismSnapshot["measurement"]; secondary: ElectromagnetismSnapshot["secondaryMeasurement"] } {
    if (this.mode === "sandbox") {
      const sandbox = this.sandboxState();
      if (Math.abs(sandbox.metrics.current) > 0) return { primary: { label: "연결 회로 전류", value: sandbox.metrics.current, unit: "A" }, secondary: { label: "유도 전압", value: sandbox.metrics.inducedVoltage, unit: "V" } };
      if (Math.abs(sandbox.metrics.inducedVoltage) > 0 || sandbox.connections.some((item) => item.kind === "induction")) return { primary: { label: "유도 전압", value: sandbox.metrics.inducedVoltage, unit: "V" }, secondary: null };
      return { primary: { label: "탐침 전기장", value: Math.hypot(sandbox.metrics.electricField.x, sandbox.metrics.electricField.y), unit: "N/C" }, secondary: { label: "탐침 전위", value: sandbox.metrics.potential, unit: "V" } };
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
      const voltage = 3 + this.level * 6; const resistance = circuitResistanceAtX(this.probe.x); const current = currentFromVoltage(voltage, resistance);
      return { primary: { label: "회로 전류", value: current, unit: "A" }, secondary: { label: "전구 전력", value: electricalPower(voltage, current), unit: "W" } };
    }
    if (this.mode === "capacitors") {
      const separation = capacitorSeparationMmAtX(this.probe.x) / 1000; const capacitance = parallelPlateCapacitance(8.854e-12, 0.02, separation); const voltage = 3 + this.level * 6;
      return { primary: { label: "전기용량", value: capacitance * 1e9, unit: "nF" }, secondary: { label: "저장 에너지", value: capacitorEnergy(capacitance, voltage) * 1e9, unit: "nJ" } };
    }
    if (this.mode === "magnetic-field") {
      const distance = this.distanceFrom({ x: 0.44, y: 0.5 }); const field = Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, distance));
      return { primary: { label: "자기장 세기", value: field * 1e6, unit: "μT" }, secondary: { label: "전류", value: this.direction * this.level * 5, unit: "A" } };
    }
    if (this.mode === "electromagnetic-force") {
      const angle = Math.atan2(this.particleVelocity.y, this.particleVelocity.x);
      return { primary: { label: "자기력", value: Math.hypot(this.lorentzForceVector().x, this.lorentzForceVector().y), unit: "상대값" }, secondary: { label: "속도 방향", value: angle * 180 / Math.PI, unit: "°" } };
    }
    return { primary: { label: "유도 전압", value: this.inducedVoltage, unit: "V" }, secondary: { label: "자석 속도", value: this.magnetSpeed, unit: "m/s" } };
  }

  private graph(): GraphPoint[] {
    if (this.mode === "sandbox") return this.sandboxGraphPoints();
    if (this.mode === "charge") return points(48, 0.25, 2.4, (distance) => coulombForceMagnitude(2e-6, this.level * 2e-6, distance));
    if (this.mode === "electric-field") return points(48, 0.08, 0.92, (x) => { const field = this.electricFieldAt({ x, y: this.probe.y }, this.guidedCharges()); return Math.hypot(field.x, field.y); }).map((point) => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y }));
    if (this.mode === "potential") return points(48, 0.25, 2.4, (distance) => pointChargePotential(2e-6, distance));
    if (this.mode === "circuits") { const voltage = 3 + this.level * 6; return points(48, 2, 20, (resistance) => currentFromVoltage(voltage, resistance)); }
    if (this.mode === "capacitors") return points(48, 1, 10, (millimeters) => parallelPlateCapacitance(8.854e-12, 0.02, millimeters / 1000) * 1e9);
    if (this.mode === "magnetic-field") return points(48, 1, 80, (centimeters) => Math.abs(magneticFieldAroundWire(this.direction * this.level * 5, centimeters / 100)) * 1e6);
    if (this.mode === "electromagnetic-force") {
      const force = magneticForceMagnitude(this.sign, Math.hypot(this.particleVelocity.x, this.particleVelocity.y), 2.2, Math.PI / 2);
      return points(48, -180, 180, () => force);
    }
    return points(48, -2.4, 2.4, (speed) => this.inducedVoltageForSpeed(speed, this.probe));
  }

  private graphMarker(value: number): GraphPoint | null {
    if (this.mode === "sandbox") return this.sandboxGraphMarker();
    if (this.mode === "charge" || this.mode === "potential") return { x: this.distanceFrom({ x: this.mode === "charge" ? 0.32 : 0.35, y: 0.5 }), y: value };
    if (this.mode === "electric-field") return { x: normalizedToWorld(this.probe).x, y: value };
    if (this.mode === "circuits") return { x: circuitResistanceAtX(this.probe.x), y: value };
    if (this.mode === "capacitors") return { x: capacitorSeparationMmAtX(this.probe.x), y: value };
    if (this.mode === "magnetic-field") return { x: this.distanceFrom({ x: 0.44, y: 0.5 }) * 100, y: value };
    if (this.mode === "electromagnetic-force") return { x: Math.atan2(this.particleVelocity.y, this.particleVelocity.x) * 180 / Math.PI, y: value };
    return { x: this.magnetSpeed, y: value };
  }

  private guidedCharges(): readonly { position: Vector2; charge: number }[] {
    return [{ position: { x: 0.35, y: 0.42 }, charge: this.sign * this.level * 2e-6 }, { position: { x: 0.35, y: 0.66 }, charge: -this.sign * this.level * 2e-6 }];
  }
  private electricFieldAt(point: Vector2, charges: readonly { position: Vector2; charge: number }[]): Vector2 {
    const target = normalizedToWorld(point); let x = 0; let y = 0;
    for (const source of charges) {
      const sourceWorld = normalizedToWorld(source.position);
      if (Math.hypot(target.x - sourceWorld.x, target.y - sourceWorld.y) < 0.03) continue;
      const field = pointChargeElectricFieldVector(source.charge, sourceWorld, target); x += field.x; y += field.y;
    }
    return { x, y };
  }
  private guidedProbeField(): Vector2 { return this.mode === "electric-field" ? this.electricFieldAt(this.probe, this.guidedCharges()) : { x: 0, y: 0 }; }
  private fieldSamples(): FieldSample[] {
    if (this.mode !== "electric-field" && this.mode !== "sandbox") return [];
    const charges = this.mode === "electric-field" ? this.guidedCharges() : this.sandboxChargeSources();
    const columns = 12; const rows = 8;
    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns; const row = Math.floor(index / columns);
      const point = { x: 0.1 + column * 0.8 / (columns - 1), y: 0.12 + row * 0.76 / (rows - 1) };
      return { point, vector: this.electricFieldAt(point, charges) };
    });
  }
  private capacitorField(): number {
    if (this.mode !== "capacitors") return 0;
    return (3 + this.level * 6) / (capacitorSeparationMmAtX(this.probe.x) / 1000);
  }
  private lorentzForceVector(): Vector2 {
    if (this.mode !== "electromagnetic-force") return { x: 0, y: 0 };
    return lorentzForce2D(this.sign, { x: 0, y: 0 }, this.particleVelocity, this.direction * 2.2);
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

  private sandboxChargeSources(): { position: Vector2; charge: number }[] {
    return this.sandboxObjects.filter((object) => object.kind === "charge").map((object) => ({ position: object.position, charge: object.value }));
  }
  private sandboxFluxLinkage(): number {
    const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet"); const coils = this.sandboxObjects.filter((object) => object.kind === "coil");
    return coils.reduce((sum, coil) => sum + magnets.reduce((magnetSum, magnet) => magnetSum + coil.value * fluxAtDistance(worldDistance(coil.position, magnet.position)), 0), 0);
  }
  private circuitConnections(): SandboxConnection[] {
    const batteries = this.sandboxObjects.filter((object) => object.kind === "battery"); const resistors = this.sandboxObjects.filter((object) => object.kind === "resistor");
    return batteries.flatMap((battery) => resistors.filter((resistor) => worldDistance(battery.position, resistor.position) <= 0.75).map((resistor) => ({ from: battery.id, to: resistor.id, kind: "circuit" as const })));
  }
  private inductionConnections(): SandboxConnection[] {
    const magnets = this.sandboxObjects.filter((object) => object.kind === "magnet"); const coils = this.sandboxObjects.filter((object) => object.kind === "coil");
    return magnets.flatMap((magnet) => coils.map((coil) => ({ from: magnet.id, to: coil.id, kind: "induction" as const })));
  }
  private sandboxState(): { metrics: SandboxMetrics; connections: SandboxConnection[]; graph: ElectromagnetismSnapshot["sandboxGraph"] } {
    if (this.mode !== "sandbox") return { metrics: { electricField: { x: 0, y: 0 }, potential: 0, current: 0, inducedVoltage: 0 }, connections: [], graph: { title: "장치", xLabel: "종류", yLabel: "개수", color: "#5b7cfa" } };
    const probe = this.sandboxObjects.find((object) => object.kind === "probe"); const charges = this.sandboxChargeSources();
    const electricField = probe ? this.electricFieldAt(probe.position, charges) : { x: 0, y: 0 };
    const potential = probe ? charges.reduce((sum, charge) => sum + pointChargePotential(charge.charge, Math.max(0.03, worldDistance(probe.position, charge.position))), 0) : 0;
    const circuitConnections = this.circuitConnections(); const connectedIds = new Set(circuitConnections.flatMap((item) => [item.from, item.to]));
    const voltage = this.sandboxObjects.filter((object) => object.kind === "battery" && connectedIds.has(object.id)).reduce((sum, object) => sum + object.value, 0);
    const resistance = this.sandboxObjects.filter((object) => object.kind === "resistor" && connectedIds.has(object.id)).reduce((sum, object) => sum + object.value, 0);
    const current = resistance > 0 ? currentFromVoltage(voltage, resistance) : 0;
    const inductionConnections = this.inductionConnections(); const connections = [...circuitConnections, ...inductionConnections];
    const graph = circuitConnections.length ? { title: "연결 회로의 저항과 전류", xLabel: "저항 (Ω)", yLabel: "전류 (A)", color: "#f2b84b" }
      : inductionConnections.length ? { title: "자석-코일 거리와 자속", xLabel: "거리 (m)", yLabel: "자속연계 (Wb·turn)", color: "#a069dc" }
        : { title: "탐침 위치의 전기장", xLabel: "가로 위치 (m)", yLabel: "전기장 (N/C)", color: "#25a77a" };
    return { metrics: { electricField, potential, current, inducedVoltage: this.sandboxInducedVoltage }, connections, graph };
  }
  private sandboxGraphPoints(): GraphPoint[] {
    const state = this.sandboxState();
    if (state.connections.some((item) => item.kind === "circuit")) {
      const connectedIds = new Set(state.connections.filter((item) => item.kind === "circuit").flatMap((item) => [item.from, item.to]));
      const voltage = this.sandboxObjects.filter((object) => object.kind === "battery" && connectedIds.has(object.id)).reduce((sum, object) => sum + object.value, 0);
      return points(40, 1, 30, (resistance) => currentFromVoltage(voltage, resistance));
    }
    if (state.connections.some((item) => item.kind === "induction")) {
      const connection = state.connections.find((item) => item.kind === "induction")!;
      const magnet = this.sandboxObjects.find((object) => object.id === connection.from)!; const coil = this.sandboxObjects.find((object) => object.id === connection.to)!;
      return points(40, 0.05, 1.1, (distance) => coil.value * fluxAtDistance(distance));
    }
    const probe = this.sandboxObjects.find((object) => object.kind === "probe"); const y = probe?.position.y ?? 0.5; const charges = this.sandboxChargeSources();
    return points(48, 0.08, 0.92, (x) => { const field = this.electricFieldAt({ x, y }, charges); return Math.hypot(field.x, field.y); }).map((point) => ({ x: point.x * ELECTROMAGNETISM_WORLD.width, y: point.y }));
  }
  private sandboxGraphMarker(): GraphPoint | null {
    const state = this.sandboxState();
    if (state.connections.some((item) => item.kind === "circuit")) {
      const connectedIds = new Set(state.connections.filter((item) => item.kind === "circuit").flatMap((item) => [item.from, item.to]));
      const resistance = this.sandboxObjects.filter((object) => object.kind === "resistor" && connectedIds.has(object.id)).reduce((sum, object) => sum + object.value, 0);
      return { x: resistance, y: state.metrics.current };
    }
    if (state.connections.some((item) => item.kind === "induction")) {
      const connection = state.connections.find((item) => item.kind === "induction")!;
      const magnet = this.sandboxObjects.find((object) => object.id === connection.from)!; const coil = this.sandboxObjects.find((object) => object.id === connection.to)!;
      return { x: worldDistance(magnet.position, coil.position), y: coil.value * fluxAtDistance(worldDistance(magnet.position, coil.position)) };
    }
    const probe = this.sandboxObjects.find((object) => object.kind === "probe");
    return probe ? { x: normalizedToWorld(probe.position).x, y: Math.hypot(state.metrics.electricField.x, state.metrics.electricField.y) } : null;
  }
  private makeSandboxObject(kind: ElectromagnetismSandboxKind, position: Vector2): ElectromagnetismSandboxObject {
    this.sandboxSequence += 1; const sameKind = this.sandboxObjects.filter((object) => object.kind === kind).length;
    const value = kind === "charge" ? (sameKind % 2 === 0 ? 2e-6 : -2e-6) : kind === "battery" ? 9 : kind === "resistor" ? 10 : kind === "coil" ? 80 : 1;
    return { id: `${kind}-${this.sandboxSequence}`, kind, position, value };
  }
}
