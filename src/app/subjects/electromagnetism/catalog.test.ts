import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import {
  ELECTROMAGNETISM_LABS,
  ELECTROMAGNETISM_LAB_IDS,
  ELECTROMAGNETISM_SUBJECT,
} from "./catalog";

describe("electromagnetism subject catalog", () => {
  it("defines nine distinct guided labs with direct manipulation and graphs", () => {
    expect(ELECTROMAGNETISM_LABS).toHaveLength(9);
    expect(() => validateSubjectDefinition(ELECTROMAGNETISM_SUBJECT, ELECTROMAGNETISM_LAB_IDS)).not.toThrow();
    expect(new Set(ELECTROMAGNETISM_LABS.flatMap((lab) => lab.controls)).size).toBeGreaterThan(8);
    expect(ELECTROMAGNETISM_LABS.every((lab) => lab.graph.series.length > 0)).toBe(true);
    expect(ELECTROMAGNETISM_LABS.every((lab) => (lab.terms?.length ?? 0) >= 3)).toBe(true);
    expect(ELECTROMAGNETISM_LABS.flatMap((lab) => lab.terms ?? []).every((term) => term.description.length >= 12)).toBe(true);
  });

  it("uses short mechanics-style copy in the experiment browser", () => {
    for (const lab of ELECTROMAGNETISM_LABS) {
      expect(lab.selectionTitle).toBeTruthy();
      expect(lab.selectionTitle!.length).toBeLessThanOrEqual(10);
      expect(lab.selectionDescription).toBeTruthy();
      expect(lab.selectionDescription!.length).toBeLessThanOrEqual(24);
    }
    expect(ELECTROMAGNETISM_SUBJECT.sandboxDescription).toBe("전하·회로·자석을 자유롭게 조합해요.");
  });
});
