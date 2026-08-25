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
export interface ModernGraphPoint { readonly x: number; readonly y: number }
export interface DetectionEvent { readonly x: number; readonly y: number; readonly strength: number }

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
const series = (count: number, xAt: (r: number) => number, yAt: (r: number) => number): ModernGraphPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return { x: xAt(ratio), y: yAt(ratio) };
  });
const device = (id: string, kind: ModernDeviceKind, x: number, y: number, protectedDevice = true): MutableDevice =>
  ({ id, kind, x, y, protected: protectedDevice });

function initialState(mode: ModernLabId | "sandbox"): ModernState {
  const common = {
    mode, running: mode !== "sandbox", animationTime: 0, speedFraction: 0.6, quantumNumber: 3,
    photonFrequency: 0.75, momentum: 1.4, spread: 0.9, barrierWidth: 0.22,
    elapsedYears: 8, voltage: 0.55, nextDeviceId: 1,
  };
  switch (mode) {
    case "relativity": return { ...common, devices: [device("earth-clock", "detector", 170, 300), device("ship-clock", "detector", 700, 300)] };
    case "atoms": return { ...common, devices: [device("hydrogen", "atom", 500, 300), device("spectrum", "detector", 850, 300)] };
    case "photoelectric": return { ...common, devices: [device("lamp", "photon-source", 150, 300), device("metal", "metal", 520, 300), device("electron-detector", "detector", 850, 300)] };
    case "matter-waves": return { ...common, devices: [device("particle-source", "photon-source", 130, 300), device("wave-detector", "detector", 870, 300)] };
    case "quantum": return { ...common, devices: [device("preparation", "atom", 220, 300), device("position-detector", "detector", 820, 300)] };
    case "tunneling": return { ...common, devices: [device("particle-source", "photon-source", 130, 300), device("barrier", "barrier", 520, 300), device("tunnel-detector", "detector", 850, 300)] };
    case "nuclei": return { ...common, devices: [device("sample", "nucleus", 430, 300), device("decay-counter", "detector", 850, 300)] };
    case "semiconductors": return { ...common, devices: [device("junction", "metal", 500, 300), device("current-meter", "detector", 850, 300)] };
    case "sandbox": return { ...common, running: false, devices: [device("sandbox-detector", "detector", 820, 300, false)] };
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
    if (this.state.running) this.state.animationTime += Math.min(seconds, 0.1);
  }

  dragPrimary(x: number, _y: number): void {
    const ratio = clamp((x - 70) / 860, 0, 1);
    switch (this.state.mode) {
      case "relativity": this.state.speedFraction = ratio * 0.95; break;
      case "atoms": this.state.quantumNumber = Math.round(2 + ratio * 4); break;
      case "photoelectric": this.state.photonFrequency = 0.2 + ratio; break;
      case "matter-waves": this.state.momentum = 0.5 + ratio * 4.5; break;
      case "quantum": this.state.spread = 0.3 + ratio * 1.7; break;
      case "tunneling": this.state.barrierWidth = 0.05 + ratio * 0.55; break;
      case "nuclei": this.state.elapsedYears = ratio * 40; break;
      case "semiconductors": this.state.voltage = -0.1 + ratio * 0.8; break;
      case "sandbox": break;
    }
    if (this.state.mode !== "sandbox") this.state.running = true;
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
      case "sandbox": return `장치 ${s.devices.length}개 · 배치 중에는 멈춤`;
    }
  }

  private graphPoints(): ModernGraphPoint[] {
    const s = this.state;
    switch (s.mode) {
      case "relativity": return series(65, (r) => r * 0.95, (r) => lorentzFactor(r * 0.95, 1));
      case "atoms": return Array.from({ length: 6 }, (_, i) => ({ x: i + 1, y: hydrogenBohrEnergyLevel(i + 1, -13.6) }));
      case "photoelectric": return series(65, (r) => 0.2 + r, (r) => Math.max(0, photoelectronMaximumKineticEnergy(H_EV_PER_PHZ, 0.2 + r, WORK_FUNCTION_EV)));
      case "matter-waves": return series(81, (r) => -4 + r * 8, (r) => {
        const x = r * 8; const wavelength = deBroglieWavelength(H_SI, s.momentum * 1e-24) * 1e9;
        return gaussianProbabilityDensity(x, 4, 1.8) * Math.sin(2 * Math.PI * x / wavelength) ** 2;
      });
      case "quantum": return series(81, (r) => -4 + r * 8, (r) => gaussianProbabilityDensity(-4 + r * 8, 0, s.spread));
      case "tunneling": return series(65, (r) => 0.05 + r * 0.55, (r) => rectangularBarrierTransmission(4, 5, 0.05 + r * 0.55));
      case "nuclei": return series(65, (r) => r * 40, (r) => remainingParticles(INITIAL_NUCLEI, r * 40, HALF_LIFE_YEARS));
      case "semiconductors": return series(65, (r) => -0.1 + r * 0.8, (r) => idealDiodeCurrent(1e-12, -0.1 + r * 0.8, 0.026) * 1000);
      case "sandbox": return [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    }
  }

  private detectionEvents(v: { electronEnergy: number; wavelengthNm: number; transmission: number; remainingNuclei: number }): DetectionEvent[] {
    const s = this.state;
    const offsets = [-1.8, -1.25, -0.82, -0.51, -0.24, -0.08, 0.12, 0.31, 0.57, 0.9, 1.35, 1.72];
    switch (s.mode) {
      case "photoelectric": return v.electronEnergy <= 0 ? [] : offsets.slice(0, Math.min(12, Math.ceil(v.electronEnergy * 4))).map((z, i) => ({ x: 610 + i * 19, y: 300 + z * 35, strength: v.electronEnergy }));
      case "matter-waves": return offsets.map((z, i) => ({ x: 760 + Math.sin(i * v.wavelengthNm * 5) * 60, y: 300 + z * 90, strength: 1 }));
      case "quantum": return offsets.map((z, i) => ({ x: 500 + z * s.spread * 100, y: 155 + (i % 4) * 75, strength: gaussianProbabilityDensity(z * s.spread, 0, s.spread) }));
      case "tunneling": return offsets.slice(0, Math.round(v.transmission * 12)).map((z, i) => ({ x: 720 + i * 13, y: 300 + z * 42, strength: v.transmission }));
      default: return [];
    }
  }
}
