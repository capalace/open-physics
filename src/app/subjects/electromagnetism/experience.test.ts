import { describe, expect, it } from "vitest";
// @ts-expect-error -- node:fs is available in the Vitest runtime.
import { readFileSync } from "node:fs";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import { electromagnetismLegend } from "./experience";

const experienceSource = readFileSync(new URL("./experience.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");

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

  it("uses the mechanics canvas legend instead of a generic interaction badge", () => {
    expect(experienceSource).toContain('class="canvas-legend em-canvas-legend"');
    expect(experienceSource).not.toContain("전자기학 · 직접 조작");
    expect(styles).not.toContain(".em-canvas-frame > span");
  });
});
