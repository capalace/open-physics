import {
  carnotEfficiency,
  conductionHeatRate,
  entropyChangeForHeating,
  idealGasPressure,
  rmsMolecularSpeed,
} from "../../../physics/laws/thermal";
import type { ThermalLabId } from "./catalog";

export type ThermalSceneId = ThermalLabId | "sandbox";
export type ThermalTool = "container" | "heater" | "cooler" | "conductor" | "insulator" | "piston" | "thermometer";

export interface ThermalObject {
  readonly id: string;
  readonly type: ThermalTool;
  x: number;
  y: number;
  protected: boolean;
}

export interface ThermalParticle {
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly group: "hot" | "cold" | "mixed";
}

export interface ThermalGraphPoint { readonly x: number; readonly values: readonly number[]; }

export interface ThermalSnapshot {
  readonly scene: ThermalSceneId;
  readonly running: boolean;
  readonly time: number;
  readonly control: number;
  readonly temperature: number;
  readonly secondaryTemperature: number;
  readonly pressure: number;
  readonly volume: number;
  readonly heatFlow: number;
  readonly energy: number;
  readonly liquidFraction: number;
  readonly efficiency: number;
  readonly entropy: number;
  readonly particles: readonly ThermalParticle[];
  readonly objects: readonly ThermalObject[];
  readonly graph: readonly ThermalGraphPoint[];
}

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.max(minimum, Math.min(maximum, value));

const initialControl: Record<ThermalSceneId, number> = {
  particles: 0.42,
  "heat-transfer": 0.45,
  "phase-change": 0,
  gas: 0.62,
  "heat-energy": 0.45,
  "heat-engine": 0.48,
  entropy: 0,
  sandbox: 0.5,
};

const toolsFor = (scene: ThermalSceneId): ThermalTool[] => {
  switch (scene) {
    case "particles": return ["container", "heater", "thermometer"];
    case "heat-transfer": return ["container", "container", "conductor", "thermometer", "thermometer"];
    case "phase-change": return ["container", "heater", "thermometer"];
    case "gas": return ["container", "piston", "thermometer"];
    case "heat-energy": return ["container", "heater", "thermometer"];
    case "heat-engine": return ["heater", "cooler", "piston", "thermometer"];
    case "entropy": return ["container", "insulator", "thermometer"];
    case "sandbox": return ["container", "thermometer"];
  }
};

function makeObjects(scene: ThermalSceneId): ThermalObject[] {
  const positions = [
    [0.5, 0.52], [0.22, 0.75], [0.72, 0.52], [0.35, 0.28], [0.67, 0.28],
  ];
  return toolsFor(scene).map((type, index) => ({
    id: `${scene}-${type}-${index + 1}`,
    type,
    x: positions[index % positions.length][0],
    y: positions[index % positions.length][1],
    protected: scene !== "sandbox",
  }));
}

function deterministicParticles(
  count: number,
  temperature: number,
  time: number,
  split = 0,
): ThermalParticle[] {
  const relativeSpeed = Math.sqrt(Math.max(1, temperature) / 300);
  return Array.from({ length: count }, (_, index) => {
    const seedX = ((index * 47 + 13) % 101) / 101;
    const seedY = ((index * 71 + 29) % 103) / 103;
    const speedBand = 0.55 + ((index * 37) % 61) / 70;
    const angle = index * 2.399963 + time * relativeSpeed * speedBand;
    const drift = time * relativeSpeed * (0.018 + index % 5 * 0.004);
    const x = 0.08 + 0.84 * Math.abs(((seedX + Math.cos(angle) * drift) % 2 + 2) % 2 - 1);
    const y = 0.14 + 0.72 * Math.abs(((seedY + Math.sin(angle) * drift) % 2 + 2) % 2 - 1);
    const group = split === 0 ? "mixed" : index / count < split ? "hot" : "cold";
    return { x, y, speed: relativeSpeed * speedBand, group };
  });
}

export class ThermalWorld {
  private sceneValue: ThermalSceneId;
  private controlValue = 0.5;
  private timeValue = 0;
  private runningValue = false;
  private objectCounter = 0;
  private objectsValue: ThermalObject[] = [];
  private history: ThermalGraphPoint[] = [];

