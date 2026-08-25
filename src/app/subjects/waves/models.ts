import {
  angularFrequencyFromFrequency,
  dopplerFrequency,
  fixedStringHarmonicFrequency,
  relativeIntensity,
  resonanceResponse,
  standingWave,
  superposeWaves,
  travelingWave,
  waveNumber,
  waveSpeed,
} from "../../../physics/laws/waves";
import type { WavesLabId } from "./catalog";

export const WAVE_WORLD = { width: 1000, height: 600 } as const;

export type WaveDeviceKind = "source" | "boundary" | "medium" | "second-source" | "observer" | "detector";

export interface WaveDevice {
  readonly id: string;
  readonly kind: WaveDeviceKind;
  readonly x: number;
  readonly y: number;
  readonly protected: boolean;
}

export interface GraphPoint { readonly x: number; readonly y: number }

export interface WavesSnapshot {
  readonly mode: WavesLabId | "sandbox";
  readonly time: number;
  readonly running: boolean;
  readonly amplitude: number;
  readonly frequency: number;
  readonly wavelength: number;
  readonly speed: number;
  readonly sourceSpacing: number;
  readonly harmonic: number;
  readonly naturalFrequency: number;
  readonly sourceVelocity: number;
  readonly observedFrequency: number;
  readonly response: number;
  readonly measurement: string;
  readonly devices: readonly WaveDevice[];
  readonly graph: readonly GraphPoint[];
}

interface MutableDevice {
  id: string;
  kind: WaveDeviceKind;
  x: number;
  y: number;
  protected: boolean;
}

interface WaveState {
  mode: WavesLabId | "sandbox";
  time: number;
  running: boolean;
  amplitude: number;
  frequency: number;
  speed: number;
  sourceSpacing: number;
  harmonic: number;
  naturalFrequency: number;
  sourceVelocity: number;
  devices: MutableDevice[];
  nextDeviceId: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const pointSeries = (
  count: number,
  valueAt: (ratio: number) => number,
  xAt: (ratio: number) => number = (ratio) => ratio,
): GraphPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return { x: xAt(ratio), y: valueAt(ratio) };
  });

const device = (
  id: string,
  kind: WaveDeviceKind,
  x: number,
  y: number,
  protectedDevice = true,
): MutableDevice => ({ id, kind, x, y, protected: protectedDevice });

function initialState(mode: WavesLabId | "sandbox"): WaveState {
  const common = {
    mode, time: 0, running: mode !== "sandbox", amplitude: 36, frequency: 2, speed: 120,
    sourceSpacing: 180, harmonic: 2, naturalFrequency: 5, sourceVelocity: 45, nextDeviceId: 1,
  };
  switch (mode) {
    case "source": return { ...common, devices: [device("source", "source", 120, 300), device("rope", "medium", 500, 300), device("end", "boundary", 900, 300)] };
    case "propagation": return { ...common, devices: [device("source", "source", 120, 300), device("medium", "medium", 500, 300), device("detector", "detector", 870, 300)] };
    case "interference": return { ...common, frequency: 3, speed: 180, devices: [device("source-a", "source", 180, 210), device("source-b", "second-source", 180, 390), device("screen", "detector", 850, 300)] };
    case "standing-wave": return { ...common, speed: 200, devices: [device("left", "boundary", 120, 300), device("string", "medium", 500, 300), device("right", "boundary", 880, 300)] };
    case "resonance": return { ...common, frequency: 3.5, amplitude: 24, devices: [device("driver", "source", 180, 300), device("resonator", "medium", 540, 300), device("meter", "detector", 850, 300)] };
    case "sound": return { ...common, frequency: 4, amplitude: 30, speed: 340, devices: [device("speaker", "source", 140, 300), device("air", "medium", 500, 300), device("microphone", "detector", 850, 300)] };
    case "doppler": return { ...common, frequency: 440, speed: 340, amplitude: 24, devices: [device("moving-source", "source", 260, 300), device("observer", "observer", 850, 300)] };
    case "sandbox": return { ...common, running: false, devices: [device("sandbox-medium", "medium", 500, 300, false)] };
  }
}

export class WavesModel {
  private state: WaveState;

