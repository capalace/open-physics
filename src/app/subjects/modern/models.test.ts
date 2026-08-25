import { describe, expect, it } from "vitest";
import { MODERN_LAB_IDS } from "./catalog";
import { ModernModel } from "./models";
import { graphMarker, hitTest, primaryHandle } from "./renderer";

describe("modern-physics model", () => {
  it("resets each guided lab to its deterministic initial state", () => {
    for (const id of MODERN_LAB_IDS) {
      const model = new ModernModel(id); const initial = model.snapshot();
      model.dragPrimary(910, 100); model.step(0.1); model.reset();
      expect(model.snapshot()).toEqual(initial);
    }
  });
  it("maps the relativity pointer to a subluminal speed and the spacetime graph", () => {
    const model = new ModernModel("relativity"); const before = model.snapshot(); const handle = primaryHandle(before);
    expect(handle && hitTest(handle, { x: handle.x + 20, y: handle.y }, 30)).toBe(true);
    model.dragPrimary(900, 530); const after = model.snapshot();
    expect(after.speedFraction).toBeGreaterThan(before.speedFraction); expect(after.speedFraction).toBeLessThan(1);
    expect(after.gamma).toBeGreaterThan(before.gamma);
    expect(graphMarker(after)).not.toEqual(graphMarker(before));
  });
  it("uses each quantum input to change its physical result and visualization data", () => {
    const atoms = new ModernModel("atoms"); atoms.dragPrimary(930, 530); expect(atoms.snapshot().quantumNumber).toBe(6); expect(atoms.snapshot().transitionEnergy).toBeGreaterThan(13);
    const photo = new ModernModel("photoelectric"); photo.dragPrimary(70, 530); expect(photo.snapshot().electronEnergy).toBe(0); expect(photo.snapshot().detections).toHaveLength(0); photo.dragPrimary(930, 530); expect(photo.snapshot().detections.length).toBeGreaterThan(0);
    const matter = new ModernModel("matter-waves"); const longWave = matter.snapshot().wavelengthNm; matter.dragPrimary(930, 530); expect(matter.snapshot().wavelengthNm).toBeLessThan(longWave); expect(matter.snapshot().graph).not.toHaveLength(0);
    const quantum = new ModernModel("quantum"); const broad = quantum.snapshot().graph; quantum.dragPrimary(70, 530); expect(Math.max(...quantum.snapshot().graph.map((p) => p.y))).toBeGreaterThan(Math.max(...broad.map((p) => p.y)));
    const tunnel = new ModernModel("tunneling"); const thin = tunnel.snapshot().transmission; tunnel.dragPrimary(930, 530); expect(tunnel.snapshot().transmission).toBeLessThan(thin); expect(tunnel.snapshot().detections.length).toBeLessThan(12);
  });
  it("derives decay statistics and diode current from their direct controls", () => {
    const nuclei = new ModernModel("nuclei"); nuclei.dragPrimary(500, 530); expect(nuclei.snapshot().elapsedYears).toBeCloseTo(20); expect(nuclei.snapshot().remainingNuclei).toBeCloseTo(25);
    const diode = new ModernModel("semiconductors"); diode.dragPrimary(70, 530); const reverse = diode.snapshot().currentMilliamp; diode.dragPrimary(850, 530); expect(diode.snapshot().currentMilliamp).toBeGreaterThan(reverse + 1);
  });
  it("protects guided equipment", () => {
    const model = new ModernModel("photoelectric"); const lamp = model.snapshot().devices[0];
    expect(model.removeDevice(lamp.id)).toBe(false); expect(model.moveDevice(lamp.id, 400, 400)).toBe(false); expect(() => model.addDevice("atom")).toThrow("empty modern-physics laboratory");
  });
  it("adds, moves, and deletes every empty-lab palette device", () => {
    const model = new ModernModel("sandbox"); const kinds = ["photon-source", "metal", "atom", "barrier", "detector", "nucleus"] as const;
    const ids = kinds.map((kind) => model.addDevice(kind)); expect(model.snapshot().running).toBe(false);
    expect(model.snapshot().devices.map((d) => d.kind)).toEqual(["detector", ...kinds]);
    expect(model.moveDevice(ids[0], 730, 180)).toBe(true); expect(model.snapshot().devices.find((d) => d.id === ids[0])).toMatchObject({ x: 730, y: 180 });
    expect(model.removeDevice(ids[2])).toBe(true); expect(model.snapshot().devices.some((d) => d.id === ids[2])).toBe(false); expect(model.removeDevice("missing")).toBe(false);
  });
});