  constructor(scene: ThermalSceneId = "particles") {
    this.sceneValue = scene;
    this.reset(scene);
  }

  get scene(): ThermalSceneId { return this.sceneValue; }
  get running(): boolean { return this.runningValue; }

  reset(scene: ThermalSceneId = this.sceneValue): void {
    this.sceneValue = scene;
    this.controlValue = initialControl[scene];
    this.timeValue = 0;
    this.runningValue = scene !== "sandbox";
    this.objectsValue = makeObjects(scene);
    this.objectCounter = this.objectsValue.length;
    this.history = [];
    this.record();
  }

  play(): void { this.runningValue = true; }
  pause(): void { this.runningValue = false; }
  toggle(): void { this.runningValue = !this.runningValue; }

  setControl(value: number): void {
    this.controlValue = clamp(value);
    this.record();
  }

  step(seconds = 1 / 30): void {
    if (!this.runningValue || seconds <= 0) return;
    this.timeValue += seconds;
    this.record();
  }

  addObject(type: ThermalTool, x = 0.5, y = 0.5): ThermalObject {
    if (this.sceneValue !== "sandbox") throw new Error("안내 실험의 핵심 장치는 추가하거나 삭제할 수 없습니다.");
    const object: ThermalObject = { id: `sandbox-${type}-${++this.objectCounter}`, type, x: clamp(x), y: clamp(y), protected: false };
    this.objectsValue.push(object);
    return object;
  }

  moveObject(id: string, x: number, y: number): boolean {
    const object = this.objectsValue.find((item) => item.id === id);
    if (!object) return false;
    object.x = clamp(x);
    object.y = clamp(y);
    this.record();
    return true;
  }

  removeObject(id: string): boolean {
    const index = this.objectsValue.findIndex((item) => item.id === id);
    if (index < 0 || this.objectsValue[index].protected) return false;
    this.objectsValue.splice(index, 1);
    return true;
  }

  snapshot(): ThermalSnapshot {
    const c = this.controlValue;
    let temperature = 293;
    let secondaryTemperature = 293;
    let pressure = 0;
    let volume = 15;
    let heatFlow = 0;
    let energy = 0;
    let liquidFraction = 0;
    let efficiency = 0;
    let entropy = 0;

    switch (this.sceneValue) {
      case "particles":
        temperature = 220 + c * 480;
        energy = 1.5 * temperature;
        break;
      case "heat-transfer": {
        const elapsed = Math.min(this.timeValue, 20);
        const conductivity = c < 0.5 ? 0.04 : 220;
        const length = 0.18 + Math.abs(c - 0.5) * 0.9;
        heatFlow = conductionHeatRate(conductivity, 0.015, 160, length) / 1000;
        const transferred = Math.min(64, heatFlow * elapsed);
        temperature = 420 - transferred / 0.8;
        secondaryTemperature = 260 + transferred / 0.8;
        energy = transferred;
        break;
      }
      case "phase-change": {
        energy = c * 500;
        if (energy < 42) temperature = -20 + energy / 2.1;
        else if (energy < 376) { temperature = 0; liquidFraction = (energy - 42) / 334; }
        else { liquidFraction = 1; temperature = (energy - 376) / 4.18; }
        break;
      }
      case "gas":
        temperature = 320;
        volume = 5 + c * 20;
        pressure = idealGasPressure(0.6, temperature, volume, 8.314);
        energy = 1.5 * 0.6 * 8.314 * temperature;
        break;
      case "heat-energy": {
        const mass = 0.5 + c * 4.5;
        energy = 80;
        temperature = 20 + energy / (mass * 4.18);
        volume = mass;
        break;
      }
      case "heat-engine":
        temperature = 350 + c * 450;
        secondaryTemperature = 290;
        efficiency = carnotEfficiency(temperature, secondaryTemperature);
        volume = 8 + 5 * (1 + Math.sin(this.timeValue * 2)) / 2;
        pressure = 120 + 45 * Math.cos(this.timeValue * 2);
        energy = 100 * efficiency;
        heatFlow = 100 - energy;
        break;
      case "entropy": {
        const mix = c;
        temperature = 520 + (370 - 520) * mix;
        secondaryTemperature = 220 + (370 - 220) * mix;
        entropy = entropyChangeForHeating(12, 520, temperature)
          + entropyChangeForHeating(12, 220, secondaryTemperature);
        energy = 12 * (520 + 220);
        break;
      }
      case "sandbox": {
        const heaters = this.objectsValue.filter((object) => object.type === "heater").length;
        const coolers = this.objectsValue.filter((object) => object.type === "cooler").length;
        const conductors = this.objectsValue.filter((object) => object.type === "conductor").length;
        const insulators = this.objectsValue.filter((object) => object.type === "insulator").length;
        temperature = clamp(293 + (heaters - coolers) * 55 * c, 120, 900);
        heatFlow = (heaters - coolers) * (1 + conductors * 0.8) / (1 + insulators * 2);
        volume = this.objectsValue.some((object) => object.type === "piston") ? 5 + c * 20 : 15;
        pressure = idealGasPressure(0.5, temperature, volume, 8.314);
        energy = temperature * 1.5;
        break;
      }
    }

    const split = this.sceneValue === "entropy" ? (1 - c) * 0.5 : 0;
    return {
      scene: this.sceneValue,
      running: this.runningValue,
      time: this.timeValue,
      control: c,
      temperature,
      secondaryTemperature,
      pressure,
      volume,
      heatFlow,
      energy,
      liquidFraction,
      efficiency,
      entropy,
      particles: deterministicParticles(36, Math.max(1, (temperature + secondaryTemperature) / 2), this.timeValue, split),
      objects: this.objectsValue.map((object) => ({ ...object })),
      graph: this.graphForCurrentState({ temperature, secondaryTemperature, pressure, volume, heatFlow, energy, liquidFraction, efficiency, entropy }),
    };
  }