  constructor(mode: WavesLabId | "sandbox" = "source") {
    this.state = initialState(mode);
  }

  activate(mode: WavesLabId | "sandbox"): void { this.state = initialState(mode); }
  reset(): void { this.state = initialState(this.state.mode); }
  setRunning(running: boolean): void { this.state.running = running; }
  toggleRunning(): void { this.state.running = !this.state.running; }

  step(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Step duration must be finite and non-negative.");
    if (this.state.running) this.state.time += Math.min(seconds, 0.1);
  }

  /** Maps a Canvas drag to the active experiment's independent variable. */
  dragPrimary(x: number, y: number): void {
    const nx = clamp(x / WAVE_WORLD.width, 0, 1);
    const ny = clamp(y / WAVE_WORLD.height, 0, 1);
    const trackRatio = clamp((x - 70) / 860, 0, 1);
    switch (this.state.mode) {
      case "source": this.state.amplitude = 12 + (1 - ny) * 76; break;
      case "propagation": this.state.speed = 60 + trackRatio * 240; break;
      case "interference": {
        this.state.sourceSpacing = 80 + ny * 320;
        const second = this.state.devices.find((item) => item.kind === "second-source");
        if (second) second.y = 300 + this.state.sourceSpacing / 2;
        break;
      }
      case "standing-wave": this.state.harmonic = Math.round(1 + trackRatio * 4); break;
      case "resonance": this.state.frequency = 1 + trackRatio * 8; break;
      case "sound": this.state.amplitude = 5 + (1 - ny) * 65; break;
      case "doppler": {
        this.state.sourceVelocity = clamp((nx - 0.15) * 220, -100, 150);
        const source = this.state.devices.find((item) => item.kind === "source");
        if (source) source.x = clamp(x, 130, 720);
        break;
      }
      case "sandbox": break;
    }
    if (this.state.mode !== "sandbox") this.state.running = true;
  }

  moveDevice(id: string, x: number, y: number): boolean {
    if (this.state.mode !== "sandbox") return false;
    const found = this.state.devices.find((item) => item.id === id);
    if (!found) return false;
    found.x = clamp(x, 40, WAVE_WORLD.width - 40);
    found.y = clamp(y, 60, WAVE_WORLD.height - 60);
    return true;
  }

  addDevice(kind: WaveDeviceKind): string {
    if (this.state.mode !== "sandbox") throw new Error("Devices can only be added in the empty wave laboratory.");
    const id = `${kind}-${this.state.nextDeviceId++}`;
    const offset = (this.state.devices.length % 5) * 72;
    this.state.devices.push(device(id, kind, 220 + offset, 180 + (this.state.devices.length % 3) * 100, false));
    return id;
  }

  removeDevice(id: string): boolean {
    const index = this.state.devices.findIndex((item) => item.id === id);
    if (index < 0 || this.state.devices[index].protected) return false;
    this.state.devices.splice(index, 1);
    return true;
  }

  displacementAt(xMeters: number, yMeters = 0): number {
    const { mode, amplitude, frequency, speed, time, sourceSpacing, harmonic } = this.state;
    const wavelength = speed / frequency;
    const k = waveNumber(wavelength);
    const omega = angularFrequencyFromFrequency(frequency);
    if (mode === "interference") {
      const half = sourceSpacing / 200;
      const r1 = Math.hypot(xMeters, yMeters - half);
      const r2 = Math.hypot(xMeters, yMeters + half);
      return superposeWaves(
        travelingWave(amplitude / 2, k, omega, r1, time),
        travelingWave(amplitude / 2, k, omega, r2, time),
      );
    }
    if (mode === "standing-wave") {
      const length = 8;
      return standingWave(amplitude / 2, harmonic * Math.PI / length, omega, xMeters, time);
    }
    if (mode === "sandbox") {
      const sources = this.state.devices.filter((item) => item.kind === "source" || item.kind === "second-source");
      return superposeWaves(...sources.map((source) => {
        const dx = xMeters - source.x / 100;
        const dy = yMeters - source.y / 100;
        return travelingWave(amplitude / 2, k, omega, Math.hypot(dx, dy), time);
      }));
    }
    return travelingWave(amplitude, k, omega, xMeters, time);
  }

