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
  readonly velocityX: number;
  readonly velocityY: number;
  readonly group: "hot" | "cold" | "mixed";
}

export interface ThermalGraphPoint { readonly x: number; readonly values: readonly number[]; }

export interface ThermalSnapshot {
  readonly scene: ThermalSceneId;
  readonly running: boolean;
  readonly time: number;
  readonly control: number;
  readonly temperature: number;
  readonly temperatureUnit: "K" | "°C";
  readonly secondaryTemperature: number;
  readonly pressure: number;
  readonly volume: number;
  readonly mass: number;
  readonly heatFlow: number;
  readonly energy: number;
  readonly liquidFraction: number;
  readonly efficiency: number;
  readonly entropy: number;
  readonly particles: readonly ThermalParticle[];
  readonly objects: readonly ThermalObject[];
  readonly thermometerReadings: readonly { id: string; temperature: number; unit: "K" }[];
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
    const speed = relativeSpeed * speedBand;
    return { x, y, speed, velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed, group };
  });
}

function entropyParticles(count: number, hotTemperature: number, coldTemperature: number, mixing: number, time: number): ThermalParticle[] {
  const half = Math.floor(count / 2);
  return Array.from({ length: count }, (_, index) => {
    const hot = index < half;
    const local = index % half;
    const temperature = hot ? hotTemperature : coldTemperature;
    const speedBand = 0.65 + ((local * 37) % 61) / 70;
    const speed = Math.sqrt(temperature / 300) * speedBand;
    const angle = index * 2.399963 + time * speed;
    const sideSeed = ((local * 47 + 13) % 101) / 101;
    const sideCenter = hot ? 0.27 : 0.73;
    const spread = 0.18 + mixing * 0.25;
    const x = clamp(sideCenter + (sideSeed - 0.5) * spread * 2 + Math.cos(angle) * 0.025 * time, 0.08, 0.92);
    const ySeed = ((local * 71 + 29) % 103) / 103;
    const y = 0.14 + 0.72 * Math.abs(((ySeed + Math.sin(angle) * 0.02 * time) % 2 + 2) % 2 - 1);
    return {
      x, y, speed,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      group: mixing >= 0.999 ? "mixed" : hot ? "hot" : "cold",
    };
  });
}

const pointSegmentDistance = (
  point: Pick<ThermalObject, "x" | "y">,
  start: Pick<ThermalObject, "x" | "y">,
  end: Pick<ThermalObject, "x" | "y">,
): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};

