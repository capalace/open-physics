import { describe, expect, it } from "vitest";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import { electromagnetismLegend } from "./experience";

describe("electromagnetism canvas legend", () => {
  it("explains the active visual language in every experiment", () => {
    const modes = [...ELECTROMAGNETISM_LAB_IDS, "sandbox"] as const;
    const legends = modes.map((mode) => electromagnetismLegend(mode));

    expect(legends.every((items) => items.length > 0)).toBe(true);
    expect(electromagnetismLegend("sandbox").map((item) => item.label)).toContain("작은 화살표 = 전기장");
    expect(electromagnetismLegend("potential").map((item) => item.label)).toEqual(["전위는 숫자로 표시"]);
    expect(electromagnetismLegend("electromagnetic-force").map((item) => item.label)).toEqual([
      "보라 화살표 = 속도",
      "주황 화살표 = 자기력",
    ]);
  });
});
