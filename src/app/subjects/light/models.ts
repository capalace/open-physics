import {
  doubleSlitIntensity,
  lensImageDistance,
  lensMagnification,
  polarizedIntensity,
  prismDeviation,
  reflectedAngle,
  refractedAngle,
  telescopeMagnification,
} from "../../../physics/laws/optics";
import { lightLab, type LightLabId } from "./catalog";

export type LightSceneId = LightLabId | "sandbox";
export type LightDeviceKind = "source" | "mirror" | "boundary" | "lens" | "prism" | "slit" | "screen";
export interface Point { x: number; y: number }
export interface LightDevice extends Point {
  id: string;
  kind: LightDeviceKind;
  label: string;
  angle?: number;
  /** Educational Canvas distance between a double slit's aperture centers. */
  separation?: number;
  protected: boolean;
}
export interface RaySegment { from: Point; to: Point; color: string; width?: number; dashed?: boolean }
export interface GraphPoint { x: number; y: number }
export interface LightSnapshot {
  sceneId: LightSceneId;
  devices: readonly LightDevice[];
  rays: readonly RaySegment[];
  graph: readonly GraphPoint[];
  graphSeries: { label: string; color: string };
  graphCurrent?: GraphPoint;
  graphIsCurrentState?: boolean;
  graphValue: string;
  handle: Point | null;
  screenPattern?: readonly GraphPoint[];
  screenIntensity?: number;
  image?: { x: number; y: number; height: number; virtual: boolean };
  normal?: { from: Point; to: Point };
}

const WIDTH = 960;
const HEIGHT = 600;
const CM_TO_PX = 10;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const degrees = (radians: number): number => radians * 180 / Math.PI;
const normalizeAngle = (radians: number): number => Math.atan2(Math.sin(radians), Math.cos(radians));
const pointAlong = (from: Point, angle: number, length: number): Point => ({
  x: from.x + Math.cos(angle) * length,
  y: from.y + Math.sin(angle) * length,
});
const device = (
  id: string, kind: LightDeviceKind, label: string, x: number, y: number, angle = 0, protectedDevice = true,
): LightDevice => ({ id, kind, label, x, y, angle, protected: protectedDevice });

interface LightParameters {
  sourceY: number;
  mirrorAngle: number;
  refractionSourceX: number;
  objectX: number;
  prismAngle: number;
  slitSeparation: number;
  analyzerAngle: number;
  eyepieceFocalCm: number;
}

const DEFAULTS: LightParameters = {
  sourceY: 225,
  mirrorAngle: -Math.PI / 7,
  refractionSourceX: 250,
  objectX: 260,
  prismAngle: 0,
  slitSeparation: 0.00028,
  analyzerAngle: Math.PI / 6,
  eyepieceFocalCm: 6,
};

/** Deterministic light-world module. Canvas pixels are converted only at this boundary. */
export class LightLabModel {
  private sceneId: LightSceneId;
  private parameters: LightParameters = { ...DEFAULTS };
  private devices: LightDevice[] = [];
  private drag: { type: "control" | "device"; id?: string } | null = null;
  private nextDevice = 1;

  constructor(sceneId: LightSceneId = "propagation") {
    this.sceneId = sceneId;
    this.reset();
  }

  get activeScene(): LightSceneId { return this.sceneId; }

  load(sceneId: LightSceneId): void {
    this.sceneId = sceneId;
    this.reset();
  }

  reset(): void {
    this.parameters = { ...DEFAULTS };
    this.drag = null;
    this.nextDevice = 1;
    this.devices = this.createDevices(this.sceneId);
  }

  addDevice(kind: LightDeviceKind): LightDevice | null {
    if (this.sceneId !== "sandbox") return null;
    const id = `sandbox-${kind}-${this.nextDevice++}`;
    const offset = (this.devices.length % 5) * 42;
    const startAngle = kind === "mirror" || kind === "boundary" ? Math.PI / 2 : 0;
    const created = device(id, kind, this.deviceLabel(kind), 260 + offset, 180 + offset / 2, startAngle, false);
    if (kind === "slit") created.separation = 280 / 3;
    this.devices.push(created);
    return { ...created };
  }

