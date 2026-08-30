import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import { MODERN_LAB_IDS, modernDefinition } from "./catalog";

describe("modern-physics catalog", () => {
  it("contains all ten guided laboratories exactly once", () => {
    expect(modernDefinition.labs.map((lab) => lab.id)).toEqual(MODERN_LAB_IDS);
    expect(() => validateSubjectDefinition(modernDefinition, MODERN_LAB_IDS)).not.toThrow();
  });
  it("provides distinct direct controls, questions, and graphs", () => {
    expect(new Set(modernDefinition.labs.map((lab) => lab.controls[0])).size).toBe(10);
    expect(new Set(modernDefinition.labs.map((lab) => lab.question)).size).toBe(10);
    expect(new Set(modernDefinition.labs.map((lab) => lab.graph.title)).size).toBe(10);
    for (const lab of modernDefinition.labs) {
      expect(lab.steps).toHaveLength(3);
      expect(lab.graph.xLabel.includes("(") || lab.graph.xLabel.includes("주양자수")).toBe(true);
    }
  });
  it("describes probability and detection instead of definite quantum orbits", () => {
    const quantumCopy = modernDefinition.labs.filter((lab) => ["atoms", "matter-waves", "quantum", "tunneling"].includes(lab.id)).map((lab) => `${lab.question} ${lab.observe}`).join(" ");
    expect(quantumCopy).toContain("확률"); expect(quantumCopy).toContain("검출");
    expect(quantumCopy).not.toContain("전자 궤도");
  });
});