export class ThermalWorld {
  private sceneValue: ThermalSceneId;
  private controlValue = 0.5;
  private timeValue = 0;
  private runningValue = false;
  private objectCounter = 0;
  private objectsValue: ThermalObject[] = [];
  private history: ThermalGraphPoint[] = [];
  private accumulatedHeatValue = 0;

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
    this.accumulatedHeatValue = 0;
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
    if (this.sceneValue === "heat-transfer") {
      this.accumulatedHeatValue = Math.min(64, this.accumulatedHeatValue + Math.abs(this.transferRate()) * seconds);
    }
    this.timeValue += seconds;
    this.record();
  }

  addObject(type: ThermalTool, x = 0.5, y = 0.5): ThermalObject {
    if (this.sceneValue !== "sandbox") throw new Error("안내 실험의 핵심 장치는 추가하거나 삭제할 수 없습니다.");
    const object: ThermalObject = { id: `sandbox-${type}-${++this.objectCounter}`, type, x: clamp(x), y: clamp(y), protected: false };
    this.objectsValue.push(object);
    this.record();
    return object;
  }

  moveObject(id: string, x: number, y: number): boolean {
    const object = this.objectsValue.find((item) => item.id === id);
    if (!object || object.protected) return false;
    object.x = clamp(x);
    object.y = clamp(y);
    this.record();
    return true;
  }

  removeObject(id: string): boolean {
    const index = this.objectsValue.findIndex((item) => item.id === id);
    if (index < 0 || this.objectsValue[index].protected) return false;
    this.objectsValue.splice(index, 1);
    this.record();
    return true;
  }

  snapshot(): ThermalSnapshot {
    const c = this.controlValue;
    let temperature = 293;
    let secondaryTemperature = 293;
    let pressure = 0;
    let volume = 15;
    let mass = 1;
    let heatFlow = 0;
    let energy = 0;
    let liquidFraction = 0;
    let efficiency = 0;
    let entropy = 0;
    let temperatureUnit: "K" | "°C" = "K";

    switch (this.sceneValue) {
      case "particles":
        temperature = 220 + c * 480;
        energy = 1.5 * temperature;
        break;
      case "heat-transfer": {
        heatFlow = this.transferRate();
        const transferred = this.accumulatedHeatValue;
        temperature = 420 - transferred / 0.8;
        secondaryTemperature = 260 + transferred / 0.8;
        energy = transferred;
        break;
      }
      case "phase-change": {
        temperatureUnit = "°C";
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
        temperatureUnit = "°C";
        mass = 0.5 + c * 4.5;
        energy = 80;
        temperature = 20 + energy / (mass * 4.18);
        break;
      }
      case "heat-engine":
        temperature = 350 + c * 450;
        secondaryTemperature = 290;
        efficiency = carnotEfficiency(temperature, secondaryTemperature);
        volume = this.engineVolume(this.timeValue * 2);
        pressure = this.enginePressure(this.timeValue * 2, c);
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
        const containers = this.objectsValue.filter((object) => object.type === "container");
        const targets = containers.length ? containers : [{ x: 0.5, y: 0.5 }];
        const temperatures = targets.map((target) => this.sandboxTemperatureAt(target));
        temperature = temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length;
        heatFlow = temperatures.reduce((sum, value) => sum + value - 293, 0) / temperatures.length;
        const piston = this.objectsValue.find((object) => object.type === "piston"
          && targets.some((target) => Math.hypot(object.x - target.x, object.y - target.y) < 0.36));
        volume = piston ? 5 + c * 20 : 15;
        pressure = idealGasPressure(0.5, temperature, volume, 8.314);
        energy = temperature * 1.5;
        break;
      }
    }

    const particleCount = this.sceneValue === "heat-energy" ? Math.round(16 + mass * 8) : 36;
    const particleTemperature = temperatureUnit === "°C" ? temperature + 273.15 : temperature;
    const particles = this.sceneValue === "entropy"
      ? entropyParticles(36, temperature, secondaryTemperature, c, this.timeValue)
      : deterministicParticles(particleCount, Math.max(1, particleTemperature), this.timeValue);
    const thermometerReadings = this.sceneValue === "sandbox"
      ? this.objectsValue.filter((object) => object.type === "thermometer").map((thermometer) => ({
        id: thermometer.id,
        temperature: this.sandboxTemperatureAt(thermometer),
        unit: "K" as const,
      }))
      : [];
    return {
      scene: this.sceneValue,
      running: this.runningValue,
      time: this.timeValue,
      control: c,
      temperature,
      temperatureUnit,
      secondaryTemperature,
      pressure,
      volume,
      mass,
      heatFlow,
      energy,
      liquidFraction,
      efficiency,
      entropy,
      particles,
      objects: this.objectsValue.map((object) => ({ ...object })),
      thermometerReadings,
      graph: this.graphForCurrentState({ temperature, secondaryTemperature, pressure, volume, heatFlow, energy, liquidFraction, efficiency, entropy }, particles),
    };
  }

  private record(): void {
    const value = this.currentGraphValue();
    const snapshot = this.snapshotWithoutGraph();
    const next = { x: this.graphX(snapshot), values: value };
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
        return [snapshot.energy, snapshot.energy];
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

  private graphForCurrentState(
    current: { pressure: number; volume: number; temperature: number; [key: string]: number },
    particles: readonly ThermalParticle[] = [],
  ): readonly ThermalGraphPoint[] {
    if (this.sceneValue === "particles") {
      return Array.from({ length: 13 }, (_, index) => ({
        x: index * 0.2,
        values: [particles.filter((particle) => particle.speed >= index * 0.2 && particle.speed < (index + 1) * 0.2).length],
      }));
    }
    if (this.sceneValue === "heat-engine") {
      const startPhase = this.timeValue * 2;
      return Array.from({ length: 25 }, (_, index) => {
        const angle = startPhase + index / 24 * Math.PI * 2;
        return { x: this.engineVolume(angle), values: [this.enginePressure(angle, this.controlValue)] };
      });
    }
    if (this.sceneValue === "gas") {
      return Array.from({ length: 12 }, (_, index) => {
        const volume = 5 + index * 20 / 11;
        return { x: volume, values: [idealGasPressure(0.6, 320, volume, 8.314)] };
      }).concat({ x: current.volume, values: [current.pressure] }).sort((a, b) => a.x - b.x);
    }
    if (this.sceneValue === "sandbox") {
      return Array.from({ length: 21 }, (_, index) => ({
        x: index * 5,
        values: [this.sandboxTemperatureAt({ x: index / 20, y: 0.52 })],
      }));
    }
    return this.history.map((point) => ({ x: point.x, values: [...point.values] }));
  }

  private graphX(snapshot: Omit<ThermalSnapshot, "graph">): number {
    switch (this.sceneValue) {
      case "heat-transfer": return snapshot.time;
      case "phase-change": return snapshot.energy;
      case "gas": return snapshot.volume;
      case "heat-energy": return snapshot.mass;
      case "entropy": return snapshot.control * 100;
      case "particles": return snapshot.control;
      case "heat-engine": return snapshot.volume;
      case "sandbox": return snapshot.objects.reduce((sum, object) => sum + object.x * 0.01 + object.y * 0.001, snapshot.control);
    }
  }

  private transferRate(): number {
    const conductivity = this.controlValue < 0.5 ? 0.04 : 220;
    return conductionHeatRate(conductivity, 0.015, 160, 0.3) / 1000;
  }

  private engineVolume(phase: number): number { return 10.5 + 2.5 * Math.sin(phase); }
  private enginePressure(phase: number, control: number): number {
    return 120 + (25 + 40 * control) * Math.cos(phase);
  }

  private sandboxTemperatureAt(point: Pick<ThermalObject, "x" | "y">): number {
    const sources = this.objectsValue.filter((object) => object.type === "heater" || object.type === "cooler");
    const conductors = this.objectsValue.filter((object) => object.type === "conductor");
    const insulators = this.objectsValue.filter((object) => object.type === "insulator");
    let temperature = 293;
    for (const source of sources) {
      const distance = Math.hypot(point.x - source.x, point.y - source.y);
      const proximity = Math.exp(-distance * 4.5);
      const conducted = conductors.some((material) => pointSegmentDistance(material, source, point) < 0.1) ? 1.8 : 1;
      const insulated = insulators.some((material) => pointSegmentDistance(material, source, point) < 0.085) ? 0.18 : 1;
      temperature += (source.type === "heater" ? 1 : -1) * 150 * this.controlValue * proximity * conducted * insulated;
    }
    return clamp(temperature, 120, 900);
  }
}
