import { describe, expect, it } from "vitest";
import {
  MECHANICS_LABS,
  mechanicsInteractionTip,
  mechanicsLab,
  mechanicsSettingFeedback,
  shouldAutoPlayLab,
} from "./mechanics-labs";

describe("mechanics labs", () => {
  it("defines ten distinct experiments with actionable learning content", () => {
    expect(MECHANICS_LABS).toHaveLength(10);
    expect(new Set(MECHANICS_LABS.map((lab) => lab.id)).size).toBe(10);
    for (const lab of MECHANICS_LABS) {
      expect(lab.question.endsWith("까요?")).toBe(true);
      expect(lab.steps).toHaveLength(3);
      expect(lab.steps.every((step) => step.length >= 10)).toBe(true);
      expect(lab.observe.length).toBeGreaterThan(20);
      expect(lab.terms.length).toBeGreaterThanOrEqual(3);
      expect(lab.terms.every((term) => term.name.length >= 2 && term.description.length >= 12)).toBe(true);
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

  it("auto-plays a dedicated lab consistently whether it was selected or opened by URL", () => {
    expect(shouldAutoPlayLab("initial")).toBe(true);
    expect(shouldAutoPlayLab("selection")).toBe(true);
  });

  it("keeps the direct manipulation target visible for every guided experiment", () => {
    for (const lab of MECHANICS_LABS) {
      expect(mechanicsInteractionTip(lab.id).length).toBeGreaterThan(12);
    }
    expect(mechanicsInteractionTip("friction")).toContain("빨간 손잡이");
    expect(mechanicsInteractionTip("rotation")).toContain("힘점");
    expect(mechanicsInteractionTip("pulley")).toContain("아래로");
    expect(mechanicsInteractionTip("orbit")).toContain("보라색 화살표");
  });

  it("explains immediately what a changed condition affects", () => {
    expect(mechanicsSettingFeedback("mass", "가벼움")).toContain("무게: 가벼움");
    expect(mechanicsSettingFeedback("material", "나무")).toContain("움직임과 그래프");
    expect(mechanicsSettingFeedback("gravity", "달 · 0.17×")).toContain("중력: 달 · 0.17×");
  });
});