  removeDevice(id: string): boolean {
    const target = this.devices.find((candidate) => candidate.id === id);
    if (!target || target.protected || this.sceneId !== "sandbox") return false;
    this.devices = this.devices.filter((candidate) => candidate.id !== id);
    if (this.drag?.id === id) this.drag = null;
    return true;
  }

  pointerDown(point: Point): boolean {
    const handle = this.controlHandle();
    if (this.sceneId !== "sandbox" && handle && Math.hypot(point.x - handle.x, point.y - handle.y) <= 30) {
      this.drag = { type: "control" };
      return true;
    }
    if (this.sceneId === "sandbox") {
      const target = [...this.devices].reverse().find((candidate) =>
        Math.hypot(point.x - candidate.x, point.y - candidate.y) <= 30);
      if (target) {
        this.drag = { type: "device", id: target.id };
        return true;
      }
    }
    return false;
  }

  pointerMove(point: Point): boolean {
    if (!this.drag) return false;
    if (this.drag.type === "device") {
      const target = this.devices.find((candidate) => candidate.id === this.drag?.id);
      if (!target) return false;
      target.x = clamp(point.x, 30, WIDTH - 30);
      target.y = clamp(point.y, 30, HEIGHT - 30);
      return true;
    }
    switch (this.sceneId) {
      case "propagation": this.parameters.sourceY = clamp(point.y, 110, 440); break;
      case "reflection": this.parameters.mirrorAngle = Math.atan2(point.y - 300, point.x - 500); break;
      case "refraction": this.parameters.refractionSourceX = clamp(point.x, 120, 430); break;
      case "lenses": this.parameters.objectX = clamp(point.x, 120, 370); break;
      case "prism": this.parameters.prismAngle = Math.atan2(point.y - 300, point.x - 500); break;
      case "diffraction": this.parameters.slitSeparation = clamp(Math.abs(point.y - 300) * 6e-6, 80e-6, 500e-6); break;
      case "polarization": this.parameters.analyzerAngle = Math.atan2(point.y - 300, point.x - 590); break;
      case "instruments": this.parameters.eyepieceFocalCm = clamp((420 - point.y) / 18, 3, 12); break;
      default: return false;
    }
    this.syncControlledDevices();
    return true;
  }

  pointerUp(): void { this.drag = null; }

  snapshot(): LightSnapshot {
    const graphSeries = this.sceneId === "sandbox"
      ? { label: "광선 진행 방향", color: "#ffe066" }
      : { ...lightLab(this.sceneId).graph.series[0] };
    const base = { sceneId: this.sceneId, devices: this.devices.map((item) => ({ ...item })), graphSeries };
    switch (this.sceneId) {
      case "propagation": return { ...base, ...this.propagationSnapshot() };
      case "reflection": return { ...base, ...this.reflectionSnapshot() };
      case "refraction": return { ...base, ...this.refractionSnapshot() };
      case "lenses": return { ...base, ...this.lensSnapshot() };
      case "prism": return { ...base, ...this.prismSnapshot() };
      case "diffraction": return { ...base, ...this.diffractionSnapshot() };
      case "polarization": return { ...base, ...this.polarizationSnapshot() };
      case "instruments": return { ...base, ...this.instrumentSnapshot() };
      case "sandbox": return { ...base, ...this.sandboxSnapshot() };
    }
  }

