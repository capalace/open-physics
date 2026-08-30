import { describe, expect, it } from "vitest";
import { LIGHT_LAB_IDS, type LightLabId } from "./catalog";
import { LightLabModel, type Point } from "./models";

const drags: Record<LightLabId, { from: Point; to: Point }> = {
  propagation: { from: { x: 120, y: 225 }, to: { x: 120, y: 380 } },
  reflection: { from: { x: 568, y: 267 }, to: { x: 520, y: 225 } },
  refraction: { from: { x: 250, y: 100 }, to: { x: 390, y: 100 } },
  "total-internal-reflection": { from: { x: 260, y: 500 }, to: { x: 420, y: 500 } },
  lenses: { from: { x: 260, y: 220 }, to: { x: 340, y: 220 } },
  prism: { from: { x: 575, y: 300 }, to: { x: 520, y: 225 } },
  diffraction: { from: { x: 470, y: 347 }, to: { x: 470, y: 390 } },
  polarization: { from: { x: 640, y: 329 }, to: { x: 590, y: 358 } },
  instruments: { from: { x: 680, y: 312 }, to: { x: 680, y: 250 } },
  laser: { from: { x: 422.4, y: 500 }, to: { x: 760, y: 500 } },
};

describe("light lab model", () => {
  it("builds deterministic prepared apparatus for every guided lab", () => {
    for (const id of LIGHT_LAB_IDS) {
      const model = new LightLabModel(id);
      const first = model.snapshot();
      model.pointerDown(drags[id].from);
      model.pointerMove(drags[id].to);
      model.pointerUp();
      model.reset();
      expect(model.snapshot()).toEqual(first);
      expect(first.devices.length).toBeGreaterThanOrEqual(3);
      expect(first.devices.every((device) => device.protected)).toBe(true);
      expect(first.rays.length).toBeGreaterThan(0);
      expect(first.graph.length).toBeGreaterThan(1);
    }
  });

  it("offers every guided control as a normalized keyboard-operable value", () => {
    for (const id of LIGHT_LAB_IDS) {
      const model = new LightLabModel(id);
      model.setPrimaryControlRatio(0);
      expect(model.primaryControlRatio(), `${id} low`).toBeCloseTo(0);
      model.setPrimaryControlRatio(1);
      expect(model.primaryControlRatio(), `${id} high`).toBeCloseTo(1);
      expect(model.snapshot().graphValue.length).toBeGreaterThan(0);
    }
  });

  it("uses each lab's pointer handle to change both physical output and graph snapshot", () => {
    for (const id of LIGHT_LAB_IDS) {
      const model = new LightLabModel(id);
      const before = model.snapshot();
      expect(model.pointerDown(drags[id].from), `${id} handle`).toBe(true);
      expect(model.pointerMove(drags[id].to), `${id} drag`).toBe(true);
      model.pointerUp();
      const after = model.snapshot();
      expect(after.graphValue, `${id} physical value`).not.toBe(before.graphValue);
      expect({ graph: after.graph, current: after.graphCurrent }, `${id} graph`).not.toEqual({ graph: before.graph, current: before.graphCurrent });
      expect({ rays: after.rays, image: after.image, pattern: after.screenPattern, intensity: after.screenIntensity }, `${id} Canvas output`)
        .not.toEqual({ rays: before.rays, image: before.image, pattern: before.screenPattern, intensity: before.screenIntensity });
    }
  });

  it("places the real lens image at the intersection of both principal rays", () => {
    const snapshot = new LightLabModel("lenses").snapshot();
    expect(snapshot.image).toMatchObject({ x: 744, y: 300, height: 96, virtual: false });
    expect(snapshot.rays[1].to).toEqual({ x: 744, y: 396 });
    expect(snapshot.rays[3].to).toEqual({ x: 744, y: 396 });
    expect(snapshot.graphCurrent).toEqual({ x: 22, y: -1.2 });
  });

  it("uses the same prism output angles for the spectrum graph and Canvas rays", () => {
    const snapshot = new LightLabModel("prism").snapshot();
    const coloredRays = snapshot.rays.slice(1);
    coloredRays.forEach((ray, index) => {
      const canvasAngle = Math.atan2(ray.to.y - ray.from.y, ray.to.x - ray.from.x) * 180 / Math.PI;
      expect(canvasAngle).toBeCloseTo(snapshot.graph[index].y, 6);
    });
  });

  it("keeps the diffraction handle, two slit centers, rays, and physical separation in one round trip", () => {
    const model = new LightLabModel("diffraction");
    const before = model.snapshot();
    expect(model.pointerDown(before.handle!)).toBe(true);
    expect(model.pointerMove(before.handle!)).toBe(true);
    model.pointerUp();
    const after = model.snapshot();
    expect(after.graphValue).toBe(before.graphValue);
    expect(after.devices.find((item) => item.id === "slit")?.separation).toBeCloseTo(280 / 3, 6);
    expect(after.rays[2].from.y).toBeCloseTo(300 - 280 / 6, 10);
    expect(after.rays[3].from.y).toBeCloseTo(300 + 280 / 6, 10);
  });

  it("describes every graph with its catalog series and a current relation or current distribution", () => {
    for (const id of LIGHT_LAB_IDS) {
      const snapshot = new LightLabModel(id).snapshot();
      expect(snapshot.graphSeries.label.length).toBeGreaterThan(0);
      expect(snapshot.graphSeries.color).toMatch(/^#/);
      expect(Boolean(snapshot.graphCurrent) || snapshot.graphIsCurrentState).toBe(true);
    }
  });

  it("protects guided apparatus from deletion", () => {
    const model = new LightLabModel("reflection");
    expect(model.removeDevice("mirror")).toBe(false);
    expect(model.snapshot().devices.some((item) => item.id === "mirror")).toBe(true);
  });

  it("starts a clean sandbox and can add, move, and delete every optical device", () => {
    const model = new LightLabModel("reflection");
    model.load("sandbox");
    expect(model.snapshot().devices.map((item) => item.kind)).toEqual(["source", "screen"]);

    for (const kind of ["source", "mirror", "boundary", "lens", "prism", "slit", "screen"] as const) {
      expect(model.addDevice(kind)?.kind).toBe(kind);
    }
    const prism = model.snapshot().devices.find((item) => item.id === "sandbox-prism-5")!;
    expect(model.pointerDown(prism)).toBe(true);
    expect(model.pointerMove({ x: 700, y: 160 })).toBe(true);
    model.pointerUp();
    expect(model.snapshot().devices.find((item) => item.id === prism.id)).toMatchObject({ x: 700, y: 160 });
    expect(model.removeDevice(prism.id)).toBe(true);
    expect(model.snapshot().devices.some((item) => item.id === prism.id)).toBe(false);
  });

  it("does not carry guided devices into the sandbox", () => {
    const model = new LightLabModel("lenses");
    expect(model.snapshot().devices.some((item) => item.id === "lens")).toBe(true);
    model.load("sandbox");
    expect(model.snapshot().devices.some((item) => item.id === "lens")).toBe(false);
  });

  it("uses optical laws when sandbox rays meet an added apparatus", () => {
    const model = new LightLabModel("sandbox");
    model.addDevice("mirror");
    const snapshot = model.snapshot();
    const reflected = snapshot.rays.at(-1)!;
    expect(reflected.color).toBe("#70d6ff");
    expect(reflected.to.x).toBeLessThan(reflected.from.x);
    expect(snapshot.graph.some((point) => Math.abs(point.y) > 90)).toBe(true);
  });

  it("recalculates sandbox traversal when apparatus position and order change", () => {
    const model = new LightLabModel("sandbox");
    const lens = model.addDevice("lens")!;
    model.addDevice("screen");
    const before = model.snapshot();
    expect(model.pointerDown(lens)).toBe(true);
    expect(model.pointerMove({ x: 700, y: 160 })).toBe(true);
    model.pointerUp();
    const after = model.snapshot();
    expect(after.rays).not.toEqual(before.rays);
    expect(after.graph).not.toEqual(before.graph);
    expect(after.graphSeries).toEqual({ label: "광선 진행 방향", color: "#ffe066" });
  });

  it("continues a reflected sandbox ray to a screen behind the source and ignores a missed screen", () => {
    const model = new LightLabModel("sandbox");
    const originalScreen = model.snapshot().devices.find((item) => item.id === "sandbox-screen")!;
    expect(model.pointerDown(originalScreen)).toBe(true);
    model.pointerMove({ x: 60, y: 280 });
    model.pointerUp();
    const mirror = model.addDevice("mirror")!;
    expect(model.pointerDown(mirror)).toBe(true);
    model.pointerMove({ x: 500, y: 280 });
    model.pointerUp();
    const reflected = model.snapshot().rays.at(-1)!;
    expect(reflected.color).toBe("#70d6ff");
    expect(reflected.to.x).toBeCloseTo(60, 8);
    expect(reflected.to.y).toBeCloseTo(280, 8);

    expect(model.pointerDown(model.snapshot().devices.find((item) => item.id === "sandbox-screen")!)).toBe(true);
    model.pointerMove({ x: 60, y: 30 });
    model.pointerUp();
    expect(model.snapshot().rays.at(-1)?.to.x).toBeGreaterThan(100);
  });

  it("traces two parallel telescope rays through a shared focus and the movable eyepiece", () => {
    const model = new LightLabModel("instruments");
    const before = model.snapshot();
    expect(before.rays).toHaveLength(8);
    expect(before.rays[1].to).toEqual(before.rays[5].to);
    const incomingSlopes = [before.rays[0], before.rays[4]].map((ray) => (ray.to.y - ray.from.y) / (ray.to.x - ray.from.x));
    expect(incomingSlopes[0]).toBeCloseTo(incomingSlopes[1], 10);
    expect(before.devices.find((item) => item.id === "eyepiece")?.x).toBe(690);
    expect(model.pointerDown(before.handle!)).toBe(true);
    model.pointerMove({ x: before.handle!.x, y: 250 });
    model.pointerUp();
    const after = model.snapshot();
    expect(after.devices.find((item) => item.id === "eyepiece")?.x).not.toBe(690);
    expect(after.graphCurrent).not.toEqual(before.graphCurrent);
    expect(after.rays).not.toEqual(before.rays);
  });
});
