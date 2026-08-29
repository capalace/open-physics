import {
  deBroglieWavelength,
  energyTransition,
  gaussianProbabilityDensity,
  hydrogenBohrEnergyLevel,
  idealDiodeCurrent,
  infiniteWellProbabilityDensity,
  lorentzFactor,
  photoelectronMaximumKineticEnergy,
  photonEnergy,
  rectangularBarrierTransmission,
  remainingParticles,
} from "../../../physics/laws/modern";
import type { ModernLabId } from "./catalog";

export const MODERN_WORLD = { width: 1000, height: 600 } as const;
export type ModernDeviceKind = "photon-source" | "metal" | "atom" | "barrier" | "detector" | "nucleus";

export interface ModernDevice {
  readonly id: string;
  readonly kind: ModernDeviceKind;
  readonly x: number;
  readonly y: number;
  readonly protected: boolean;
}
export interface ModernGraphPoint { readonly x: number; readonly y: number; readonly current?: boolean }
export interface DetectionEvent { readonly x: number; readonly y: number; readonly strength: number }
export interface ModernControlPoint { readonly x: number; readonly y: number }

export interface ModernSnapshot {
  readonly mode: ModernLabId | "sandbox";
  readonly running: boolean;
  readonly animationTime: number;
  readonly speedFraction: number;
  readonly gamma: number;
  readonly quantumNumber: number;
  readonly transitionEnergy: number;
  readonly photonFrequency: number;
  readonly electronEnergy: number;
  readonly momentum: number;
  readonly wavelengthNm: number;
  readonly spread: number;
  readonly barrierWidth: number;
  readonly transmission: number;
  readonly elapsedYears: number;
  readonly remainingNuclei: number;
  readonly voltage: number;
  readonly currentMilliamp: number;
  readonly measurement: string;
  readonly devices: readonly ModernDevice[];
  readonly graph: readonly ModernGraphPoint[];
  readonly detections: readonly DetectionEvent[];
}

interface MutableDevice { id: string; kind: ModernDeviceKind; x: number; y: number; protected: boolean }
interface SandboxReading { readonly detector: MutableDevice; readonly signal: number }
interface ModernState {
  mode: ModernLabId | "sandbox"; running: boolean; animationTime: number;
  speedFraction: number; quantumNumber: number; photonFrequency: number; momentum: number;
  spread: number; barrierWidth: number; elapsedYears: number; voltage: number;
  devices: MutableDevice[]; nextDeviceId: number;
}

const H_EV_PER_PHZ = 4.135667696;
const H_SI = 6.62607015e-34;
const LIGHT_SPEED = 1;
const INITIAL_NUCLEI = 100;
const HALF_LIFE_YEARS = 10;
const WORK_FUNCTION_EV = 2.3;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const ratioBetween = (value: number, minimum: number, maximum: number): number =>
  clamp((value - minimum) / (maximum - minimum), 0, 1);
const valueAtRatio = (ratio: number, minimum: number, maximum: number): number =>
  minimum + clamp(ratio, 0, 1) * (maximum - minimum);
const series = (count: number, xAt: (r: number) => number, yAt: (r: number) => number): ModernGraphPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return { x: xAt(ratio), y: yAt(ratio) };
  });
const device = (id: string, kind: ModernDeviceKind, x: number, y: number, protectedDevice = true): MutableDevice =>
  ({ id, kind, x, y, protected: protectedDevice });

const distance = (first: ModernDevice, second: ModernDevice): number => Math.hypot(first.x - second.x, first.y - second.y);
const distanceToSegment = (point: ModernDevice, start: ModernDevice, end: ModernDevice): number => {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
};

const hydrogenLevelY = (quantumNumber: number): number => {
  const energy = hydrogenBohrEnergyLevel(quantumNumber, -13.6);
  return 430 - (energy + 13.6) / 13.6 * 300;
};

export function deterministicDensityQuantiles(points: readonly ModernGraphPoint[], count: number): number[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError("Sample count must be a non-negative integer.");
  if (count === 0 || points.length === 0) return [];
  const weights = points.map((point) => Math.max(0, point.y));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return Array.from({ length: count }, (_, index) => points[Math.min(points.length - 1, Math.floor((index + 0.5) / count * points.length))].x);
  return Array.from({ length: count }, (_, index) => {
    const target = total * (index + 0.5) / count;
    let cumulative = 0;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      cumulative += weights[pointIndex];
      if (cumulative >= target) return points[pointIndex].x;
    }
    return points.at(-1)!.x;
  });
}

