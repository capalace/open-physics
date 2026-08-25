import { describe, expect, it } from "vitest";
import { MECHANICS_LABS, mechanicsLab, shouldAutoPlayLab } from "./mechanics-labs";

describe("mechanics labs", () => {
  it("defines ten distinct experiments with actionable learning content", () => {
    expect(MECHANICS_LABS).toHaveLength(10);
    expect(new Set(MECHANICS_LABS.map((lab) => lab.id)).size).toBe(10);
    for (const lab of MECHANICS_LABS) {
      expect(lab.question.endsWith("까요?")).toBe(true);
      expect(lab.steps).toHaveLength(3);
      expect(lab.steps.every((step) => step.length >= 10)).toBe(true);
      expect(lab.observe.length).toBeGreaterThan(20);
      expect(lab.controls.length).toBeGreaterThan(0);
      expect(lab.law.title.length).toBeGreaterThan(1);
      expect(lab.law.description.length).toBeGreaterThan(10);
      expect(lab.law.equation.length).toBeGreaterThan(2);
    }
  });

  it("exposes only controls that change the selected experiment", () => {
    expect(mechanicsLab("pulley").controls).toEqual(["mass"]);
    expect(mechanicsLab("orbit").controls).toEqual(["velocity"]);
    expect(mechanicsLab("friction").controls).toContain("material");
    expect(mechanicsLab("free-fall").controls).toContain("gravity");
  });

  it("keeps the initial lab stable but auto-plays labs selected by the learner", () => {
    expect(shouldAutoPlayLab("initial")).toBe(false);
    expect(shouldAutoPlayLab("selection")).toBe(true);
  });
});
