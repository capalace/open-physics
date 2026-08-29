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

  it("keeps every primary value unchanged when its visible handle is pressed without moving", () => {
    for (const id of ["source", "interference", "sound", "doppler"] as const) {
      const model = new WavesModel(id);
      const before = model.snapshot();
      const handle = primaryHandle(before)!;
      model.dragPrimary(handle.x, handle.y);
      const after = model.snapshot();
      expect(after.amplitude, `${id} amplitude`).toBeCloseTo(before.amplitude);
      expect(after.sourceSpacing, `${id} spacing`).toBeCloseTo(before.sourceSpacing);
      expect(after.sourceVelocity, `${id} velocity`).toBeCloseTo(before.sourceVelocity);
    }
  });

  it("keeps interference sources symmetric around the displayed center", () => {
    const model = new WavesModel("interference");
    model.dragPrimary(180, 470);
    const snapshot = model.snapshot();
    const sources = snapshot.devices.filter((item) => item.kind === "source" || item.kind === "second-source");
    expect(sources[0].y + sources[1].y).toBeCloseTo(600);
    expect(sources[1].y - sources[0].y).toBeCloseTo(snapshot.sourceSpacing);
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

  it("marks the current propagation, resonance, and Doppler choice in changing graph data", () => {
    for (const id of ["propagation", "resonance", "doppler"] as const) {
      const model = new WavesModel(id);
      const before = model.snapshot().graph;
      model.dragPrimary(880, 300);
      const after = model.snapshot();
      expect(after.graph, id).not.toEqual(before);
      expect(after.graph.filter((point) => point.current), id).toHaveLength(1);
    }
  });

  it("uses a stable time-averaged interference pattern with both reinforcement and cancellation", () => {
    const model = new WavesModel("interference");
    const initial = model.snapshot().graph.map((point) => point.y);
    model.step(0.073);
    const later = model.snapshot().graph.map((point) => point.y);
    expect(later).toEqual(initial);
    expect(Math.min(...initial)).toBeLessThan(Math.max(...initial) * 0.15);
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
    ids.forEach((id, index) => {
      expect(model.moveDevice(id, 700 - index * 45, 180 + index * 55)).toBe(true);
      expect(model.snapshot().devices.find((item) => item.id === id)).toMatchObject({
        x: 700 - index * 45,
        y: 180 + index * 55,
      });
    });
    const fieldWithTwoSources = model.displacementAt(8, 2);
    expect(model.removeDevice(ids[1])).toBe(true);
    expect(model.snapshot().devices.some((item) => item.id === ids[1])).toBe(false);
    expect(model.displacementAt(8, 2)).not.toBeCloseTo(fieldWithTwoSources);
    ids.filter((id) => id !== ids[1]).forEach((id) => expect(model.removeDevice(id)).toBe(true));
    expect(model.snapshot().devices).toHaveLength(1);
    expect(model.removeDevice("missing")).toBe(false);
  });

  it("connects sandbox media, boundaries, observers, and detectors to calculation and measurement", () => {
    const model = new WavesModel("sandbox");
    model.removeDevice("sandbox-medium");
    model.addDevice("source");
    const openField = model.snapshot().graph;
    const medium = model.addDevice("medium");
    const slowedField = model.snapshot().graph;
    expect(slowedField).not.toEqual(openField);
    model.moveDevice(medium, 820, 500);
    expect(model.snapshot().graph).not.toEqual(slowedField);

    const beforeBoundary = model.snapshot().graph;
    const boundary = model.addDevice("boundary");
    const reflectedField = model.snapshot().graph;
    expect(reflectedField).not.toEqual(beforeBoundary);
    model.moveDevice(boundary, 780, 300);
    expect(model.snapshot().graph).not.toEqual(reflectedField);

    const detector = model.addDevice("detector");
    const observer = model.addDevice("observer");
    expect(model.snapshot().graph.some((point) => point.current)).toBe(true);
    expect(model.snapshot().measurement).toContain("검출기");
    expect(model.snapshot().measurement).toContain("관찰자");
    const probeReading = model.snapshot().measurement;
    model.moveDevice(detector, 850, 260);
    expect(model.snapshot().measurement).not.toBe(probeReading);
    model.setRunning(true);
    expect(model.snapshot().measurement).not.toContain("멈춤");
    expect(model.removeDevice(detector)).toBe(true);
    expect(model.removeDevice(observer)).toBe(true);
  });
});