function initialState(mode: ModernLabId | "sandbox"): ModernState {
  const common = {
    mode, running: mode !== "sandbox", animationTime: 0, speedFraction: 0.6, quantumNumber: 3,
    photonFrequency: 0.75, momentum: 1.4, spread: 0.9, barrierWidth: 0.22,
    elapsedYears: 8, voltage: 0.55, nextDeviceId: 1,
  };
  switch (mode) {
    case "relativity": return { ...common, devices: [device("earth-clock", "detector", 210, 270), device("ship-clock", "detector", valueAtRatio(0.6 / 0.95, 420, 900), 270)] };
    case "atoms": return { ...common, devices: [device("hydrogen", "atom", 500, 300), device("spectrum", "detector", 850, 300)] };
    case "photoelectric": return { ...common, devices: [device("lamp", "photon-source", valueAtRatio(0.55, 100, 400), 300), device("metal", "metal", 520, 300), device("electron-detector", "detector", 850, 300)] };
    case "matter-waves": return { ...common, devices: [device("particle-source", "photon-source", valueAtRatio((1.4 - 0.5) / 4.5, 100, 400), 300), device("wave-detector", "detector", 870, 300)] };
    case "quantum": return { ...common, devices: [device("preparation", "atom", 220, 300), device("position-detector", "detector", 820, 300)] };
    case "tunneling": return { ...common, devices: [device("particle-source", "photon-source", 130, 300), device("barrier", "barrier", 520, 300), device("tunnel-detector", "detector", 850, 300)] };
    case "nuclei": return { ...common, devices: [device("sample", "nucleus", 430, 300), device("decay-counter", "detector", valueAtRatio(8 / 40, 600, 900), 300)] };
    case "semiconductors": return { ...common, devices: [device("junction", "metal", 500, 300), device("current-meter", "detector", 850, 300)] };
    case "sandbox": return { ...common, running: false, devices: [device("sandbox-detector", "detector", 820, 300, false)] };
  }
}

export function modernPrimaryHandle(snapshot: ModernSnapshot): ModernControlPoint | null {
  switch (snapshot.mode) {
    case "relativity": return snapshot.devices.find((item) => item.id === "ship-clock") ?? null;
    case "atoms": return { x: 200, y: hydrogenLevelY(snapshot.quantumNumber) };
    case "photoelectric": return snapshot.devices.find((item) => item.kind === "photon-source") ?? null;
    case "matter-waves": return snapshot.devices.find((item) => item.kind === "photon-source") ?? null;
    case "quantum": return { x: 500 + snapshot.spread * 140, y: 300 };
    case "tunneling": return { x: 550 + snapshot.barrierWidth * 240, y: 300 };
    case "nuclei": return snapshot.devices.find((item) => item.kind === "detector") ?? null;
    case "semiconductors": return { x: valueAtRatio((snapshot.voltage + 0.1) / 0.8, 300, 700), y: 450 };
    case "sandbox": return null;
  }
}

export class ModernModel {
  private state: ModernState;
  constructor(mode: ModernLabId | "sandbox" = "relativity") { this.state = initialState(mode); }

  activate(mode: ModernLabId | "sandbox"): void { this.state = initialState(mode); }
  reset(): void { this.state = initialState(this.state.mode); }
  setRunning(running: boolean): void { this.state.running = running; }
  toggleRunning(): void { this.state.running = !this.state.running; }
  step(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Step duration must be finite and non-negative.");
    if (this.state.running) {
      const elapsed = Math.min(seconds, 0.1);
      this.state.animationTime += elapsed;
      if (this.state.mode === "sandbox") this.state.elapsedYears = Math.min(40, this.state.elapsedYears + elapsed);
    }
  }