  private record(): void {
    const value = this.currentGraphValue();
    const next = { x: this.sceneValue === "heat-transfer" ? this.timeValue : this.controlValue, values: value };
    const last = this.history.at(-1);
    if (!last || Math.abs(last.x - next.x) > 0.005 || last.values.some((item, index) => Math.abs(item - next.values[index]) > 1e-8)) {
      this.history.push(next);
      if (this.history.length > 160) this.history.shift();
    }
  }

  private currentGraphValue(): readonly number[] {
    const snapshot = this.snapshotWithoutGraph();
    switch (this.sceneValue) {
      case "particles": return [rmsMolecularSpeed(8.314, snapshot.temperature, 0.029) / 10];
      case "heat-transfer": {
        const transferred = snapshot.energy + Math.abs(snapshot.heatFlow) * 0.1;
        return [transferred, transferred];
      }
      case "phase-change": return [snapshot.temperature];
      case "gas": return [snapshot.pressure];
      case "heat-energy": return [snapshot.temperature - 20];
      case "heat-engine": return [snapshot.pressure];
      case "entropy": return [snapshot.entropy];
      case "sandbox": return [snapshot.temperature, snapshot.pressure];
    }
  }

  private snapshotWithoutGraph(): Omit<ThermalSnapshot, "graph"> {
    const saved = this.history;
    this.history = [];
    const snapshot = this.snapshot();
    this.history = saved;
    const { graph: _graph, ...rest } = snapshot;
    return rest;
  }

  private graphForCurrentState(current: { pressure: number; volume: number; temperature: number; [key: string]: number }): readonly ThermalGraphPoint[] {
    if (this.sceneValue === "particles") {
      const center = Math.sqrt(current.temperature / 300) * 5;
      return Array.from({ length: 13 }, (_, index) => ({ x: index, values: [36 * Math.exp(-((index - center) ** 2) / 6)] }));
    }
    if (this.sceneValue === "heat-engine") {
      const scale = 0.65 + this.controlValue * 0.7;
      return Array.from({ length: 25 }, (_, index) => {
        const angle = index / 24 * Math.PI * 2;
        return { x: 10 + Math.cos(angle) * 3.4, values: [(125 + Math.sin(angle) * 44) * scale] };
      });
    }
    if (this.sceneValue === "gas") {
      return Array.from({ length: 12 }, (_, index) => {
        const volume = 5 + index * 20 / 11;
        return { x: volume, values: [idealGasPressure(0.6, 320, volume, 8.314)] };
      }).concat({ x: current.volume, values: [current.pressure] });
    }
    return this.history.map((point) => ({ x: point.x, values: [...point.values] }));
  }
}
