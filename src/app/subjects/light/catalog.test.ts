import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import { LIGHT_LAB_IDS, lightDefinition } from "./catalog";

describe("light lab catalog", () => {
  it("contains all eight guideline labs exactly once", () => {
    expect(lightDefinition.labs.map((lab) => lab.id)).toEqual(LIGHT_LAB_IDS);
    expect(() => validateSubjectDefinition(lightDefinition, LIGHT_LAB_IDS)).not.toThrow();
  });

  it("gives each lab a distinct inquiry, direct control, and measurable graph", () => {
    expect(new Set(lightDefinition.labs.map((lab) => lab.question)).size).toBe(8);
    expect(new Set(lightDefinition.labs.map((lab) => lab.graph.title)).size).toBe(8);
    for (const lab of lightDefinition.labs) {
      expect(lab.steps).toHaveLength(3);
      expect(lab.controls.length).toBeGreaterThan(0);
      expect(lab.graph.xLabel).toMatch(/\(.+\)/);
      expect(lab.graph.yLabel).toMatch(/\(.+\)|상대 세기/);
      expect(lab.law.equation.length).toBeGreaterThan(3);
    }
  });

  it("advertises the empty light laboratory at the same catalog level", () => {
    expect(lightDefinition.sandboxTitle).toBe("빈 실험실 만들기");
    expect(lightDefinition.sandboxDescription).toContain("광원");
  });
});