  dragPrimary(x: number, y: number): void {
    switch (this.state.mode) {
      case "relativity": {
        const shipX = clamp(x, 420, 900);
        this.state.speedFraction = ratioBetween(shipX, 420, 900) * 0.95;
        const ship = this.state.devices.find((item) => item.id === "ship-clock"); if (ship) ship.x = shipX;
        break;
      }
      case "atoms": this.state.quantumNumber = [2, 3, 4, 5, 6].reduce((closest, n) => Math.abs(hydrogenLevelY(n) - y) < Math.abs(hydrogenLevelY(closest) - y) ? n : closest, 2); break;
      case "photoelectric": {
        const lampX = clamp(x, 100, 400); this.state.photonFrequency = 0.2 + ratioBetween(lampX, 100, 400);
        const lamp = this.state.devices.find((item) => item.kind === "photon-source"); if (lamp) lamp.x = lampX;
        break;
      }
      case "matter-waves": {
        const sourceX = clamp(x, 100, 400); this.state.momentum = 0.5 + ratioBetween(sourceX, 100, 400) * 4.5;
        const source = this.state.devices.find((item) => item.kind === "photon-source"); if (source) source.x = sourceX;
        break;
      }
      case "quantum": this.state.spread = clamp((x - 500) / 140, 0.3, 2); break;
      case "tunneling": this.state.barrierWidth = clamp((x - 550) / 240, 0.05, 0.6); break;
      case "nuclei": {
        const detectorX = clamp(x, 600, 900); this.state.elapsedYears = ratioBetween(detectorX, 600, 900) * 40;
        const detector = this.state.devices.find((item) => item.kind === "detector"); if (detector) detector.x = detectorX;
        break;
      }
      case "semiconductors": this.state.voltage = -0.1 + ratioBetween(x, 300, 700) * 0.8; break;
      case "sandbox": break;
    }
    if (this.state.mode !== "sandbox") this.state.running = true;
  }

  primaryHandle(): ModernControlPoint | null {
    return modernPrimaryHandle(this.snapshot());
  }

  addDevice(kind: ModernDeviceKind): string {
    if (this.state.mode !== "sandbox") throw new Error("Devices can only be added in the empty modern-physics laboratory.");
    const id = `${kind}-${this.state.nextDeviceId++}`;
    const count = this.state.devices.length;
    this.state.devices.push(device(id, kind, 180 + (count % 5) * 145, 190 + (count % 3) * 105, false));
    return id;
  }
  moveDevice(id: string, x: number, y: number): boolean {
    if (this.state.mode !== "sandbox") return false;
    const found = this.state.devices.find((item) => item.id === id);
    if (!found) return false;
    found.x = clamp(x, 45, 955); found.y = clamp(y, 60, 540); return true;
  }
  removeDevice(id: string): boolean {
    const index = this.state.devices.findIndex((item) => item.id === id);
    if (index < 0 || this.state.devices[index].protected) return false;
    this.state.devices.splice(index, 1); return true;
  }

  snapshot(): ModernSnapshot {
    const s = this.state;
    const gamma = lorentzFactor(s.speedFraction, LIGHT_SPEED);
    const initialLevel = hydrogenBohrEnergyLevel(s.quantumNumber, -13.6);
    const transitionEnergy = energyTransition(initialLevel, hydrogenBohrEnergyLevel(1, -13.6));
    const electronEnergy = Math.max(0, photoelectronMaximumKineticEnergy(H_EV_PER_PHZ, s.photonFrequency, WORK_FUNCTION_EV));
    const wavelengthNm = deBroglieWavelength(H_SI, s.momentum * 1e-24) * 1e9;
    const transmission = rectangularBarrierTransmission(4, 5, s.barrierWidth);
    const remainingNuclei = remainingParticles(INITIAL_NUCLEI, s.elapsedYears, HALF_LIFE_YEARS);
    const currentMilliamp = idealDiodeCurrent(1e-12, s.voltage, 0.026) * 1000;
    const values = { gamma, transitionEnergy, electronEnergy, wavelengthNm, transmission, remainingNuclei, currentMilliamp };
    return {
      mode: s.mode, running: s.running, animationTime: s.animationTime, speedFraction: s.speedFraction,
      gamma, quantumNumber: s.quantumNumber, transitionEnergy, photonFrequency: s.photonFrequency,
      electronEnergy, momentum: s.momentum, wavelengthNm, spread: s.spread,
      barrierWidth: s.barrierWidth, transmission, elapsedYears: s.elapsedYears,
      remainingNuclei, voltage: s.voltage, currentMilliamp,
      measurement: this.measurement(values), devices: s.devices.map((item) => ({ ...item })),
      graph: this.graphPoints(), detections: this.detectionEvents(values),
    };
  }

