import { describe, expect, it } from "vitest";
import { MODERN_LAB_IDS } from "./catalog";
import { deterministicDensityQuantiles, ModernModel } from "./models";
import { graphMarker, hitTest, modernInteractionAffordance, modernVisualPhase, primaryHandle } from "./renderer";

describe("modern-physics model", () => {
  it("distinguishes movable apparatus from dedicated value handles", () => {
    const kinds = Object.fromEntries(MODERN_LAB_IDS.map((id) => [id, modernInteractionAffordance(new ModernModel(id).snapshot())?.kind]));
    expect(kinds).toEqual({
      relativity: "object", "gravity-spacetime": "handle", atoms: "handle", photoelectric: "object",
      "matter-waves": "object", quantum: "handle", tunneling: "object", nuclei: "object",
      "mass-energy": "handle", semiconductors: "handle",
    });
  });

  it("resets each guided lab to its deterministic initial state", () => {
    for (const id of MODERN_LAB_IDS) {
      const model = new ModernModel(id); const initial = model.snapshot();
      model.dragPrimary(910, 100); model.step(0.1); model.reset();
      expect(model.snapshot()).toEqual(initial);
    }
  });
  it("advances visual phases and nuclear decay only while running", () => {
    const model = new ModernModel("nuclei");
    const before = model.snapshot();
    model.step(0.2);
    const moving = model.snapshot();
    expect(modernVisualPhase(moving.animationTime)).not.toBe(modernVisualPhase(before.animationTime));
    expect(moving.elapsedYears).toBeGreaterThan(before.elapsedYears);
    model.setRunning(false); model.step(0.2);
    expect(model.snapshot().animationTime).toBe(moving.animationTime);
    expect(model.snapshot().elapsedYears).toBe(moving.elapsedYears);
  });
  it("maps the relativity pointer to a subluminal speed and the spacetime graph", () => {
    const model = new ModernModel("relativity"); const before = model.snapshot(); const handle = primaryHandle(before);
    expect(handle && hitTest(handle, { x: handle.x + 20, y: handle.y }, 30)).toBe(true);
    model.dragPrimary(900, 530); const after = model.snapshot();
    expect(after.speedFraction).toBeGreaterThan(before.speedFraction); expect(after.speedFraction).toBeLessThan(1);
    expect(after.gamma).toBeGreaterThan(before.gamma);
    expect(graphMarker(after)).not.toEqual(graphMarker(before));
  });
  it("round-trips all ten apparatus-attached primary handles without changing the model", () => {
    for (const id of MODERN_LAB_IDS) {
      const model = new ModernModel(id); const before = model.snapshot(); const handle = primaryHandle(before)!;
      model.dragPrimary(handle.x, handle.y); const after = model.snapshot(); const afterHandle = primaryHandle(after)!;
      expect(afterHandle.x, `${id} x`).toBeCloseTo(handle.x);
      expect(afterHandle.y, `${id} y`).toBeCloseTo(handle.y);
      expect(after.measurement, id).toBe(before.measurement);
    }
  });
  it("places primary handles on the apparatus described by each lab", () => {
    const relativity = new ModernModel("relativity").snapshot();
    expect(primaryHandle(relativity)).toMatchObject(relativity.devices.find((item) => item.id === "ship-clock")!);
    const atoms = new ModernModel("atoms").snapshot();
    expect(primaryHandle(atoms)?.y).not.toBe(530);
    const photo = new ModernModel("photoelectric").snapshot();
    expect(primaryHandle(photo)).toMatchObject(photo.devices.find((item) => item.kind === "photon-source")!);
    const matter = new ModernModel("matter-waves").snapshot();
    expect(primaryHandle(matter)).toMatchObject(matter.devices.find((item) => item.kind === "photon-source")!);
    const tunnel = new ModernModel("tunneling").snapshot();
    expect(primaryHandle(tunnel)).toEqual({ x: 550 + tunnel.barrierWidth * 240, y: 300 });
    const nuclei = new ModernModel("nuclei").snapshot();
    expect(primaryHandle(nuclei)).toMatchObject(nuclei.devices.find((item) => item.kind === "detector")!);
  });
  it("uses each quantum input to change its physical result and visualization data", () => {
    const atoms = new ModernModel("atoms"); atoms.dragPrimary(200, 138); expect(atoms.snapshot().quantumNumber).toBe(6); expect(atoms.snapshot().transitionEnergy).toBeGreaterThan(13);
    const photo = new ModernModel("photoelectric"); photo.dragPrimary(100, 300); expect(photo.snapshot().electronEnergy).toBe(0); expect(photo.snapshot().detections).toHaveLength(0); photo.dragPrimary(400, 300); expect(photo.snapshot().detections.length).toBeGreaterThan(0);
    const matter = new ModernModel("matter-waves"); const longWave = matter.snapshot().wavelengthNm; matter.dragPrimary(400, 300); expect(matter.snapshot().wavelengthNm).toBeLessThan(longWave); expect(matter.snapshot().graph).not.toHaveLength(0);
    const quantum = new ModernModel("quantum"); const broad = quantum.snapshot().graph; const broadMomentum = quantum.snapshot().momentumUncertainty; quantum.dragPrimary(542, 300); expect(Math.max(...quantum.snapshot().graph.map((p) => p.y))).toBeGreaterThan(Math.max(...broad.map((p) => p.y))); expect(quantum.snapshot().momentumUncertainty).toBeGreaterThan(broadMomentum);
    const tunnel = new ModernModel("tunneling"); const thin = tunnel.snapshot().transmission; tunnel.dragPrimary(694, 300); expect(tunnel.snapshot().transmission).toBeLessThan(thin); expect(tunnel.snapshot().detections.length).toBeLessThan(12);
  });
  it("derives decay statistics and diode current from their direct controls", () => {
    const nuclei = new ModernModel("nuclei"); nuclei.dragPrimary(750, 300); expect(nuclei.snapshot().elapsedYears).toBeCloseTo(20); expect(nuclei.snapshot().remainingNuclei).toBeCloseTo(25);
    const diode = new ModernModel("semiconductors"); diode.dragPrimary(300, 450); const reverse = diode.snapshot().currentMilliamp; diode.dragPrimary(700, 450); expect(diode.snapshot().currentMilliamp).toBeGreaterThan(reverse + 1);
  });
  it("links gravity and mass defect controls to their curriculum results", () => {
    const gravity = new ModernModel("gravity-spacetime"); const slow = gravity.snapshot().gravityClockRate;
    gravity.dragPrimary(800, 500); expect(gravity.snapshot().gravityClockRate).toBeLessThan(slow);
    const energy = new ModernModel("mass-energy"); energy.dragPrimary(200, 500); const low = energy.snapshot().releasedEnergyMeV;
    energy.dragPrimary(800, 500); expect(energy.snapshot().releasedEnergyMeV).toBeGreaterThan(low);
  });
  it("protects guided equipment", () => {
    const model = new ModernModel("photoelectric"); const lamp = model.snapshot().devices[0];
    expect(model.removeDevice(lamp.id)).toBe(false); expect(model.moveDevice(lamp.id, 400, 400)).toBe(false); expect(() => model.addDevice("atom")).toThrow("empty modern-physics laboratory");
  });
  it("adds, moves, and deletes every empty-lab palette device", () => {
    const model = new ModernModel("sandbox"); const kinds = ["photon-source", "metal", "atom", "barrier", "detector", "nucleus"] as const;
    const ids = kinds.map((kind) => model.addDevice(kind)); expect(model.snapshot().running).toBe(false);
    expect(model.snapshot().devices.map((d) => d.kind)).toEqual(["detector", ...kinds]);
    ids.forEach((id, index) => { expect(model.moveDevice(id, 720 - index * 60, 170 + index * 55)).toBe(true); expect(model.snapshot().devices.find((d) => d.id === id)).toMatchObject({ x: 720 - index * 60, y: 170 + index * 55 }); });
    ids.forEach((id) => expect(model.removeDevice(id)).toBe(true));
    expect(model.snapshot().devices).toHaveLength(1); expect(model.removeDevice("missing")).toBe(false);
  });
  it("connects every sandbox device position and combination to detection, graph, and measurement", () => {
    const model = new ModernModel("sandbox");
    const detector = model.snapshot().devices[0].id;
    const source = model.addDevice("photon-source"); model.moveDevice(source, 100, 300);
    const direct = model.snapshot();
    const metal = model.addDevice("metal"); model.moveDevice(metal, 330, 300); const withMetal = model.snapshot();
    expect(withMetal.graph).not.toEqual(direct.graph);
    const atom = model.addDevice("atom"); model.moveDevice(atom, 470, 300); const withAtom = model.snapshot();
    expect(withAtom.graph).not.toEqual(withMetal.graph);
    const barrier = model.addDevice("barrier"); model.moveDevice(barrier, 620, 300); const withBarrier = model.snapshot();
    expect(withBarrier.graph).not.toEqual(withAtom.graph);
    const nucleus = model.addDevice("nucleus"); model.moveDevice(nucleus, 730, 300); const withNucleus = model.snapshot();
    expect(withNucleus.graph).not.toEqual(withBarrier.graph);
    expect(withNucleus.measurement).toContain("검출 신호");

    for (const [id, x, y] of [[source, 100, 120], [metal, 330, 500], [atom, 470, 500], [barrier, 620, 500], [nucleus, 730, 500]] as const) {
      const beforeMove = model.snapshot().graph;
      model.moveDevice(id, x, y);
      expect(model.snapshot().graph, id).not.toEqual(beforeMove);
    }

    model.setRunning(true); model.step(0.1); const running = model.snapshot();
    expect(running.measurement).toContain("실행 중");
    expect(running.detections.length).toBeGreaterThan(0);
    model.moveDevice(detector, 900, 500);
    expect(model.snapshot().graph).not.toEqual(running.graph);
  });
  it("samples matter-wave detections from the same deterministic probability density", () => {
    expect(deterministicDensityQuantiles([{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 0 }], 3)).toEqual([1, 1, 1]);
    const model = new ModernModel("matter-waves"); const first = model.snapshot().detections;
    model.reset(); expect(model.snapshot().detections).toEqual(first);
    model.dragPrimary(900, 300); expect(model.snapshot().detections).not.toEqual(first);
  });
});
