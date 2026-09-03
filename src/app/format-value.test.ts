import { describe, expect, it } from "vitest";
import { formatDisplayNumber, formatSignedDisplayNumber, qualitativeLevel } from "./format-value";

describe("learner-facing number formatting", () => {
  it("removes meaningless trailing precision", () => {
    expect(formatDisplayNumber(12)).toBe("12");
    expect(formatDisplayNumber(12.04)).toBe("12");
    expect(formatDisplayNumber(12.06)).toBe("12.1");
    expect(formatDisplayNumber(1234.5)).toBe("1,234.5");
  });

  it("allows a deliberate exception for physically small quantities", () => {
    expect(formatDisplayNumber(0.006, 3)).toBe("0.006");
    expect(formatSignedDisplayNumber(1.24)).toBe("+1.2");
  });
});

describe("qualitativeLevel", () => {
  it("turns a continuous measurement into three readable bands", () => {
    expect(qualitativeLevel(1, 0, 9)).toBe("낮음");
    expect(qualitativeLevel(4, 0, 9)).toBe("보통");
    expect(qualitativeLevel(8, 0, 9, ["약함", "알맞음", "강함"])).toBe("강함");
  });
});