  private measurement(v: { gamma: number; transitionEnergy: number; electronEnergy: number; wavelengthNm: number; transmission: number; remainingNuclei: number; currentMilliamp: number }): string {
    const s = this.state;
    switch (s.mode) {
      case "relativity": return `속도 ${s.speedFraction.toFixed(2)} c · γ ${v.gamma.toFixed(2)}`;
      case "atoms": return `n=${s.quantumNumber} → n=1 · 광자 ${v.transitionEnergy.toFixed(2)} eV`;
      case "photoelectric": return `빛 ${s.photonFrequency.toFixed(2)} PHz · 전자 ${v.electronEnergy.toFixed(2)} eV`;
      case "matter-waves": return `운동량 ${s.momentum.toFixed(2)}×10⁻²⁴ kg·m/s · λ ${v.wavelengthNm.toFixed(2)} nm`;
      case "quantum": return `파동묶음 폭 σ=${s.spread.toFixed(2)} nm`;
      case "tunneling": return `장벽 ${s.barrierWidth.toFixed(2)} nm · 투과 ${(v.transmission * 100).toFixed(1)}%`;
      case "nuclei": return `${s.elapsedYears.toFixed(1)}년 · 남은 핵 ${v.remainingNuclei.toFixed(0)}/${INITIAL_NUCLEI}`;
      case "semiconductors": return `${s.voltage.toFixed(2)} V · ${v.currentMilliamp.toFixed(2)} mA`;
      case "sandbox": {
        const readings = this.sandboxReadings();
        const signal = readings.length > 0
          ? readings.reduce((sum, reading) => sum + reading.signal, 0) / readings.length
          : 0;
        return `장치 ${s.devices.length}개 · ${s.running ? "실행 중" : "배치 중 · 멈춤"} · 검출 신호 ${(signal * 100).toFixed(1)}% · 핵 관찰 ${s.elapsedYears.toFixed(1)}년`;
      }
    }
  }

  private graphPoints(): ModernGraphPoint[] {
    const s = this.state;
    switch (s.mode) {
      case "relativity": return series(65, (r) => r * 0.95, (r) => lorentzFactor(r * 0.95, 1));
      case "atoms": return Array.from({ length: 6 }, (_, i) => ({ x: i + 1, y: hydrogenBohrEnergyLevel(i + 1, -13.6) }));
      case "photoelectric": return series(65, (r) => 0.2 + r, (r) => Math.max(0, photoelectronMaximumKineticEnergy(H_EV_PER_PHZ, 0.2 + r, WORK_FUNCTION_EV)));
      case "matter-waves": return this.matterWaveGraph();
      case "quantum": return series(81, (r) => -4 + r * 8, (r) => gaussianProbabilityDensity(-4 + r * 8, 0, s.spread));
      case "tunneling": return series(65, (r) => 0.05 + r * 0.55, (r) => rectangularBarrierTransmission(4, 5, 0.05 + r * 0.55));
      case "nuclei": return series(65, (r) => r * 40, (r) => remainingParticles(INITIAL_NUCLEI, r * 40, HALF_LIFE_YEARS));
      case "semiconductors": return series(65, (r) => -0.1 + r * 0.8, (r) => idealDiodeCurrent(1e-12, -0.1 + r * 0.8, 0.026) * 1000);
      case "sandbox": {
        const readings = this.sandboxReadings();
        return readings.length > 0
          ? readings.map((reading) => ({ x: reading.detector.x / 100, y: reading.signal, current: true }))
          : [{ x: 0, y: 0 }];
      }
    }
  }

  private detectionEvents(v: { electronEnergy: number; wavelengthNm: number; transmission: number; remainingNuclei: number }): DetectionEvent[] {
    const s = this.state;
    const offsets = [-1.8, -1.25, -0.82, -0.51, -0.24, -0.08, 0.12, 0.31, 0.57, 0.9, 1.35, 1.72];
    switch (s.mode) {
      case "photoelectric": return v.electronEnergy <= 0 ? [] : offsets.slice(0, Math.min(12, Math.ceil(v.electronEnergy * 4))).map((z, i) => ({ x: 610 + i * 19, y: 300 + z * 35, strength: v.electronEnergy }));
      case "matter-waves": {
        const density = this.matterWaveGraph();
        const maximum = Math.max(...density.map((point) => point.y), 1e-9);
        return deterministicDensityQuantiles(density, 12).map((position, index) => {
          const nearest = density.reduce((best, point) => Math.abs(point.x - position) < Math.abs(best.x - position) ? point : best);
          return { x: 120 + (position + 4) / 8 * 760, y: 155 + (index % 4) * 88, strength: nearest.y / maximum };
        });
      }
      case "quantum": return offsets.map((z, i) => ({ x: 500 + z * s.spread * 100, y: 155 + (i % 4) * 75, strength: gaussianProbabilityDensity(z * s.spread, 0, s.spread) }));
      case "tunneling": return offsets.slice(0, Math.round(v.transmission * 12)).map((z, i) => ({ x: 720 + i * 13, y: 300 + z * 42, strength: v.transmission }));
      case "sandbox": {
        if (!s.running) return [];
        const eventOffsets = [-24, -12, 0, 12, 24, -18, -6, 6, 18, 30, -30, 36];
        return this.sandboxReadings().flatMap((reading) =>
          eventOffsets.slice(0, Math.round(reading.signal * eventOffsets.length)).map((offset, index) => ({
            x: reading.detector.x + offset,
            y: reading.detector.y + (index % 3 - 1) * 16,
            strength: reading.signal,
          })),
        );
      }
      default: return [];
    }
  }

