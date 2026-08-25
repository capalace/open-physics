import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import {
  ELECTROMAGNETISM_LABS,
  ELECTROMAGNETISM_LAB_IDS,
  ELECTROMAGNETISM_SUBJECT,
} from "./catalog";

describe("electromagnetism subject catalog", () => {
  it("defines all eight guideline labs with distinct direct manipulation and graphs", () => {
    expect(ELECTROMAGNETISM_LABS).toHaveLength(8);
    expect(() => validateSubjectDefinition(ELECTROMAGNETISM_SUBJECT, ELECTROMAGNETISM_LAB_IDS)).not.toThrow();
    expect(new Set(ELECTROMAGNETISM_LABS.flatMap((lab) => lab.controls)).size).toBeGreaterThan(8);
    expect(ELECTROMAGNETISM_LABS.every((lab) => lab.graph.series.length > 0)).toBe(true);
  });
});
