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
  it("provides all guided labs and one sandbox entry per subject", () => {
    expect(remainingSubjects.map((subject) => subject.labs.length)).toEqual([15, 8, 10, 8, 10]);
    expect(remainingSubjects.flatMap((subject) => subject.labs)).toHaveLength(51);
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

  it("guides directly manipulated labs to the highlighted Canvas apparatus", () => {
    for (const subject of [wavesDefinition, thermalDefinition, modernDefinition]) {
      expect(subject.labs.every((lab) => lab.steps[0].includes("조절 핸들") || lab.steps[0].includes("직접")), subject.id).toBe(true);
      expect(subject.labs.flatMap((lab) => lab.steps).join(" "), subject.id).not.toContain("왼쪽 설정");
    }
    const lightDirectLabs = lightDefinition.labs.filter((lab) => lab.id !== "laser");
    expect(lightDirectLabs.every((lab) => lab.steps[0].includes("빛나는"))).toBe(true);
    expect(lightDefinition.labs.find((lab) => lab.id === "laser")?.steps[0]).toContain("왼쪽 설정");
  });
});