  private createDevices(scene: LightSceneId): LightDevice[] {
    switch (scene) {
      case "propagation": return [
        device("source", "source", "광원", 120, this.parameters.sourceY),
        device("aperture", "slit", "작은 구멍", 480, 300),
        device("screen", "screen", "스크린", 820, 300),
      ];
      case "reflection": return [
        device("source", "source", "광원", 150, 390),
        device("mirror", "mirror", "거울", 500, 300, this.parameters.mirrorAngle),
        device("screen", "screen", "스크린", 790, 180),
      ];
      case "refraction": return [
        device("source", "source", "광원", this.parameters.refractionSourceX, 100),
        device("boundary", "boundary", "공기–물 경계", 480, 300),
        device("screen", "screen", "수중 스크린", 720, 520),
      ];
      case "lenses": return [
        device("object", "source", "빛나는 물체", this.parameters.objectX, 300),
        device("lens", "lens", "볼록렌즈", 480, 300),
        device("screen", "screen", "스크린", 760, 300),
      ];
      case "prism": return [
        device("source", "source", "흰빛", 130, 300),
        device("prism", "prism", "프리즘", 500, 300, this.parameters.prismAngle),
        device("screen", "screen", "색 스크린", 820, 300),
      ];
      case "diffraction": {
        const slit = device("slit", "slit", "이중 슬릿", 470, 300);
        slit.separation = this.parameters.slitSeparation / 3e-6;
        return [device("source", "source", "레이저", 140, 300), slit, device("screen", "screen", "무늬 스크린", 820, 300)];
      }
      case "polarization": return [
        device("source", "source", "편광된 빛", 130, 300),
        device("polarizer", "boundary", "첫 편광판", 390, 300),
        device("analyzer", "boundary", "회전 편광판", 590, 300, this.parameters.analyzerAngle),
        device("screen", "screen", "밝기 스크린", 820, 300),
      ];
      case "instruments": return [
        device("star", "source", "먼 별", 100, 250),
        device("objective", "lens", "대물렌즈", 390, 300),
        device("eyepiece", "lens", "접안렌즈", 630 + this.parameters.eyepieceFocalCm * CM_TO_PX, 300),
        device("eye", "screen", "눈", 850, 300),
      ];
      case "sandbox": return [
        device("sandbox-source", "source", "광원", 140, 280, 0, false),
        device("sandbox-screen", "screen", "스크린", 820, 280, 0, false),
      ];
    }
  }

  private syncControlledDevices(): void {
    const update = (id: string, values: Partial<LightDevice>) => Object.assign(this.devices.find((item) => item.id === id) ?? {}, values);
    update("source", { y: this.parameters.sourceY });
    if (this.sceneId === "refraction") update("source", { x: this.parameters.refractionSourceX });
    update("mirror", { angle: this.parameters.mirrorAngle });
    update("object", { x: this.parameters.objectX });
    update("prism", { angle: this.parameters.prismAngle });
    update("analyzer", { angle: this.parameters.analyzerAngle });
    update("slit", { separation: this.parameters.slitSeparation / 3e-6 });
    update("eyepiece", { x: 630 + this.parameters.eyepieceFocalCm * CM_TO_PX });
  }

  private controlHandle(): Point | null {
    switch (this.sceneId) {
      case "propagation": return { x: 120, y: this.parameters.sourceY };
      case "reflection": return pointAlong({ x: 500, y: 300 }, this.parameters.mirrorAngle, 75);
      case "refraction": return { x: this.parameters.refractionSourceX, y: 100 };
      case "lenses": return { x: this.parameters.objectX, y: 220 };
      case "prism": return pointAlong({ x: 500, y: 300 }, this.parameters.prismAngle, 75);
      case "diffraction": return { x: 470, y: 300 + this.parameters.slitSeparation / 6e-6 };
      case "polarization": return pointAlong({ x: 590, y: 300 }, this.parameters.analyzerAngle, 58);
      case "instruments": return { x: 630 + this.parameters.eyepieceFocalCm * CM_TO_PX, y: 420 - this.parameters.eyepieceFocalCm * 18 };
      default: return null;
    }
  }

