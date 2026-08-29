import { describe, expect, it } from "vitest";
// @ts-expect-error -- node:fs is available in the Vitest runtime.
import { readFileSync } from "node:fs";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import {
  circuitTrialSummary,
  electromagnetismInteractionTip,
  electromagnetismLegend,
  electromagnetismResultDirection,
  nextElectromagnetismPeakVoltage,
} from "./experience";
import { ElectromagnetismModel } from "./models";

const experienceSource = readFileSync(new URL("./experience.ts", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("./renderer.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");

describe("electromagnetism canvas legend", () => {
  it("summarizes circuit conditions for a pinned A/B comparison", () => {
    const model = new ElectromagnetismModel("circuits");
    model.setCircuitArrangement("parallel");
    model.setLevel(1.5);

    const trial = circuitTrialSummary(model.snapshot());

    expect(trial?.condition).toBe("병렬 · 전지 12 V");
    expect(trial?.values.map((value) => value.label)).toEqual(["전체 회로 전류", "전구 하나의 전력"]);
  });

  it("explains the active visual language in every experiment", () => {
    const modes = [...ELECTROMAGNETISM_LAB_IDS, "sandbox"] as const;
    const legends = modes.map((mode) => electromagnetismLegend(mode));

    expect(legends.every((items) => items.length > 0)).toBe(true);
    expect(electromagnetismLegend("sandbox").map((item) => item.label)).toContain("작은 화살표 = 전기장");
    expect(electromagnetismLegend("charge").map((item) => item.label)).toContain("초록 선 = 전기력선 (+에서 −로)");
    expect(electromagnetismLegend("induction").map((item) => item.label)).toContain("청록 선 = 자기력선 (N에서 S로)");
    expect(electromagnetismLegend("electromagnetic-force").map((item) => item.label)).toEqual([
      "노란 화살표 = 전류",
      "바닥 기호 = 자기장",
      "주황 화살표 = 도선이 받는 힘",
    ]);
    expect(electromagnetismLegend("motor").map((item) => item.label)).toContain("보라 곡선 = 회전 방향");
    expect(electromagnetismLegend("generator").map((item) => item.label)).toContain("계기판 = 발전 전압");
  });

  it("renders the four core apparatus labs instead of text-only catalog entries", () => {
    for (const method of ["electromagnetLab", "motorLab", "generatorLab", "transformerLab"]) {
      expect(rendererSource).toContain(method);
    }
    expect(experienceSource).toContain('this.activeMode === "generator"');
  });

  it("ties the redesigned apparatus labs to observable physical outcomes", () => {
    expect(rendererSource).toContain("particleTargetsHit");
    expect(rendererSource).toContain("플래시 밝기");
    expect(rendererSource).toContain("부하가 커서 전동기가 멈췄어요");
    expect(rendererSource).toContain("손을 멈추면 꺼져요");
    expect(rendererSource).toContain("applianceTargetVoltage");
    expect(rendererSource).not.toContain("돛수레 결승선 도착!");
    expect(rendererSource).not.toContain("밤마을 전체 점등 성공!");
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
    expect(rendererSource).toContain("const positive = object.value >= 0");
    expect(rendererSource).toContain("positive ? 1 : -1");
  });

  it("offers a directly wired circuit kit in the sandbox", () => {
    expect(experienceSource).toContain('["bulb", "◉", "전구"]');
    expect(experienceSource).toContain('["switch", "⌁", "스위치"]');
    expect(experienceSource).toContain('data-em-action="wire"');
    expect(experienceSource).toContain('capacitor: "양쪽 접점에 전선을 연결하면 충전되고');
    expect(experienceSource).toContain('group.tone === "circuit"');
    expect(experienceSource).toContain("connectSandboxObjects");
  });

  it("disables inert transport controls for experiments driven only by direct dragging", () => {
    expect(experienceSource).toContain('snapshot.mode === "induction" ? "자석을 직접 움직여요"');
    expect(experienceSource).toContain('snapshot.mode === "generator" ? "손잡이를 직접 돌려요"');
    expect(experienceSource).toContain("play.disabled = !transportDriven");
  });

  it("uses the same flat toolbar vocabulary as mechanics and highlights only wire-compatible parts", () => {
    expect(experienceSource).toContain('label: "전하·장", hint: "거리로 작용"');
    expect(experienceSource).toContain('label: "회로", hint: "전선 연결 가능"');
    expect(experienceSource).toContain('label: "자기·유도", hint: "가까이 배치"');
    expect(experienceSource).toContain('label: "전자기 결합", hint: "운동·전자석"');
    expect(experienceSource).toContain('class="toolbar-divider"');
    expect(experienceSource).toContain('class="palette-label"');
    expect(experienceSource).toContain('class="em-tool-group"');
    expect(experienceSource).toContain('class="danger-button"');
    expect(experienceSource).toContain('class="em-run-state run-indicator"');
    expect(experienceSource).not.toContain("em-palette-group");
    expect(experienceSource).toContain("data-em-connectable");
    expect(experienceSource).toContain("hitSandboxTerminal");
    expect(rendererSource).toContain("sandboxTerminalPoint");
    expect(experienceSource).toContain("is-wire-compatible");
    expect(experienceSource).toContain("is-wire-incompatible");
    expect(styles).toContain("button.is-wire-compatible");
    expect(styles).toContain("button.is-wire-incompatible");
  });

  it("uses a dedicated URL-backed lab screen with settings on the left", () => {
    expect(experienceSource).toContain("SubjectRouteSession");
    expect(experienceSource).toContain("this.routeSession.openLab");
    expect(experienceSource).toContain('data-em-selection-screen');
    expect(experienceSource).toContain('data-em-back');
    expect(experienceSource).toContain('this.hosts.experimentPanel, "[data-em-controls]"');
  });

  it("offers capacitor and current-wire apparatus missing from the original sandbox", () => {
    expect(experienceSource).toContain('["capacitor", "Ⅱ", "축전기"]');
    expect(experienceSource).toContain('["current-wire", "⊙", "도선"]');
    expect(experienceSource).toContain("data-em-sandbox-secondary-value");
    expect(rendererSource).toContain('object.kind === "capacitor"');
    expect(rendererSource).toContain('object.kind === "current-wire"');
  });

  it("offers reusable load, motor, and generator apparatus in the empty lab", () => {
    expect(experienceSource).toContain('["iron-load", "▣", "철제 짐"]');
    expect(experienceSource).toContain('["motor", "↻", "전동기"]');
    expect(experienceSource).toContain('["generator", "⚡", "발전기"]');
    expect(experienceSource).toContain('["transformer", "⇄", "변압기"]');
    expect(experienceSource).toContain('data-em-sandbox-action="generator-toggle"');
    expect(rendererSource).toContain('object.kind === "iron-load"');
    expect(rendererSource).toContain('object.kind === "motor"');
    expect(rendererSource).toContain('object.kind === "generator"');
    expect(rendererSource).toContain('object.kind === "transformer"');
  });

  it("makes electric and magnetic apparatus visibly affect one another", () => {
    expect(experienceSource).toContain('["field-region", "⊙", "자기장 영역"]');
    expect(experienceSource).toContain("sandboxVelocityHandle");
    expect(experienceSource).toContain('data-em-sandbox-action="charge-motion"');
    expect(experienceSource).toContain('data-em-sandbox-action="field-direction"');
    expect(experienceSource).toContain("전류 ${Math.abs(selectedCurrent).toFixed(2)} A가 흘러 전자석이 되었어요.");
    expect(rendererSource).toContain("magneticFieldRegion");
    expect(rendererSource).toContain("sandboxCoil");
    expect(rendererSource).toContain("로런츠 힘");
  });

  it("exposes mechanics-style editing for the selected sandbox apparatus", () => {
    expect(experienceSource).toContain("sandboxValueChoices");
    expect(experienceSource).toContain("data-em-sandbox-value");
    expect(experienceSource).toContain("N/S 방향 뒤집기");
    expect(experienceSource).toContain("setSandboxObjectValue");
    expect(experienceSource).toContain("하나 더 복제");
    expect(experienceSource).toContain("연결 끊기");
  });

  it("keeps inspector typography on the mechanics 12–14px scale", () => {
    expect(styles).toMatch(/\.em-readout h3[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-controls h3[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-readout output[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-controls button[^}]*font-size:\s*13px/s);
    expect(styles).toMatch(/\.em-graph > div > strong[^}]*font-size:\s*14px/s);
  });

  it("keeps the apparatus handle instructions visible in guided labs", () => {
    for (const mode of ELECTROMAGNETISM_LAB_IDS) {
      expect(electromagnetismInteractionTip(mode).length).toBeGreaterThan(12);
    }
    expect(electromagnetismInteractionTip("induction")).toContain("자석");
    expect(electromagnetismInteractionTip("generator")).toContain("보라색 손잡이");
    expect(electromagnetismInteractionTip("transformer")).toContain("보라색 손잡이");
    expect(experienceSource).toContain("data-em-interaction-tip");
  });

  it("remembers the strongest voltage after direct motion stops", () => {
    expect(nextElectromagnetismPeakVoltage("induction", 0, -4.52)).toBeCloseTo(4.52);
    expect(nextElectromagnetismPeakVoltage("induction", 4.52, 0)).toBeCloseTo(4.52);
    expect(nextElectromagnetismPeakVoltage("generator", 3.1, -10.8)).toBeCloseTo(10.8);
    expect(nextElectromagnetismPeakVoltage("charge", 8, 12)).toBe(0);
    expect(experienceSource).toContain("data-em-measurement-memory");
  });

  it("describes the force direction even when its magnitude is unchanged", () => {
    expect(electromagnetismResultDirection("electromagnetic-force", 1, 1)).toContain("위쪽");
    expect(electromagnetismResultDirection("electromagnetic-force", -1, 1)).toContain("아래쪽");
    expect(electromagnetismResultDirection("charge", 1, 1)).toBe("");
    expect(experienceSource).toContain("data-em-result-direction");
  });
});