  snapshot(): WavesSnapshot {
    const state = this.state;
    const wavelength = waveSpeed(state.frequency, state.speed / state.frequency) / state.frequency;
    const observedFrequency = state.mode === "doppler"
      ? dopplerFrequency(state.frequency, state.speed, 0, state.sourceVelocity)
      : state.frequency;
    const response = state.mode === "resonance"
      ? resonanceResponse(state.frequency, state.naturalFrequency, 0.12)
      : relativeIntensity(state.amplitude) / 100;
    return {
      mode: state.mode,
      time: state.time,
      running: state.running,
      amplitude: state.amplitude,
      frequency: state.frequency,
      wavelength,
      speed: state.speed,
      sourceSpacing: state.sourceSpacing,
      harmonic: state.harmonic,
      naturalFrequency: state.naturalFrequency,
      sourceVelocity: state.sourceVelocity,
      observedFrequency,
      response,
      measurement: this.measurement(observedFrequency, response, wavelength),
      devices: state.devices.map((item) => ({ ...item })),
      graph: this.graphPoints(),
    };
  }

  private measurement(observedFrequency: number, response: number, wavelength: number): string {
    switch (this.state.mode) {
      case "source": return `진폭 ${this.state.amplitude.toFixed(0)} cm · 상대 세기 ${(relativeIntensity(this.state.amplitude) / 100).toFixed(1)}`;
      case "propagation": return `속력 ${this.state.speed.toFixed(0)} m/s · 파장 ${wavelength.toFixed(1)} m`;
      case "interference": return `파원 간격 ${this.state.sourceSpacing.toFixed(0)} cm`;
      case "standing-wave": return `${this.state.harmonic}배음 · ${fixedStringHarmonicFrequency(this.state.harmonic, this.state.speed, 8).toFixed(1)} Hz`;
      case "resonance": return `구동 ${this.state.frequency.toFixed(1)} Hz · 응답 ${response.toFixed(1)}배`;
      case "sound": return `압력 진폭 ${this.state.amplitude.toFixed(0)} Pa · 상대 세기 ${(relativeIntensity(this.state.amplitude) / 100).toFixed(1)}`;
      case "doppler": return `파원 ${this.state.sourceVelocity.toFixed(0)} m/s · 관찰 ${observedFrequency.toFixed(0)} Hz`;
      case "sandbox": return `장치 ${this.state.devices.length}개 · 배치 중에는 멈춤`;
    }
  }

  private graphPoints(): GraphPoint[] {
    const s = this.state;
    switch (s.mode) {
      case "source":
        return pointSeries(65, (ratio) => travelingWave(s.amplitude, waveNumber(s.speed / s.frequency), angularFrequencyFromFrequency(s.frequency), ratio * 8, s.time), (ratio) => ratio * 8);
      case "propagation":
        return pointSeries(41, (ratio) => (60 + ratio * 240) / s.frequency, (ratio) => 60 + ratio * 240);
      case "interference":
        return pointSeries(65, (ratio) => {
          const y = (ratio - 0.5) * 8;
          const value = this.displacementAt(7, y);
          return relativeIntensity(value) / 100;
        }, (ratio) => (ratio - 0.5) * 8);
      case "standing-wave":
        return pointSeries(65, (ratio) => Math.abs(2 * s.amplitude * Math.sin(s.harmonic * Math.PI * ratio)), (ratio) => ratio * 8);
      case "resonance":
        return pointSeries(65, (ratio) => resonanceResponse(1 + ratio * 8, s.naturalFrequency, 0.12), (ratio) => 1 + ratio * 8);
      case "sound":
        return pointSeries(65, (ratio) => s.amplitude * Math.sin(2 * Math.PI * s.frequency * (ratio * 0.01 - s.time)), (ratio) => ratio * 10);
      case "doppler":
        return pointSeries(65, (ratio) => dopplerFrequency(s.frequency, s.speed, 0, -100 + ratio * 250), (ratio) => -100 + ratio * 250);
      case "sandbox":
        return pointSeries(2, () => 0);
    }
  }
}
