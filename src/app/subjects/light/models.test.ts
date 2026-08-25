import { describe, expect, it } from "vitest";
import { LIGHT_LAB_IDS, type LightLabId } from "./catalog";
import { LightLabModel, type Point } from "./models";

const drags: Record<LightLabId, { from: Point; to: Point }> = {
  propagation: { from: { x: 120, y: 225 }, to: { x: 120, y: 380 } },
  reflection: { from: { x: 568, y: 267 }, to: { x: 520, y: 225 } },
  refraction: { from: { x: 250, y: 100 }, to: { x: 390, y: 100 } },
  lenses: { from: { x: 260, y: 220 }, to: { x: 340, y: 220 } },
  prism: { from: { x: 575, y: 300 }, to: { x: 520, y: 225 } },
  diffraction: { from: { x: 470, y: 347 }, to: { x: 470, y: 390 } },
  polarization: { from: { x: 640, y: 329 }, to: { x: 590, y: 358 } },
  instruments: { from: { x: 680, y: 312 }, to: { x: 680, y: 250 } },
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

  it("uses each lab's pointer handle to change both physical output and graph snapshot", () => {
    for (const id of LIGHT_LAB_IDS) {
      const model = new LightLabModel(id);
      const before = model.snapshot();
      expect(model.pointerDown(drags[id].from), `${id} handle`).toBe(true);
      expect(model.pointerMove(drags[id].to), `${id} drag`).toBe(true);
      model.pointerUp();
      const after = model.snapshot();
      expect(after.graphValue, `${id} physical value`).not.toBe(before.graphValue);
      expect(after.graph, `${id} graph`).not.toEqual(before.graph);
      expect({ rays: after.rays, image: after.image, pattern: after.screenPattern, intensity: after.screenIntensity }, `${id} Canvas output`)
        .not.toEqual({ rays: before.rays, image: before.image, pattern: before.screenPattern, intensity: before.screenIntensity });
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
});