  private matterWaveGraph(): ModernGraphPoint[] {
    const wavelength = deBroglieWavelength(H_SI, this.state.momentum * 1e-24) * 1e9;
    return series(161, (ratio) => -4 + ratio * 8, (ratio) => {
      const position = -4 + ratio * 8;
      return gaussianProbabilityDensity(position, 0, 1.8) * Math.sin(2 * Math.PI * (position + 4) / wavelength) ** 2;
    });
  }

  private sandboxReadings(): SandboxReading[] {
    if (this.state.mode !== "sandbox") return [];
    const sources = this.state.devices.filter((item) => item.kind === "photon-source");
    const metals = this.state.devices.filter((item) => item.kind === "metal");
    const atoms = this.state.devices.filter((item) => item.kind === "atom");
    const barriers = this.state.devices.filter((item) => item.kind === "barrier");
    const nuclei = this.state.devices.filter((item) => item.kind === "nucleus");
    const detectors = this.state.devices.filter((item) => item.kind === "detector");
    const photonKineticEnergy = Math.max(0, photoelectronMaximumKineticEnergy(H_EV_PER_PHZ, this.state.photonFrequency, WORK_FUNCTION_EV));
    const sandboxPhotonEnergy = photonEnergy(H_EV_PER_PHZ, this.state.photonFrequency);
    const nearestAtomicTransition = Math.min(...[3, 4, 5, 6].map((level) => Math.abs(
      energyTransition(hydrogenBohrEnergyLevel(2, -13.6), hydrogenBohrEnergyLevel(level, -13.6)) - sandboxPhotonEnergy,
    )));
    const atomicResonance = Math.exp(-((nearestAtomicTransition / 0.45) ** 2));
    const decayedFraction = 1 - remainingParticles(INITIAL_NUCLEI, this.state.elapsedYears, HALF_LIFE_YEARS) / INITIAL_NUCLEI;
    return detectors.map((detector) => {
      const photonSignal = sources.reduce((sourceSum, source) => {
        const directDistance = distance(source, detector);
        const distanceLoss = Math.exp(-directDistance / 900);
        const directPhotons = 0.08 * distanceLoss;
        const metalSignal = metals.reduce((sum, metal) => {
          const routeExcess = distance(source, metal) + distance(metal, detector) - directDistance;
          return sum + Math.exp(-routeExcess / 130) * distanceLoss * clamp(photonKineticEnergy / 2.5, 0, 1) * 0.65;
        }, 0);
        const atomSignal = atoms.reduce((sum, atom) => {
          const routeExcess = distance(source, atom) + distance(atom, detector) - directDistance;
          return sum + Math.exp(-routeExcess / 130) * distanceLoss * atomicResonance * 0.36;
        }, 0);
        const barrierTransmission = barriers.reduce((transmission, barrier) =>
          distanceToSegment(barrier, source, detector) <= 75
            ? transmission * rectangularBarrierTransmission(4, 5, this.state.barrierWidth)
            : transmission,
        1);
        return sourceSum + (directPhotons + metalSignal + atomSignal) * barrierTransmission;
      }, 0);
      const nuclearSignal = nuclei.reduce((sum, nucleus) =>
        sum + decayedFraction * Math.exp(-distance(nucleus, detector) / 650) * 0.72,
      0);
      return { detector, signal: clamp(photonSignal + nuclearSignal, 0, 1) };
    });
  }
}
