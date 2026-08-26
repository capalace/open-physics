import { describe, expect, it } from "vitest";
// @ts-expect-error -- node:fs is available in the Vitest runtime.
import { readFileSync } from "node:fs";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import { electromagnetismLegend } from "./experience";

const experienceSource = readFileSync(new URL("./experience.ts", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("./renderer.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");

describe("electromagnetism canvas legend", () => {
  it("explains the active visual language in every experiment", () => {
    const modes = [...ELECTROMAGNETISM_LAB_IDS, "sandbox"] as const;
    const legends = modes.map((mode) => electromagnetismLegend(mode));

    expect(legends.every((items) => items.length > 0)).toBe(true);
    expect(electromagnetismLegend("sandbox").map((item) => item.label)).toContain("작은 화살표 = 전기장");
    expect(electromagnetismLegend("electric-field").map((item) => item.label)).toContain("초록 선 = 전기력선 (+에서 −로)");
    expect(electromagnetismLegend("magnetic-field").map((item) => item.label)).toContain("원형 선과 화살표 = 자기력선");
    expect(electromagnetismLegend("potential").map((item) => item.label)).toEqual(["보라색 선 = 전위가 같은 곳"]);
    expect(electromagnetismLegend("induction").map((item) => item.label)).toContain("청록 선 = 자기력선 (N에서 S로)");
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

  it("offers separate positive and negative sandbox charge tools", () => {
    expect(experienceSource).toContain('["charge", "+", "양전하", 2e-6]');
    expect(experienceSource).toContain('["charge", "−", "음전하", -2e-6]');
    expect(experienceSource).toContain("data-em-value");
    expect(rendererSource).toContain('positive ? "양전하 (+)" : "음전하 (−)"');
  });

  it("keeps inspector typography on the mechanics 12–14px scale", () => {
    expect(styles).toMatch(/\.em-readout h3[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-controls h3[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-readout output[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-controls button[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-graph > div > strong[^}]*font-size:\s*14px/s);
  });
});
