import { describe, expect, it } from "vitest";
import {
  SUBJECT_SANDBOX_TITLE,
  subjectRouteFromUrl,
  subjectRouteUrl,
  validateSubjectDefinition,
  type SubjectDefinition,
  type SubjectLabDefinition,
} from "./subject-experience";

const lab = (id: string, title = id): SubjectLabDefinition => ({
  id,
  title,
  category: "기준",
  icon: "●",
  question: `${title}에서 조건을 바꾸면 결과는 어떻게 달라질까요?`,
  steps: ["손잡이를 잡아 움직여요.", "조건을 하나 바꾸어 보세요.", "그래프의 결과를 비교해요."],
  observe: "Canvas의 변화와 그래프가 함께 달라지는지 관찰하세요.",
  controls: ["primary-variable"],
  law: { title: "기준 법칙", description: "입력 조건이 물리 모델의 계산 결과를 바꿉니다.", equation: "y = f(x)" },
  graph: {
    kind: "line",
    title: `${title} 측정`,
    xLabel: "조건 (상대값)",
    yLabel: "결과 (상대값)",
    series: [{ label: title, color: "#5b7cfa" }],
  },
});

const subject = (labs: readonly SubjectLabDefinition[]): SubjectDefinition => ({
  id: "waves",
  label: "파동",
  eyebrow: "WAVES LAB",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "파원과 매질을 자유롭게 조합해요.",
  labs,
});

describe("subject experience contract", () => {
  it("accepts a complete catalog with distinct questions and graphs", () => {
    expect(() => validateSubjectDefinition(subject([lab("source"), lab("interference")]), [
      "source",
      "interference",
    ])).not.toThrow();
  });

  it("rejects missing or duplicated guided lab content", () => {
    expect(() => validateSubjectDefinition(subject([lab("source")]), ["source", "sound"]))
      .toThrow("must define 2 guided labs");
    expect(() => validateSubjectDefinition(subject([lab("source"), lab("source")]), ["source", "sound"]))
      .toThrow("guided lab ids must match");
  });

  it("maps subject selection and dedicated lab screens to canonical URLs", () => {
    const definition = subject([lab("source"), lab("interference")]);
    const selectionUrl = subjectRouteUrl(new URL("https://example.test/open-physics/?subject=light&lab=lens"), definition, { screen: "selection" });
    const labUrl = subjectRouteUrl(selectionUrl, definition, { screen: "lab", labId: "interference" });

    expect(selectionUrl.search).toBe("?subject=waves");
    expect(labUrl.search).toBe("?subject=waves&lab=interference");
    expect(subjectRouteFromUrl(selectionUrl, definition)).toEqual({ screen: "selection" });
    expect(subjectRouteFromUrl(labUrl, definition)).toEqual({ screen: "lab", labId: "interference" });
    expect(subjectRouteFromUrl(new URL("https://example.test/?subject=waves&lab=missing"), definition)).toEqual({ screen: "selection" });
    expect(subjectRouteFromUrl(new URL("https://example.test/?subject=waves&lab=sandbox"), definition)).toEqual({ screen: "lab", labId: "sandbox" });
  });

  it("keeps mechanics routes on the root subject URL", () => {
    const definition = { id: "mechanics" as const, labs: [{ id: "free-fall" }] };
    const labUrl = subjectRouteUrl(new URL("https://example.test/open-physics/?subject=waves"), definition, { screen: "lab", labId: "free-fall" });
    const selectionUrl = subjectRouteUrl(labUrl, definition, { screen: "selection" });

    expect(labUrl.search).toBe("?lab=free-fall");
    expect(selectionUrl.search).toBe("");
  });
});
