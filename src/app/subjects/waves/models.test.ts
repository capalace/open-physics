import { describe, expect, it } from "vitest";
import { WAVES_LAB_IDS } from "./catalog";
import { WavesModel } from "./models";
import { hitTest, primaryHandle } from "./renderer";

describe("waves model", () => {
  it("resets every guided experiment to the same deterministic state", () => {
    for (const id of WAVES_LAB_IDS) {
      const model = new WavesModel(id);
      const initial = model.snapshot();
      model.dragPrimary(870, 90);
      model.step(0.1);
      model.reset();
      expect(model.snapshot()).toEqual(initial);
    }
  });

  it("uses a pointer drag to change the source amplitude, scene wave and graph", () => {
    const model = new WavesModel("source");
    const before = model.snapshot();
    const handle = primaryHandle(before);
    expect(handle && hitTest(handle, { x: handle.x + 20, y: handle.y }, 30)).toBe(true);
    const displacementBefore = model.displacementAt(0.9);
    model.dragPrimary(120, 70);
    const after = model.snapshot();
    expect(after.amplitude).toBeGreaterThan(before.amplitude);
    expect(model.displacementAt(0.9)).not.toBeCloseTo(displacementBefore);
    expect(after.graph.map((point) => point.y)).not.toEqual(before.graph.map((point) => point.y));
  });

  it("derives each experiment's result from its own independent variable", () => {
    const propagation = new WavesModel("propagation");
    const oldWavelength = propagation.snapshot().wavelength;
    propagation.dragPrimary(900, 300);
    expect(propagation.snapshot().wavelength).toBeGreaterThan(oldWavelength);

    const interference = new WavesModel("interference");
    const oldPattern = interference.snapshot().graph;
    interference.dragPrimary(180, 520);
    expect(interference.snapshot().graph).not.toEqual(oldPattern);

    const standing = new WavesModel("standing-wave");
    const oldStandingGraph = standing.snapshot().graph;
    standing.dragPrimary(950, 500);
    expect(standing.snapshot().harmonic).toBe(5);
    expect(standing.snapshot().graph).not.toEqual(oldStandingGraph);
    expect(standing.snapshot().measurement).toContain("62.5 Hz");

    const resonance = new WavesModel("resonance");
    resonance.dragPrimary(500, 500);
    expect(resonance.snapshot().frequency).toBe(5);
    expect(resonance.snapshot().response).toBeGreaterThan(4);

    const sound = new WavesModel("sound");
    const oldIntensity = sound.snapshot().response;
    sound.dragPrimary(140, 80);
    expect(sound.snapshot().response).toBeGreaterThan(oldIntensity);

    const doppler = new WavesModel("doppler");
    doppler.dragPrimary(720, 300);
    expect(doppler.snapshot().observedFrequency).toBeGreaterThan(doppler.snapshot().frequency);
  });

  it("keeps guided apparatus protected", () => {
    const model = new WavesModel("sound");
    const speaker = model.snapshot().devices[0];
    expect(model.removeDevice(speaker.id)).toBe(false);
    expect(model.moveDevice(speaker.id, 500, 500)).toBe(false);
    expect(() => model.addDevice("source")).toThrow("empty wave laboratory");
  });

  it("adds, moves, and removes every palette device in the empty laboratory", () => {
    const model = new WavesModel("sandbox");
    const kinds = ["source", "second-source", "medium", "boundary", "observer", "detector"] as const;
    const ids = kinds.map((kind) => model.addDevice(kind));
    expect(model.snapshot().running).toBe(false);
    expect(model.snapshot().devices.map((item) => item.kind)).toEqual(["medium", ...kinds]);
    expect(model.moveDevice(ids[0], 740, 210)).toBe(true);
    expect(model.snapshot().devices.find((item) => item.id === ids[0])).toMatchObject({ x: 740, y: 210 });
    const fieldWithTwoSources = model.displacementAt(8, 2);
    expect(model.removeDevice(ids[1])).toBe(true);
    expect(model.snapshot().devices.some((item) => item.id === ids[1])).toBe(false);
    expect(model.displacementAt(8, 2)).not.toBeCloseTo(fieldWithTwoSources);
    expect(model.removeDevice("missing")).toBe(false);
  });
});
