import { describe, expect, it } from "vitest";
import { ELECTROMAGNETISM_SUBJECT } from "./electromagnetism/catalog";
import { lightDefinition } from "./light/catalog";
import { modernDefinition } from "./modern/catalog";
import { thermalDefinition } from "./thermal/catalog";
import { wavesDefinition } from "./waves/catalog";

const remainingSubjects = [
  ELECTROMAGNETISM_SUBJECT,
  wavesDefinition,
  lightDefinition,
  thermalDefinition,
  modernDefinition,
] as const;

describe("remaining physics subject coverage", () => {
  it("provides all 38 guided labs and one sandbox entry per subject", () => {
    expect(remainingSubjects.map((subject) => subject.labs.length)).toEqual([8, 7, 8, 7, 8]);
    expect(remainingSubjects.flatMap((subject) => subject.labs)).toHaveLength(38);
    expect(remainingSubjects.every((subject) => subject.sandboxTitle === "빈 실험실 만들기")).toBe(true);
  });

  it("keeps each subject's inquiry questions and graphs distinct", () => {
    for (const subject of remainingSubjects) {
      const questions = subject.labs.map((lab) => lab.question);
      const graphTitles = subject.labs.map((lab) => lab.graph.title);

      expect(new Set(questions).size, `${subject.id} questions`).toBe(subject.labs.length);
      expect(new Set(graphTitles).size, `${subject.id} graphs`).toBe(subject.labs.length);
    }
  });
});