  private propagationSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const source = { x: 120, y: this.parameters.sourceY };
    const aperture = { x: 480, y: 300 };
    const slope = (aperture.y - source.y) / (aperture.x - source.x);
    const screen = { x: 820, y: aperture.y + slope * (820 - aperture.x) };
    const graph = Array.from({ length: 17 }, (_, index) => {
      const x = index * 4.375;
      return { x, y: (source.y + slope * (x * CM_TO_PX) - 300) / CM_TO_PX };
    });
    return { rays: [{ from: source, to: screen, color: "#ffd34d", width: 4 }], graph, graphCurrent: graph.at(-1), graphValue: `스크린 높이 ${(screen.y - 300) / CM_TO_PX >= 0 ? "+" : ""}${((screen.y - 300) / CM_TO_PX).toFixed(1)} cm`, handle: this.controlHandle() };
  }

  private reflectionSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const source = { x: 150, y: 390 };
    const hit = { x: 500, y: 300 };
    const incident = Math.atan2(hit.y - source.y, hit.x - source.x);
    const normalAngle = this.parameters.mirrorAngle - Math.PI / 2;
    const outgoing = reflectedAngle(incident, normalAngle);
    const end = pointAlong(hit, outgoing, 430);
    const incidence = Math.abs(((incident - normalAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const acute = Math.min(incidence, Math.PI - incidence);
    const currentDegrees = degrees(acute);
    const graph = Array.from({ length: 19 }, (_, index) => ({ x: index * 5, y: index * 5 }));
    return {
      rays: [{ from: source, to: hit, color: "#ffd34d", width: 4 }, { from: hit, to: end, color: "#70d6ff", width: 4 }],
      graph, graphCurrent: { x: currentDegrees, y: currentDegrees }, graphValue: `입사각 = 반사각 ${currentDegrees.toFixed(1)}°`, handle: this.controlHandle(),
      normal: { from: pointAlong(hit, normalAngle, -90), to: pointAlong(hit, normalAngle, 90) },
    };
  }

  private refractionSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const source = { x: this.parameters.refractionSourceX, y: 100 };
    const hit = { x: 480, y: 300 };
    const incidentFromNormal = Math.atan2(hit.x - source.x, hit.y - source.y);
    const refracted = refractedAngle(incidentFromNormal, 1, 1.333)!;
    const end = { x: hit.x + Math.sin(refracted) * 310, y: hit.y + Math.cos(refracted) * 310 };
    const graph = Array.from({ length: 15 }, (_, index) => {
      const angle = 70 * Math.PI / 180 * index / 14;
      return { x: degrees(angle), y: degrees(refractedAngle(angle, 1, 1.333)!) };
    });
    return {
      rays: [{ from: source, to: hit, color: "#ffe066", width: 4 }, { from: hit, to: end, color: "#4cc9f0", width: 4 }],
      graph, graphCurrent: { x: degrees(incidentFromNormal), y: degrees(refracted) }, graphValue: `입사 ${degrees(incidentFromNormal).toFixed(1)}° → 굴절 ${degrees(refracted).toFixed(1)}°`, handle: this.controlHandle(),
      normal: { from: { x: hit.x, y: 210 }, to: { x: hit.x, y: 390 } },
    };
  }

  private lensSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const lensX = 480;
    const objectTop = { x: this.parameters.objectX, y: 220 };
    const objectDistancePx = lensX - objectTop.x;
    const focalPx = 120;
    const imageDistancePx = lensImageDistance(focalPx, objectDistancePx);
    const magnification = lensMagnification(imageDistancePx, objectDistancePx);
    const imageX = Number.isFinite(imageDistancePx) ? lensX + imageDistancePx : WIDTH + 200;
    const imageY = 300 + (objectTop.y - 300) * magnification;
    const parallelHit = { x: lensX, y: objectTop.y };
    const center = { x: lensX, y: 300 };
    const image = { x: imageX, y: 300, height: imageY - 300, virtual: imageDistancePx < 0 };
    const imageTop = { x: imageX, y: imageY };
    const currentDistanceCm = objectDistancePx / CM_TO_PX;
    const graph = Array.from({ length: 26 }, (_, index) => {
      const distance = 11 + index;
      const imageDistance = lensImageDistance(12, distance);
      return { x: distance, y: clamp(lensMagnification(imageDistance, distance), -6, 6) };
    });
    const forwardX = WIDTH;
    const centralForward = { x: forwardX, y: center.y + (center.y - objectTop.y) / (center.x - objectTop.x) * (forwardX - center.x) };
    const focus = { x: lensX + focalPx, y: 300 };
    const parallelForward = { x: forwardX, y: parallelHit.y + (focus.y - parallelHit.y) / (focus.x - parallelHit.x) * (forwardX - parallelHit.x) };
    const outgoing = Number.isFinite(imageDistancePx) && imageDistancePx > 0
      ? [{ from: center, to: imageTop, color: "#80ed99", width: 3 }, { from: parallelHit, to: imageTop, color: "#ffd166", width: 3 }]
      : [
          { from: center, to: centralForward, color: "#80ed99", width: 3 },
          { from: parallelHit, to: parallelForward, color: "#ffd166", width: 3 },
          ...(Number.isFinite(imageDistancePx) ? [
            { from: center, to: imageTop, color: "#80ed99", width: 2, dashed: true },
            { from: parallelHit, to: imageTop, color: "#ffd166", width: 2, dashed: true },
          ] : []),
        ];
    return {
      rays: [
        { from: objectTop, to: center, color: "#80ed99", width: 3 },
        outgoing[0],
        { from: objectTop, to: parallelHit, color: "#ffd166", width: 3 },
        outgoing[1],
        ...outgoing.slice(2),
      ],
      graph, graphCurrent: { x: currentDistanceCm, y: clamp(magnification, -6, 6) }, graphValue: `상거리 ${Number.isFinite(imageDistancePx) ? (imageDistancePx / CM_TO_PX).toFixed(1) : "∞"} cm · 배율 ${magnification.toFixed(2)}배`, handle: this.controlHandle(), image,
    };
  }

  private prismSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const source = { x: 130, y: 300 };
    const prism = { x: 500, y: 300 };
    const wavelengths = [650, 590, 540, 490, 440];
    const colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];
    const spectrum = wavelengths.map((wavelength) => {
      const index = 1.514 + (650 - wavelength) * 0.00009;
      const angle = normalizeAngle(this.parameters.prismAngle + prismDeviation(index, Math.PI / 3));
      return { wavelength, angle };
    });
    const graph = spectrum.map(({ wavelength, angle }) => ({ x: wavelength, y: degrees(angle) }));
    const rays: RaySegment[] = [{ from: source, to: prism, color: "#fff4d6", width: 7 }];
    spectrum.forEach((sample, index) => {
      rays.push({ from: prism, to: pointAlong(prism, sample.angle, 380), color: colors[index], width: 4 });
    });
    return { rays, graph, graphIsCurrentState: true, graphValue: `중심 ${degrees(this.parameters.prismAngle).toFixed(0)}° · 색 벌어짐 ${(Math.max(...graph.map((p) => p.y)) - Math.min(...graph.map((p) => p.y))).toFixed(1)}°`, handle: this.controlHandle() };
  }

  private diffractionSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const wavelength = 532e-9;
    const screenDistance = 1.2;
    const graph = Array.from({ length: 81 }, (_, index) => {
      const positionMm = (index - 40) * 0.3;
      const angle = Math.atan((positionMm / 1000) / screenDistance);
      return { x: positionMm, y: doubleSlitIntensity(angle, wavelength, this.parameters.slitSeparation, 45e-6) };
    });
    const slitOffset = this.parameters.slitSeparation / 6e-6;
    const upperSlit = { x: 470, y: 300 - slitOffset };
    const lowerSlit = { x: 470, y: 300 + slitOffset };
    return {
      rays: [
        { from: { x: 140, y: 300 }, to: upperSlit, color: "#ff70a6", width: 2 },
        { from: { x: 140, y: 300 }, to: lowerSlit, color: "#ff70a6", width: 2 },
        { from: upperSlit, to: { x: 820, y: 300 }, color: "#ff70a6", width: 1 },
        { from: lowerSlit, to: { x: 820, y: 300 }, color: "#ff70a6", width: 1 },
      ],
      graph, graphIsCurrentState: true, screenPattern: graph, graphValue: `슬릿 간격 ${(this.parameters.slitSeparation * 1e6).toFixed(0)} μm`, handle: this.controlHandle(),
    };
  }

  private polarizationSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const intensity = polarizedIntensity(1, this.parameters.analyzerAngle);
    const currentAngle = Math.abs(degrees(this.parameters.analyzerAngle));
    const graph = Array.from({ length: 19 }, (_, index) => {
      const angle = index * 10;
      return { x: angle, y: polarizedIntensity(100, angle * Math.PI / 180) };
    });
    return {
      rays: [
        { from: { x: 130, y: 300 }, to: { x: 390, y: 300 }, color: "#ffd166", width: 8 },
        { from: { x: 390, y: 300 }, to: { x: 590, y: 300 }, color: "#ffb347", width: 6 },
        { from: { x: 590, y: 300 }, to: { x: 820, y: 300 }, color: `rgba(255,159,28,${0.15 + intensity * 0.85})`, width: 3 + intensity * 7 },
      ],
      graph, graphCurrent: { x: currentAngle, y: intensity * 100 }, graphValue: `통과 밝기 ${(intensity * 100).toFixed(0)}%`, handle: this.controlHandle(), screenIntensity: intensity,
    };
  }

  private instrumentSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const objectiveFocalCm = 24;
    const magnification = telescopeMagnification(objectiveFocalCm, this.parameters.eyepieceFocalCm);
    const graph = Array.from({ length: 19 }, (_, index) => {
      const focal = 3 + 9 * index / 18;
      return { x: focal, y: Math.abs(telescopeMagnification(objectiveFocalCm, focal)) };
    });
    const objectiveX = 390;
    const focusX = 630;
    const eyepieceX = focusX + this.parameters.eyepieceFocalCm * CM_TO_PX;
    const eyeX = 850;
    const incomingAngle = 0.04;
    const incomingSlope = Math.tan(incomingAngle);
    const focus = { x: focusX, y: 300 + incomingSlope * 240 };
    const outgoingSlope = Math.tan(-incomingAngle * Math.abs(magnification));
    const objectiveHits = [250, 350];
    const rays: RaySegment[] = [];
    for (const hitY of objectiveHits) {
      const start = { x: 100, y: hitY - incomingSlope * (objectiveX - 100) };
      const objectiveHit = { x: objectiveX, y: hitY };
      const eyepieceHit = {
        x: eyepieceX,
        y: focus.y + (focus.y - hitY) / (focusX - objectiveX) * (eyepieceX - focusX),
      };
      rays.push(
        { from: start, to: objectiveHit, color: "#d8f3ff", width: 3 },
        { from: objectiveHit, to: focus, color: "#d8f3ff", width: 3 },
        { from: focus, to: eyepieceHit, color: "#a8dadc", width: 3 },
        { from: eyepieceHit, to: { x: eyeX, y: eyepieceHit.y + outgoingSlope * (eyeX - eyepieceX) }, color: "#a8dadc", width: 3 },
      );
    }
    return {
      rays,
      graph, graphCurrent: { x: this.parameters.eyepieceFocalCm, y: Math.abs(magnification) }, graphValue: `각배율 ${Math.abs(magnification).toFixed(1)}배`, handle: this.controlHandle(),
    };
  }

  private sandboxSnapshot(): Omit<LightSnapshot, "sceneId" | "devices" | "graphSeries"> {
    const sources = this.devices.filter((item) => item.kind === "source");
    const rays: RaySegment[] = [];
    const directions: number[] = [];
    for (const source of sources) {
      let current: Point = source;
      let direction = 0;
      let rayColor = "#ffe066";
      const visited = new Set<string>([source.id]);
      for (let step = 0; step < 12; step += 1) {
        const next = this.nextSandboxIntersection(current, direction, visited);
        if (!next) {
          rays.push({ from: current, to: pointAlong(current, direction, 300), color: rayColor, width: 3 });
          break;
        }
        const { item, hit } = next;
        visited.add(item.id);
        rays.push({ from: current, to: hit, color: rayColor, width: 3 });
        current = hit;
        if (item.kind === "screen") { directions.push(degrees(direction)); break; }
        if (item.kind === "mirror") {
          direction = reflectedAngle(direction, (item.angle ?? Math.PI / 2) - Math.PI / 2);
          rayColor = "#70d6ff";
        } else if (item.kind === "boundary") {
          const normal = (item.angle ?? Math.PI / 2) - Math.PI / 2;
          const relative = Math.atan2(Math.sin(direction - normal), Math.cos(direction - normal));
          const refracted = refractedAngle(relative, 1, 1.333);
          direction = refracted === null ? reflectedAngle(direction, normal) : normal + refracted;
          rayColor = "#4cc9f0";
        } else if (item.kind === "lens") {
          const focus = { x: item.x + Math.sign(Math.cos(direction) || 1) * 120, y: item.y };
          direction = Math.atan2(focus.y - hit.y, focus.x - hit.x);
          rayColor = "#80ed99";
        } else if (item.kind === "prism") {
          direction += prismDeviation(1.52, Math.PI / 3) * Math.sign((item.angle ?? 0) || 1);
          rayColor = "#b77bff";
        } else if (item.kind === "slit") {
          rayColor = "#ff70a6";
        }
        directions.push(degrees(direction));
        current = pointAlong(current, direction, 0.01);
      }
    }
    return {
      rays, graph: directions.length ? directions.map((angle, index) => ({ x: index + 1, y: angle })) : [{ x: 0, y: 0 }, { x: 1, y: 0 }], graphIsCurrentState: true,
      graphValue: `${this.devices.length}개 장치 · ${rays.length}개 광선 구간`, handle: null,
    };
  }

  private nextSandboxIntersection(
    origin: Point,
    direction: number,
    visited: ReadonlySet<string>,
  ): { item: LightDevice; hit: Point; distance: number } | null {
    const ray = { x: Math.cos(direction), y: Math.sin(direction) };
    const candidates: { item: LightDevice; hit: Point; distance: number }[] = [];
    for (const item of this.devices) {
      if (visited.has(item.id) || item.kind === "source") continue;
      let distance: number;
      let hit: Point;
      let offset: number;
      if (item.kind === "mirror" || item.kind === "boundary") {
        const tangentAngle = item.angle ?? Math.PI / 2;
        const tangent = { x: Math.cos(tangentAngle), y: Math.sin(tangentAngle) };
        const denominator = ray.x * tangent.y - ray.y * tangent.x;
        if (Math.abs(denominator) < 1e-9) continue;
        const delta = { x: item.x - origin.x, y: item.y - origin.y };
        distance = (delta.x * tangent.y - delta.y * tangent.x) / denominator;
        offset = (delta.x * ray.y - delta.y * ray.x) / denominator;
        hit = pointAlong(origin, direction, distance);
      } else {
        if (Math.abs(ray.x) < 1e-9) continue;
        distance = (item.x - origin.x) / ray.x;
        hit = pointAlong(origin, direction, distance);
        offset = hit.y - item.y;
      }
      const halfHeight = ({ mirror: 70, boundary: 90, lens: 92, prism: 65, slit: 100, screen: 110, source: 0 } as const)[item.kind];
      if (distance > 0.05 && Math.abs(offset) <= halfHeight) candidates.push({ item, hit, distance });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
  }

  private deviceLabel(kind: LightDeviceKind): string {
    return ({ source: "광원", mirror: "거울", boundary: "매질 경계", lens: "렌즈", prism: "프리즘", slit: "슬릿", screen: "스크린" })[kind];
  }
}
