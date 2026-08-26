import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import { WAVES_LAB_IDS, wavesDefinition } from "./catalog";

describe("waves catalog", () => {
  it("contains every guided waves lab exactly once", () => {
    expect(wavesDefinition.labs.map((lab) => lab.id)).toEqual(WAVES_LAB_IDS);
    expect(() => validateSubjectDefinition(wavesDefinition, WAVES_LAB_IDS)).not.toThrow();
  });

  it("gives every lab a distinct direct control and graph", () => {
    expect(new Set(wavesDefinition.labs.map((lab) => lab.controls[0])).size).toBe(WAVES_LAB_IDS.length);
    expect(new Set(wavesDefinition.labs.map((lab) => lab.graph.title)).size).toBe(WAVES_LAB_IDS.length);
    for (const lab of wavesDefinition.labs) {
      expect(lab.steps).toHaveLength(3);
      expect(lab.graph.xLabel).toMatch(/\(.+\)/);
      expect(lab.graph.yLabel.length).toBeGreaterThan(3);
    }
  });

  it("offers an empty waves laboratory at the same catalog level", () => {
    expect(wavesDefinition.sandboxTitle).toBe("빈 실험실 만들기");
    expect(wavesDefinition.sandboxDescription).toContain("파원");
  });
});
