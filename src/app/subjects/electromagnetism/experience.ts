import type { Vector2 } from "../../../physics/core";
import {
  SubjectRouteSession,
  type SubjectController,
  type SubjectExperience,
  type SubjectHosts,
  type SubjectRoute,
} from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectPickerMarkup, subjectSandboxGuideMarkup } from "../subject-ui";
import {
  ELECTROMAGNETISM_SUBJECT,
  electromagnetismLab,
  type ElectromagnetismLabId,
} from "./catalog";
import {
  ElectromagnetismModel,
  isElectromagnetismWireConnectable,
  sandboxBulbBrightness,
  sandboxBulbPower,
  sandboxVelocityHandle,
  sandboxWireTargetState,
  type ElectromagnetismMode,
  type ElectromagnetismSandboxObject,
  type ElectromagnetismSandboxKind,
  type ElectromagnetismSnapshot,
  type SandboxWireEndpoint,
} from "./models";
import { ElectromagnetismRenderer, electromagnetismDirectHandle, isElectromagnetismDirectManipulationMode } from "./renderer";
import { qualitativeLevel } from "../../format-value";
import "./style.css";

type SandboxTool = readonly [ElectromagnetismSandboxKind, string, string, number?];
const sandboxToolGroups: readonly { label: string; hint: string; tone: string; tools: readonly SandboxTool[] }[] = [
  { label: "전하·장", hint: "거리로 작용", tone: "field", tools: [
    ["charge", "+", "양전하", 2e-6], ["charge", "−", "음전하", -2e-6], ["capacitor", "Ⅱ", "축전기"], ["probe", "✦", "탐침"],
  ] },
  { label: "회로", hint: "전선 연결 가능", tone: "circuit", tools: [
    ["battery", "▯", "전지"], ["resistor", "〰", "저항"], ["bulb", "◉", "전구"], ["switch", "⌁", "스위치"],
  ] },
  { label: "자기·유도", hint: "가까이 배치", tone: "magnetic", tools: [
    ["current-wire", "⊙", "도선"], ["magnet", "N", "자석"],
  ] },
  { label: "전자기 결합", hint: "운동·전자석", tone: "bridge", tools: [
    ["field-region", "⊙", "자기장 영역"], ["coil", "⌁", "코일"], ["iron-load", "▣", "철제 짐"], ["motor", "↻", "전동기"], ["generator", "⚡", "발전기"], ["transformer", "⇄", "변압기"],
  ] },
];

type ElectromagnetismLegendKind = "field" | "electric-line" | "magnetic-line" | "force" | "velocity" | "voltage" | "potential" | "current" | "connection";
export interface ElectromagnetismLegendItem { readonly kind: ElectromagnetismLegendKind; readonly label: string }

export interface ElectromagnetismTrialSummary {
  readonly condition: string;
  readonly values: readonly { readonly label: string; readonly value: number; readonly unit: string }[];
}

type WireFeedbackTone = "guide" | "success" | "error";

export function circuitTrialSummary(snapshot: ElectromagnetismSnapshot): ElectromagnetismTrialSummary | null {
  if (snapshot.mode !== "circuits") return null;
  return {
    condition: `${snapshot.circuitArrangement === "series" ? "직렬" : "병렬"} · 전지 ${qualitativeLevel(snapshot.level, 0, 1, ["약함", "보통", "강함"])}`,
    values: [snapshot.measurement, snapshot.secondaryMeasurement].filter(
      (measurement): measurement is NonNullable<typeof measurement> => Boolean(measurement),
    ).map((measurement) => ({
      label: measurement.label,
      value: measurement.value,
      unit: measurement.unit,
    })),
  };
}

const sandboxKindLabel: Record<ElectromagnetismSandboxKind, string> = {
  charge: "움직일 수 있는 전하", battery: "전지", resistor: "저항", bulb: "전구", switch: "스위치", capacitor: "축전기", "current-wire": "전류가 흐르는 도선", "field-region": "수직 자기장 영역", magnet: "자석", coil: "코일", "iron-load": "철제 짐", motor: "전동기", generator: "손발전기", transformer: "변압기", probe: "장 탐침",
};

const sandboxInteractionHelp: Record<ElectromagnetismSandboxKind, string> = {
  charge: "보라색 운동 화살표 끝을 끌고 출발시키면 전기장과 자기장에 따라 경로가 달라져요.",
  battery: "양쪽 동그란 접점에 전선을 붙여요. 전지를 이어 붙이면 직렬·병렬 회로도 만들 수 있어요.",
  resistor: "양쪽 접점에 전선을 붙이고 저항을 바꾸면 전류와 전구 밝기가 달라져요.",
  bulb: "양쪽 접점으로 닫힌 회로를 만들면 실제 전력에 따라 밝기가 달라져요.",
  switch: "전선으로 연결하고 눌러서 회로를 열고 닫아요.",
  capacitor: "양쪽 접점에 전선을 연결하면 충전되고, 전지를 뺀 뒤 전구나 저항에 연결하면 방전돼요.",
  "current-wire": "회로 전선이 아니라 자기장을 만드는 도선이에요.",
  "field-region": "전하가 움직이는 면에 수직인 자기장이에요. 방향을 뒤집으면 전하가 휘는 방향도 바뀌어요.",
  magnet: "전선 없이 도선·코일 가까이에 놓으면 상호작용해요.",
  coil: "전선으로 회로에 연결하면 전자석이 되고, 자석을 움직이면 회로에 유도 전류를 만들어요.",
  "iron-load": "전지와 코일을 연결해 전자석을 만든 뒤 가까이 놓으면 실제로 끌려가요.",
  motor: "전지와 닫힌 회로로 연결하면 전류에 따라 회전해요. 저항값은 모터의 전기적 부하를 나타내요.",
  generator: "전구와 닫힌 회로로 연결한 뒤 회전을 켜면 전압을 공급해요. 멈추면 전구도 꺼져요.",
  transformer: "왼쪽 두 단자는 1차, 오른쪽 두 단자는 2차예요. 전원과 부하를 서로 다른 쪽에 연결해요.",
  probe: "전선에 연결하지 않고 원하는 위치의 전기장·자기장을 재요.",
};

const sandboxValueChoices: Partial<Record<ElectromagnetismSandboxKind, readonly { label: string; value: number }[]>> = {
  charge: [{ label: "작게", value: 1e-6 }, { label: "보통", value: 2e-6 }, { label: "크게", value: 4e-6 }],
  battery: [{ label: "약하게", value: 1.5 }, { label: "보통", value: 4.5 }, { label: "강하게", value: 9 }],
  resistor: [{ label: "작게", value: 2 }, { label: "보통", value: 10 }, { label: "크게", value: 20 }],
  bulb: [{ label: "작은 부하", value: 3 }, { label: "보통 부하", value: 6 }, { label: "큰 부하", value: 12 }],
  capacitor: [{ label: "좁게", value: 1 }, { label: "보통", value: 5 }, { label: "넓게", value: 10 }],
  "current-wire": [{ label: "약하게", value: 2 }, { label: "보통", value: 5 }, { label: "강하게", value: 9 }],
  "field-region": [{ label: "약하게", value: 0.5 }, { label: "보통", value: 1 }, { label: "강하게", value: 1.5 }],
  magnet: [{ label: "약하게", value: 0.5 }, { label: "보통", value: 1 }, { label: "강하게", value: 1.5 }],
  coil: [{ label: "적게", value: 40 }, { label: "보통", value: 80 }, { label: "많이", value: 140 }],
  "iron-load": [{ label: "가벼움", value: 1 }, { label: "보통", value: 2 }, { label: "무거움", value: 3 }],
  motor: [{ label: "작은 부하", value: 3 }, { label: "보통 부하", value: 6 }, { label: "큰 부하", value: 12 }],
  generator: [{ label: "약하게", value: 3 }, { label: "보통", value: 6 }, { label: "강하게", value: 9 }],
  transformer: [{ label: "적게", value: 40 }, { label: "보통", value: 80 }, { label: "많이", value: 140 }],
};

export function electromagnetismLegend(mode: ElectromagnetismLabId | "sandbox"): readonly ElectromagnetismLegendItem[] {
  switch (mode) {
    case "sandbox": return [
      { kind: "field", label: "작은 화살표 = 전기장" },
      { kind: "electric-line", label: "초록 선 = 전기력선 (+에서 −로)" },
      { kind: "magnetic-line", label: "청록 선 = 자석·도선의 자기장" },
      { kind: "velocity", label: "보라 화살표 = 전하의 운동 방향" },
      { kind: "connection", label: "검은 선 = 직접 연결한 전선" },
    ];
    case "charge": return [
      { kind: "force", label: "주황 화살표 = 전기력" },
      { kind: "field", label: "작은 화살표 = 전기장" },
      { kind: "electric-line", label: "초록 선 = 전기력선 (+에서 −로)" },
    ];
    case "potential": return [
      { kind: "potential", label: "보라 원 = 등전위선" },
      { kind: "field", label: "등전위선에 수직 = 전기장 방향" },
    ];
    case "electrostatic-induction": return [
      { kind: "field", label: "금속 안 +/− = 유도된 전하 분리" },
      { kind: "connection", label: "작은 쌍극자 = 유전 분극" },
    ];
    case "circuits": return [{ kind: "current", label: "움직이는 점 = 전류" }];
    case "capacitors": return [{ kind: "field", label: "판 사이 화살표 = 전기장" }];
    case "electronics": return [
      { kind: "current", label: "움직이는 점 = 출력 전류" },
      { kind: "magnetic-line", label: "코일 둘레 = 저장된 자기 에너지" },
    ];
    case "magnetic-field": return [
      { kind: "magnetic-line", label: "청록 원 = 자기력선" },
      { kind: "field", label: "나침반 = 자기장 방향" },
    ];
    case "magnetic-materials": return [
      { kind: "magnetic-line", label: "작은 화살표 = 물질 속 자기 모멘트" },
      { kind: "field", label: "청록 화살표 = 외부 자기장" },
    ];
    case "electromagnetic-force": return [
      { kind: "current", label: "노란 화살표 = 전류" },
      { kind: "magnetic-line", label: "바닥 기호 = 자기장" },
      { kind: "force", label: "주황 화살표 = 도선이 받는 힘" },
    ];
    case "induction": return [
      { kind: "magnetic-line", label: "청록 선 = 자기력선 (N에서 S로)" },
      { kind: "voltage", label: "화살표 = 유도 전압" },
    ];
    case "charged-particle": return [
      { kind: "velocity", label: "보라 화살표 = 처음 속도" },
      { kind: "force", label: "초록 화살표 = 로런츠 힘" },
      { kind: "magnetic-line", label: "바닥 기호 = 자기장 방향" },
    ];
    case "electromagnet": return [
      { kind: "current", label: "노란 코일 = 전류" },
      { kind: "magnetic-line", label: "청록 선 = 전자석 자기장" },
    ];
    case "motor": return [
      { kind: "current", label: "노란 사각형 = 회전 코일" },
      { kind: "magnetic-line", label: "청록 화살표 = 자기장" },
      { kind: "force", label: "보라 곡선 = 회전 방향" },
    ];
    case "generator": return [
      { kind: "velocity", label: "보라 손잡이 = 직접 돌리는 축" },
      { kind: "voltage", label: "계기판 = 발전 전압" },
    ];
    case "transformer": return [
      { kind: "current", label: "노랑·보라 코일 = 1차·2차" },
      { kind: "magnetic-line", label: "청록 점선 = 철심의 자속" },
    ];
  }
}

const interactionTips: Record<ElectromagnetismLabId, string> = {
  charge: "파란 전하를 잡아 움직여 거리와 힘이 함께 바뀌는지 보세요.",
  potential: "보라색 전위 탐침을 등전위선을 따라, 그리고 바깥쪽으로 옮겨 보세요.",
  "electrostatic-induction": "주황색 양전하를 금속 가까이 가져가 전하가 나뉘는 모습을 보세요.",
  circuits: "회로 아래의 저항 손잡이를 좌우로 끌어 전류와 밝기를 바꾸세요.",
  capacitors: "축전기 판 간격 손잡이를 좌우로 끌고 플래시 밝기를 비교하세요.",
  electronics: "파란 입력 전압 손잡이를 문턱 앞뒤로 옮겨 전구가 켜지는 순간을 찾으세요.",
  "magnetic-field": "나침반을 도선 가까이와 멀리 옮기고 전류 방향도 뒤집어 보세요.",
  "magnetic-materials": "청록색 손잡이를 옮겨 세 물질 속 작은 자석의 정렬을 비교하세요.",
  "electromagnetic-force": "노란 전류 화살표 끝을 좌우로 끌어 세기와 방향을 바꾸세요.",
  "charged-particle": "보라색 속도 화살표를 끌어 방향을 정한 뒤 실행해 표적을 맞혀 보세요.",
  induction: "막대 자석을 코일 안팎으로 빠르게 끌어 유도 전압을 만드세요.",
  electromagnet: "전자석을 짐까지 내린 뒤 오른쪽 놓을 곳으로 직접 옮기세요.",
  motor: "위쪽 보라색 전류 손잡이를 좌우로 끌어 짐의 움직임을 바꾸세요.",
  generator: "보라색 손잡이를 잡고 발전기 둘레를 따라 계속 돌리세요.",
  transformer: "2차 코일 아래 보라색 손잡이를 좌우로 끌어 필요한 전압을 맞추세요.",
};

export function electromagnetismInteractionTip(mode: ElectromagnetismLabId): string {
  return interactionTips[mode];
}

export function nextElectromagnetismPeakVoltage(
  mode: ElectromagnetismMode,
  previousPeak: number,
  currentVoltage: number,
): number {
  if (mode !== "induction" && mode !== "generator") return 0;
  return Math.max(previousPeak, Math.abs(currentVoltage));
}

export function electromagnetismResultDirection(
  mode: ElectromagnetismMode,
  currentDirection: 1 | -1,
  magneticDirection: 1 | -1,
): string {
  if (mode !== "electromagnetic-force") return "";
  return currentDirection * magneticDirection > 0 ? "위쪽 ↑" : "아래쪽 ↓";
}

class ElectromagnetismController implements SubjectController {
  private readonly previousHtml: [string, string, string];
  private readonly model = new ElectromagnetismModel("sandbox");
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: ElectromagnetismRenderer;
  private frame = 0;
  private previousFrameTime = 0;
  private dragging = false;
  private draggedSandboxId: string | null = null;
  private velocityDragId: string | null = null;
  private selectedSandboxId: string | null = null;
  private wiring = false;
  private wireStart: SandboxWireEndpoint | null = null;
  private wireFeedback = "";
  private wireFeedbackTone: WireFeedbackTone = "guide";
  private sandboxDragMoved = false;
  private previousPointerTime = 0;
  private activeMode: ElectromagnetismLabId | "sandbox" = "sandbox";
  private peakVoltage = 0;
  private pinnedCircuitTrial: ElectromagnetismTrialSummary | null = null;
  private showingLab = false;
  private readonly eventScope = new AbortController();
  private readonly routeSession: SubjectRouteSession;

  constructor(private readonly hosts: SubjectHosts) {
    this.previousHtml = [hosts.experimentPanel.innerHTML, hosts.workspace.innerHTML, hosts.inspectorPanel.innerHTML];
    hosts.experimentPanel.classList.add("subject-electromagnetism");
    hosts.workspace.classList.add("subject-electromagnetism");
    hosts.inspectorPanel.classList.add("subject-electromagnetism");
    this.renderShell();
    this.canvas = this.require<HTMLCanvasElement>(hosts.workspace, "[data-em-canvas]");
    this.renderer = new ElectromagnetismRenderer(this.canvas);
    this.bindEvents();
    this.routeSession = new SubjectRouteSession({ definition: ELECTROMAGNETISM_SUBJECT, onRoute: (route) => this.applyRoute(route) });
    this.routeSession.start();
    window.addEventListener("resize", this.resize);
    this.frame = requestAnimationFrame(this.animate);
  }

  private applyRoute(route: SubjectRoute): void {
    if (route.screen === "selection") this.showSelection();
    else this.activate(route.labId as ElectromagnetismLabId | "sandbox");
  }

  private showSelection(): void {
    this.showingLab = false;
    this.model.setRunning(false);
    document.body.dataset.subjectScreen = "selection";
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-selection-screen]").hidden = false;
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-lab-screen]").hidden = true;
  }

  resize = (): void => {
    if (!this.showingLab) return;
    this.renderer.resize();
    this.render();
  };

  unmount(): void {
    cancelAnimationFrame(this.frame);
    this.routeSession.dispose();
    this.eventScope.abort();
    window.removeEventListener("resize", this.resize);
    this.hosts.experimentPanel.innerHTML = this.previousHtml[0];
    this.hosts.workspace.innerHTML = this.previousHtml[1];
    this.hosts.inspectorPanel.innerHTML = this.previousHtml[2];
    this.hosts.experimentPanel.classList.remove("subject-electromagnetism");
    this.hosts.workspace.classList.remove("subject-electromagnetism");
    this.hosts.inspectorPanel.classList.remove("subject-electromagnetism");
    delete document.body.dataset.subjectScreen;
  }

  private renderShell(): void {
    const browser = subjectBrowserMarkup(ELECTROMAGNETISM_SUBJECT, {
      rootClass: "em-browser",
      buttonClass: "em-lab-button",
      sandboxClass: "em-sandbox-button",
      choiceAttribute: "data-em-mode",
    });
    const sandboxTools = sandboxToolGroups.map((group) => `
      <div class="em-tool-group" data-tone="${group.tone}">
        <span class="palette-label" title="${group.hint}">${group.label}</span>
        <div>${group.tools.map(([kind, icon, label, value]) => `<button type="button" data-em-add="${kind}"${isElectromagnetismWireConnectable(kind) ? " data-em-connectable" : ""}${value === undefined ? "" : ` data-em-value="${value}"`}><b>${icon}</b>${label}</button>`).join("")}</div>
        ${group.tone === "circuit" ? `<button class="em-wire-tool" type="button" data-em-action="wire" data-em-wire title="회로 부품의 동그란 접점 두 개를 차례로 선택"><b>⌁</b>전선 연결</button><p class="em-wire-status" data-em-wire-status role="status" aria-live="polite" hidden></p>` : ""}
      </div>`).join("");
    this.hosts.experimentPanel.innerHTML = `
      <div class="em-settings-shell" data-em-settings-shell>
        <button class="em-back-button" type="button" data-em-back>← 실험 선택</button>
        <div class="em-settings-heading"><span class="em-eyebrow">실험 설정</span><h2 data-em-settings-title>바꿔 볼 조건</h2></div>
        <div class="em-palette" data-em-sandbox-tools hidden>${sandboxTools}<button class="danger-button" type="button" data-em-action="delete" disabled>선택한 장치 삭제</button></div>
        <section class="em-controls" data-em-controls></section>
      </div>`;
    this.hosts.workspace.innerHTML = `
      <div class="em-selection-screen subject-selection-screen" data-em-selection-screen>
        <div class="em-selection-intro subject-selection-intro"><span class="eyebrow">전자기학</span><h1>어떤 실험을 해볼까요?</h1><p>실험을 고르면 조작 화면으로 이동합니다. 브라우저 뒤로가기로 이 화면에 돌아올 수 있어요.</p></div>
        ${subjectPickerMarkup("electromagnetism")}
        ${browser}
      </div>
      <div class="em-lab-screen" data-em-lab-screen hidden>
        <div class="em-toolbar world-toolbar">
          <div class="em-transport transport-controls">
            <button class="primary-button" type="button" data-em-action="play">▶ 실행</button>
            <button class="icon-button text-button" type="button" data-em-action="step">한 단계</button>
            <button class="icon-button text-button" type="button" data-em-action="reset">↻ 처음으로</button>
          </div>
          <div class="toolbar-divider"></div>
          <span class="em-run-state run-indicator" data-em-run-state data-running="false">멈춤</span>
        </div>
        <div class="em-canvas-frame"><canvas data-em-canvas width="960" height="600" aria-label="전자기학 2D 실험 공간"></canvas><div class="em-interaction-tip" data-em-interaction-tip role="note"></div><div class="canvas-legend em-canvas-legend" data-em-canvas-legend></div></div>
      </div>`;
    this.hosts.inspectorPanel.innerHTML = `
      <section class="em-guide" data-em-guide></section>
      <section class="em-readout">
        <h3>지금 관찰값</h3>
        <div><span data-em-measure-label></span><output data-em-measure-value></output></div>
        <div data-em-secondary-row><span data-em-secondary-label></span><output data-em-secondary-value></output></div>
        <div class="em-measurement-memory" data-em-measurement-memory hidden><span>이번 조작 최고 전압</span><output data-em-peak-voltage></output></div>
        <div class="em-result-direction" data-em-result-direction hidden><span>도선 이동 방향</span><output data-em-result-direction-value></output></div>
      </section>
      <section class="em-trial-comparison" data-em-trial-comparison hidden>
        <div><span>두 조건 비교하기</span><button type="button" data-em-pin-comparison>현재 결과 고정</button></div>
        <p>결과를 고정한 뒤 직렬·병렬이나 전압을 바꿔 보세요.</p>
        <div class="em-trial-comparison-grid"><article data-em-pinned-trial></article><article data-em-current-trial></article></div>
      </section>
      <section class="em-graph">
        <div><span>실험 그래프</span><strong data-em-graph-title></strong></div>
        <span class="em-graph-legend" data-em-graph-legend></span>
        <canvas data-em-graph-canvas width="280" height="160"></canvas>
        <p><span data-em-graph-x></span><span data-em-graph-y></span></p>
      </section>`;
  }

  private bindEvents(): void {
    this.hosts.experimentPanel.addEventListener("click", (event) => {
      if ((event.target as Element).closest("[data-em-back]")) {
        this.routeSession.returnToSelection();
        return;
      }
      const addButton = (event.target as Element).closest<HTMLButtonElement>("[data-em-add]");
      if (addButton && this.activeMode === "sandbox") {
        const requestedValue = addButton.dataset.emValue === undefined ? undefined : Number(addButton.dataset.emValue);
        const object = this.model.addSandboxObject(addButton.dataset.emAdd as ElectromagnetismSandboxKind, requestedValue);
        this.selectedSandboxId = object.id;
        this.wiring = false; this.wireStart = null; this.wireFeedback = "";
        this.render();
        return;
      }
      const action = (event.target as Element).closest<HTMLButtonElement>("[data-em-action]")?.dataset.emAction;
      if (action === "wire") {
        if (this.wiring) this.finishWiring("전선 연결을 취소했어요.", "guide");
        else {
          this.wiring = true;
          this.wireStart = null;
          this.setWireFeedback("1/2 · 연결을 시작할 첫 번째 접점을 누르세요.");
        }
      }
      else if (action === "delete" && this.selectedSandboxId) {
        this.model.removeSandboxObject(this.selectedSandboxId); this.selectedSandboxId = null;
      }
      if (action) this.render();
    }, { signal: this.eventScope.signal });
    this.hosts.inspectorPanel.addEventListener("click", (event) => {
      if (!(event.target as Element).closest("[data-em-pin-comparison]")) return;
      const current = circuitTrialSummary(this.model.snapshot());
      if (!current) return;
      this.pinnedCircuitTrial = {
        condition: current.condition,
        values: current.values.map((value) => ({ ...value })),
      };
      this.render();
    }, { signal: this.eventScope.signal });
    this.hosts.workspace.addEventListener("click", (event) => {
      const modeButton = (event.target as Element).closest<HTMLButtonElement>("[data-em-mode]");
      if (modeButton) {
        this.routeSession.openLab(modeButton.dataset.emMode as ElectromagnetismLabId | "sandbox");
        return;
      }
      const action = (event.target as Element).closest<HTMLButtonElement>("[data-em-action]")?.dataset.emAction;
      if (action === "play") this.model.toggle();
      else if (action === "step") { this.model.setRunning(true); this.model.step(1 / 60); this.model.setRunning(false); }
      else if (action === "reset") { this.model.reset(); this.peakVoltage = 0; this.selectedSandboxId = null; this.velocityDragId = null; this.wiring = false; this.wireStart = null; this.wireFeedback = ""; }
      this.render();
    }, { signal: this.eventScope.signal });
    this.hosts.experimentPanel.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-em-control], [data-em-sandbox-value], [data-em-sandbox-secondary-value], [data-em-sandbox-action]");
      if (!button) return;
      const control = button.dataset.emControl;
      if (control === "level") this.model.setLevel(Number(button.dataset.value));
      else if (control === "sign") this.model.toggleSign();
      else if (control === "direction") this.model.toggleDirection();
      else if (control === "turns") this.model.setCoilTurns(Number(button.dataset.value));
      else if (control === "capacitor-mode") this.model.setCapacitorMode(button.dataset.value as "charging" | "open" | "lamp");
      else if (control === "circuit-arrangement") this.model.setCircuitArrangement(button.dataset.value as "series" | "parallel");
      else if (control === "device-load") this.model.setDeviceLoad(Number(button.dataset.value));
      else if (control === "appliance-target") this.model.setApplianceTargetVoltage(Number(button.dataset.value));
      else if (control === "particle-launch") {
        const angle = Number(button.dataset.angle) * Math.PI / 180;
        const distance = Number(button.dataset.speed);
        this.model.drag({ x: 0.25 + Math.cos(angle) * distance, y: 0.52 + Math.sin(angle) * distance });
        this.model.setRunning(true);
      }
      else if (control === "crane-pick") this.model.drag({ x: 0.5, y: 0.7 });
      else if (control === "crane-deliver") this.model.drag({ x: 0.82, y: 0.7 });
      else if (control === "generator-slow") { this.model.drag({ x: 0.643, y: 0.564 }, 0.1); this.model.setRunning(true); }
      else if (control === "generator-fast") { this.model.drag({ x: 0.5, y: 0.67 }, 0.1); this.model.setRunning(true); }
      else if (control === "generator-stop") { this.model.drag({ x: 0.65, y: 0.52 }, 0); this.model.setRunning(false); }
      const sandboxValue = button.dataset.emSandboxValue;
      if (sandboxValue !== undefined && this.selectedSandboxId) this.model.setSandboxObjectValue(this.selectedSandboxId, Number(sandboxValue));
      const sandboxSecondaryValue = button.dataset.emSandboxSecondaryValue;
      if (sandboxSecondaryValue !== undefined && this.selectedSandboxId) this.model.setSandboxObjectSecondaryValue(this.selectedSandboxId, Number(sandboxSecondaryValue));
      const sandboxAction = button.dataset.emSandboxAction;
      if (sandboxAction === "flip" && this.selectedSandboxId) this.model.toggleSandboxMagnet(this.selectedSandboxId);
      else if (sandboxAction === "battery-flip" && this.selectedSandboxId) this.model.toggleSandboxBattery(this.selectedSandboxId);
      else if (sandboxAction === "toggle" && this.selectedSandboxId) this.model.toggleSandboxSwitch(this.selectedSandboxId);
      else if (sandboxAction === "sign" && this.selectedSandboxId) this.model.toggleSandboxCharge(this.selectedSandboxId);
      else if (sandboxAction === "current" && this.selectedSandboxId) this.model.toggleSandboxCurrent(this.selectedSandboxId);
      else if (sandboxAction === "field-direction" && this.selectedSandboxId) this.model.toggleSandboxFieldDirection(this.selectedSandboxId);
      else if (sandboxAction === "generator-toggle" && this.selectedSandboxId) this.model.toggleSandboxGenerator(this.selectedSandboxId);
      else if (sandboxAction === "charge-motion" && this.selectedSandboxId) {
        const selected = this.model.snapshot().sandboxObjects.find((object) => object.id === this.selectedSandboxId);
        const moving = !(selected?.moving ?? false);
        this.model.setSandboxChargeMotion(this.selectedSandboxId, moving);
        if (moving) this.model.setRunning(true);
      }
      else if (sandboxAction === "disconnect" && this.selectedSandboxId) this.model.disconnectSandboxObject(this.selectedSandboxId);
      else if (sandboxAction === "duplicate" && this.selectedSandboxId) {
        const duplicate = this.model.duplicateSandboxObject(this.selectedSandboxId);
        if (duplicate) this.selectedSandboxId = duplicate.id;
      }
      this.render();
    }, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointerdown", (event) => {
      const point = this.pointer(event);
      const snapshot = this.model.snapshot();
      const directHandle = electromagnetismDirectHandle(snapshot);
      if (this.activeMode !== "sandbox" && isElectromagnetismDirectManipulationMode(this.activeMode)
        && (!directHandle || Math.hypot(point.x - directHandle.x, point.y - directHandle.y) > 0.075)) {
        this.dragging = false;
        return;
      }
      this.dragging = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.previousPointerTime = event.timeStamp;
      if (this.activeMode === "sandbox") {
        const selectedCharge = this.model.snapshot().sandboxObjects.find((object) => object.id === this.selectedSandboxId && object.kind === "charge");
        if (!this.wiring && selectedCharge) {
          const handle = sandboxVelocityHandle(selectedCharge);
          if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 0.045) {
            this.velocityDragId = selectedCharge.id;
            this.draggedSandboxId = null;
            this.sandboxDragMoved = false;
            this.render();
            return;
          }
        }
        const object = this.model.hitSandboxObject(point);
        if (this.wiring) {
          const snapshot = this.model.snapshot();
          const terminal = this.renderer.hitSandboxTerminal(event.clientX, event.clientY, snapshot.sandboxObjects);
          if (!terminal) {
            this.setWireFeedback(object && !isElectromagnetismWireConnectable(object.kind)
              ? `${sandboxKindLabel[object.kind]}은 전선에 연결할 수 없어요.`
              : "장치의 동그란 접점을 정확히 눌러 주세요.", "error");
          } else if (!this.wireStart) {
            this.wireStart = terminal;
            this.setWireFeedback("2/2 · 파란색으로 빛나는 다른 장치의 접점을 누르세요.");
          } else {
            const targetState = sandboxWireTargetState(this.wireStart, terminal, snapshot.sandboxConnections);
            if (targetState === "active") this.setWireFeedback("이미 고른 접점이에요. 다른 장치의 파란 접점을 누르세요.", "error");
            else if (targetState === "same-object") this.setWireFeedback("같은 장치 안의 접점끼리는 연결할 수 없어요.", "error");
            else if (targetState === "duplicate") this.setWireFeedback("이미 연결된 두 접점이에요. 다른 접점을 골라 주세요.", "error");
            else if (this.model.connectSandboxObjects(this.wireStart.objectId, terminal.objectId, this.wireStart.terminal, terminal.terminal)) {
              this.finishWiring("전선이 연결됐어요.", "success");
            } else this.setWireFeedback("이 접점들은 연결할 수 없어요.", "error");
          }
          this.selectedSandboxId = terminal?.objectId ?? object?.id ?? this.selectedSandboxId;
          this.dragging = false;
          this.render();
          return;
        }
        this.draggedSandboxId = object?.id ?? null;
        this.selectedSandboxId = object?.id ?? null;
        this.sandboxDragMoved = false;
      } else {
        this.model.drag(point, 0);
      }
      this.render();
    }, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointermove", (event) => {
      const point = this.pointer(event);
      if (!this.dragging) {
        if (this.activeMode === "sandbox") this.canvas.style.cursor = this.model.hitSandboxObject(point) ? "grab" : "default";
        else if (isElectromagnetismDirectManipulationMode(this.activeMode)) {
          const handle = electromagnetismDirectHandle(this.model.snapshot());
          this.canvas.style.cursor = handle && Math.hypot(point.x - handle.x, point.y - handle.y) <= 0.075 ? "grab" : "default";
        } else this.canvas.style.cursor = "default";
        return;
      }
      this.canvas.style.cursor = "grabbing";
      const dt = Math.max(1 / 240, (event.timeStamp - this.previousPointerTime) / 1000);
      this.previousPointerTime = event.timeStamp;
      if (this.activeMode === "sandbox" && this.draggedSandboxId) {
        this.sandboxDragMoved = true;
        this.model.moveSandboxObject(this.draggedSandboxId, point, dt);
      }
      else if (this.activeMode === "sandbox" && this.velocityDragId) {
        this.sandboxDragMoved = true;
        this.model.setSandboxChargeVelocityFromHandle(this.velocityDragId, point);
      }
      else if (this.activeMode !== "sandbox") this.model.drag(point, dt);
      this.render();
    }, { signal: this.eventScope.signal });
    const endDrag = () => {
      const releasedId = this.draggedSandboxId;
      const releasedVelocityId = this.velocityDragId;
      this.dragging = false;
      this.canvas.style.cursor = "default";
      this.draggedSandboxId = null;
      this.velocityDragId = null;
      if (this.activeMode === "sandbox" && releasedId && !this.sandboxDragMoved) {
        this.model.toggleSandboxSwitch(releasedId);
        this.model.toggleSandboxMagnet(releasedId);
        this.model.toggleSandboxCurrent(releasedId);
        this.model.toggleSandboxGenerator(releasedId);
      }
      if (this.activeMode === "sandbox" && releasedId && this.sandboxDragMoved) {
        const released = this.model.snapshot().sandboxObjects.find((object) => object.id === releasedId);
        if (released?.kind === "magnet" || released?.kind === "coil") this.model.setRunning(true);
      }
      if (releasedVelocityId) {
        this.model.setSandboxChargeMotion(releasedVelocityId, true);
        this.model.setRunning(true);
      }
      if (this.activeMode === "induction" || this.activeMode === "generator" || this.activeMode === "electromagnetic-force") this.model.setRunning(true);
      this.render();
    };
    this.canvas.addEventListener("pointerup", endDrag, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointercancel", endDrag, { signal: this.eventScope.signal });
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.wiring) return;
      this.finishWiring("전선 연결을 취소했어요.", "guide");
      this.render();
    }, { signal: this.eventScope.signal });
  }

  private setWireFeedback(message: string, tone: WireFeedbackTone = "guide"): void {
    this.wireFeedback = message;
    this.wireFeedbackTone = tone;
  }

  private finishWiring(message: string, tone: WireFeedbackTone): void {
    this.wiring = false;
    this.wireStart = null;
    this.setWireFeedback(message, tone);
  }

  private activate(mode: ElectromagnetismLabId | "sandbox"): void {
    this.showingLab = true;
    document.body.dataset.subjectScreen = "lab";
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-selection-screen]").hidden = true;
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-lab-screen]").hidden = false;
    this.activeMode = mode;
    this.model.activate(mode);
    this.peakVoltage = 0;
    this.pinnedCircuitTrial = null;
    this.selectedSandboxId = null;
    this.velocityDragId = null;
    this.wiring = false; this.wireStart = null; this.wireFeedback = "";
    this.require<HTMLElement>(this.hosts.experimentPanel, "[data-em-settings-title]").textContent = mode === "sandbox" ? "실험실 도구" : "바꿔 볼 조건";
    this.require<HTMLElement>(this.hosts.experimentPanel, "[data-em-sandbox-tools]").hidden = mode !== "sandbox";
    const interactionTip = this.require<HTMLElement>(this.hosts.workspace, "[data-em-interaction-tip]");
    interactionTip.textContent = mode === "sandbox"
      ? "도구를 놓고 장치를 선택하세요. 회로 부품은 동그란 접점끼리 전선으로 이을 수 있어요."
      : `☝ ${electromagnetismInteractionTip(mode)}`;
    this.renderCanvasLegend();
    this.renderGuide();
    this.renderControls();
    this.render();
  }

  private renderCanvasLegend(): void {
    const legend = this.require<HTMLElement>(this.hosts.workspace, "[data-em-canvas-legend]");
    const items = electromagnetismLegend(this.activeMode);
    legend.setAttribute("aria-label", items.map((item) => item.label).join(", "));
    legend.innerHTML = items.map((item) => `<span><i class="em-legend-mark em-legend-mark--${item.kind}" aria-hidden="true"></i>${item.label}</span>`).join("");
  }

  private renderGuide(): void {
    const guide = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-guide]");
    if (this.activeMode === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        ELECTROMAGNETISM_SUBJECT,
        ["전하와 자기장 영역을 놓고 보라 화살표 끝을 끌어 발사해요.", "전지의 동그란 접점을 이어 직렬·병렬 회로를 만들고 전구 밝기를 비교해요.", "코일·전구·스위치를 닫아 잇고 자석을 빠르게 움직여요."],
        "전하의 경로, 코일의 N/S극, 유도 전류와 전구 밝기가 함께 달라지는지 보세요.",
      );
      return;
    }
    const lab = electromagnetismLab(this.activeMode);
    guide.innerHTML = subjectGuideMarkup(lab);
  }

  private renderControls(): void {
    const controls = this.require<HTMLElement>(this.hosts.experimentPanel, "[data-em-controls]");
    if (this.activeMode === "sandbox") {
      controls.innerHTML = "";
      controls.hidden = true;
      this.require<HTMLElement>(this.hosts.experimentPanel, ".em-settings-heading").hidden = false;
      return;
    }
    controls.hidden = false;
    const lab = electromagnetismLab(this.activeMode);
    const needsSign = lab.controls.some((control) => control.includes("sign") || control === "source-charge" || control === "test-charge" || control === "current-direction");
    const needsDirection = lab.controls.some((control) => control === "magnetic-direction" || control === "current");
    const needsTurns = lab.controls.includes("coil-turns");
    const needsCapacitorCircuit = lab.controls.includes("capacitor-circuit");
    const needsCircuitArrangement = lab.controls.includes("circuit-arrangement");
    const needsDeviceLoad = lab.controls.includes("device-load");
    const needsApplianceTarget = lab.controls.includes("appliance-target");
    const levelLabels: Partial<Record<ElectromagnetismLabId, string>> = {
      charge: "전하량", circuits: "전압", capacitors: "전압",
      "magnetic-field": "전류 세기", "charged-particle": "자기장 세기",
      "electromagnetic-force": "전류 세기",
      electromagnet: "전류 세기", motor: "전류 세기", transformer: "1차 전압",
    };
    const levelLabel = levelLabels[this.activeMode];
    const guidedActions = this.activeMode === "charged-particle"
      ? `<div class="em-choice"><span>발사 방향과 속력</span><button data-em-control="particle-launch" data-angle="-15" data-speed="0.12">아래 15°</button><button data-em-control="particle-launch" data-angle="0" data-speed="0.16">정면 빠르게</button><button data-em-control="particle-launch" data-angle="15" data-speed="0.12">위 15°</button></div>`
      : this.activeMode === "electromagnet"
        ? `<div class="em-choice"><span>전자석 옮기기</span><button data-em-control="crane-pick">짐에 붙이기</button><button data-em-control="crane-deliver">목표로 옮기기</button></div>`
        : this.activeMode === "generator"
          ? `<div class="em-choice"><span>손잡이 돌리기</span><button data-em-control="generator-slow">천천히</button><button data-em-control="generator-fast">빠르게</button><button data-em-control="generator-stop">멈추기</button></div>`
          : "";
    const signLabel = this.activeMode === "electromagnetic-force" || this.activeMode === "electromagnet" || this.activeMode === "motor"
      ? "전류 방향 뒤집기"
      : "전하 부호 뒤집기 (+/−)";
    const directionLabel = this.activeMode === "electromagnetic-force"
      ? "자기장 방향 뒤집기 (⊙/⊗)"
      : this.activeMode === "motor" ? "자석 N/S 방향 뒤집기" : "전류 방향 뒤집기";
    controls.innerHTML = `
      <h3>바꿔 볼 조건</h3>
      ${levelLabel ? `<div class="em-choice"><span>${levelLabel}</span><button data-em-control="level" data-value="0.5">약하게</button><button data-em-control="level" data-value="1">보통</button><button data-em-control="level" data-value="1.5">강하게</button></div>` : ""}
      ${needsSign ? `<button class="em-wide-control" data-em-control="sign">${signLabel}</button>` : ""}
      ${needsDirection ? `<button class="em-wide-control" data-em-control="direction">${directionLabel}</button>` : ""}
      ${needsTurns ? `<div class="em-choice"><span>코일 감은 수</span><button data-em-control="turns" data-value="40">40회</button><button data-em-control="turns" data-value="80">80회</button><button data-em-control="turns" data-value="140">140회</button></div>` : ""}
      ${needsCapacitorCircuit ? `<div class="em-choice"><span>회로 연결</span><button data-em-control="capacitor-mode" data-value="charging">전지 연결</button><button data-em-control="capacitor-mode" data-value="open">전지 분리</button><button data-em-control="capacitor-mode" data-value="lamp">플래시 켜기</button></div>` : ""}
      ${needsCircuitArrangement ? `<div class="em-choice"><span>전구 연결</span><button data-em-control="circuit-arrangement" data-value="series">직렬</button><button data-em-control="circuit-arrangement" data-value="parallel">병렬</button></div>` : ""}
      ${needsDeviceLoad ? `<div class="em-choice"><span>짐 무게</span><button data-em-control="device-load" data-value="1">가벼움</button><button data-em-control="device-load" data-value="2">보통</button><button data-em-control="device-load" data-value="3">무거움</button></div>` : ""}
      ${needsApplianceTarget ? `<div class="em-choice"><span>연결할 장치</span><button data-em-control="appliance-target" data-value="6">LED 6 V</button><button data-em-control="appliance-target" data-value="9">라디오 9 V</button><button data-em-control="appliance-target" data-value="12">로봇 12 V</button></div>` : ""}
      ${guidedActions}`;
    const hasControls = Boolean(controls.querySelector("button"));
    controls.hidden = !hasControls;
    this.require<HTMLElement>(this.hosts.experimentPanel, ".em-settings-heading").hidden = !hasControls;
  }

  private render(): void {
    const snapshot = this.model.snapshot();
    this.peakVoltage = nextElectromagnetismPeakVoltage(snapshot.mode, this.peakVoltage, snapshot.measurement.value);
    this.renderer.render(snapshot, snapshot.time, this.selectedSandboxId, this.wiring, this.wireStart);
    if (snapshot.mode === "sandbox") this.renderSandboxControls(snapshot.sandboxObjects.find((object) => object.id === this.selectedSandboxId) ?? null, snapshot);
    const wire = this.hosts.experimentPanel.querySelector<HTMLButtonElement>("[data-em-wire]");
    const palette = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-em-sandbox-tools]");
    palette?.classList.toggle("is-wiring", this.wiring);
    palette?.querySelectorAll<HTMLButtonElement>("[data-em-add]").forEach((button) => {
      const connectable = isElectromagnetismWireConnectable(button.dataset.emAdd as ElectromagnetismSandboxKind);
      button.classList.toggle("is-wire-compatible", this.wiring && connectable);
      button.classList.toggle("is-wire-incompatible", this.wiring && !connectable);
      button.setAttribute("aria-disabled", String(this.wiring && !connectable));
    });
    if (wire) {
      wire.classList.toggle("is-active", this.wiring);
      wire.setAttribute("aria-pressed", String(this.wiring));
      wire.textContent = this.wiring ? "연결 취소 (Esc)" : "〰 전선 연결";
    }
    const wireStatus = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-em-wire-status]");
    if (wireStatus) {
      wireStatus.hidden = !this.wireFeedback;
      wireStatus.textContent = this.wireFeedback;
      wireStatus.dataset.tone = this.wireFeedbackTone;
    }
    const deleteButton = this.hosts.experimentPanel.querySelector<HTMLButtonElement>('[data-em-action="delete"]');
    if (deleteButton) deleteButton.disabled = !this.selectedSandboxId;
    const play = this.require<HTMLButtonElement>(this.hosts.workspace, '[data-em-action="play"]');
    const step = this.require<HTMLButtonElement>(this.hosts.workspace, '[data-em-action="step"]');
    const timeDriven = snapshot.mode === "sandbox" || snapshot.mode === "capacitors" || snapshot.mode === "electromagnetic-force" || snapshot.mode === "charged-particle" || snapshot.mode === "motor" || snapshot.mode === "generator" || snapshot.mode === "induction";
    const directPrompt = snapshot.mode === "induction" ? "자석을 직접 움직여요" : snapshot.mode === "generator" ? "손잡이를 직접 돌려요" : "";
    const transportDriven = timeDriven && !directPrompt;
    play.disabled = !transportDriven; step.disabled = !transportDriven;
    play.title = transportDriven ? "" : directPrompt || "이 실험은 조작하면 바로 반응합니다.";
    step.title = play.title;
    play.textContent = snapshot.running ? "Ⅱ 일시정지" : "▶ 실행";
    const runState = this.require<HTMLElement>(this.hosts.workspace, "[data-em-run-state]");
    runState.textContent = this.wiring ? (this.wireStart ? "2/2 · 두 번째 접점 선택" : "1/2 · 첫 번째 접점 선택") : directPrompt || (!timeDriven ? "조작 즉시 반응" : snapshot.running ? "실행 중" : "멈춤");
    runState.dataset.running = String(snapshot.running && !this.wiring);
    const selectedControlValue = (control: string): number | string | null => {
      if (control === "level") return snapshot.level;
      if (control === "turns") return snapshot.coilTurns;
      if (control === "capacitor-mode") return snapshot.capacitorMode;
      if (control === "circuit-arrangement") return snapshot.circuitArrangement;
      if (control === "device-load") return snapshot.deviceLoad;
      if (control === "appliance-target") return snapshot.applianceTargetVoltage;
      return null;
    };
    this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-em-control][data-value]").forEach((button) => {
      const selected = String(selectedControlValue(button.dataset.emControl ?? "")) === button.dataset.value;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-measure-label]").textContent = snapshot.measurement.label;
    this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-measure-value]").textContent = `${this.format(snapshot.measurement.value)} ${snapshot.measurement.unit}`;
    const secondaryRow = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-secondary-row]");
    secondaryRow.hidden = !snapshot.secondaryMeasurement;
    if (snapshot.secondaryMeasurement) {
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-secondary-label]").textContent = snapshot.secondaryMeasurement.label;
      this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-secondary-value]").textContent = `${this.format(snapshot.secondaryMeasurement.value)} ${snapshot.secondaryMeasurement.unit}`;
    }
    const measurementMemory = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-measurement-memory]");
    measurementMemory.hidden = snapshot.mode !== "induction" && snapshot.mode !== "generator";
    this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-peak-voltage]").textContent = `${this.format(this.peakVoltage)} V`;
    const resultDirection = electromagnetismResultDirection(snapshot.mode, snapshot.sign, snapshot.direction);
    const resultDirectionRow = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-result-direction]");
    resultDirectionRow.hidden = !resultDirection;
    this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-result-direction-value]").textContent = resultDirection;
    this.renderCircuitComparison(snapshot);
    if (snapshot.mode === "sandbox") {
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-title]").textContent = snapshot.sandboxGraph.title;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-x]").textContent = `가로축 · ${snapshot.sandboxGraph.xLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-y]").textContent = `세로축 · ${snapshot.sandboxGraph.yLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").textContent = "● 현재 구성";
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").style.color = snapshot.sandboxGraph.color;
    } else {
      const lab = electromagnetismLab(snapshot.mode);
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-title]").textContent = lab.graph.title;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-x]").textContent = `가로축 · ${lab.graph.xLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-y]").textContent = `세로축 · ${lab.graph.yLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").textContent = `● ${lab.graph.series[0].label}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").style.color = lab.graph.series[0].color;
    }
    this.renderGraph(snapshot);
  }

  private renderCircuitComparison(snapshot: ElectromagnetismSnapshot): void {
    const panel = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-trial-comparison]");
    const current = circuitTrialSummary(snapshot);
    panel.hidden = !current;
    if (!current) return;
    const markup = (label: string, trial: ElectromagnetismTrialSummary | null): string => {
      if (!trial) return `<span>${label}</span><p>아직 고정한 결과가 없어요.</p>`;
      return `<span>${label}</span><strong>${trial.condition}</strong><dl>${trial.values.map((value) => `<div><dt>${value.label}</dt><dd>${qualitativeLevel(value.value, 0, value.label.includes("전력") ? 8 : 4)}</dd></div>`).join("")}</dl>`;
    };
    this.require<HTMLElement>(panel, "[data-em-pinned-trial]").innerHTML = markup("고정한 결과", this.pinnedCircuitTrial);
    this.require<HTMLElement>(panel, "[data-em-current-trial]").innerHTML = markup("현재 결과", current);
    this.require<HTMLButtonElement>(panel, "[data-em-pin-comparison]").textContent = this.pinnedCircuitTrial
      ? "고정 결과 바꾸기"
      : "현재 결과 고정";
  }

  private renderGraph(snapshot: ElectromagnetismSnapshot): void {
    const canvas = this.require<HTMLCanvasElement>(this.hosts.inspectorPanel, "[data-em-graph-canvas]");
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const width = canvas.width; const height = canvas.height; const pad = { l: 44, r: 12, t: 14, b: 30 };
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    const finite = snapshot.graph.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (finite.length === 0) return;
    const marker = snapshot.graphMarker && Number.isFinite(snapshot.graphMarker.x) && Number.isFinite(snapshot.graphMarker.y) ? snapshot.graphMarker : null;
    const minX = Math.min(...finite.map((point) => point.x), marker?.x ?? Infinity); const maxX = Math.max(...finite.map((point) => point.x), marker?.x ?? -Infinity);
    let minY = Math.min(0, ...finite.map((point) => point.y), marker?.y ?? Infinity); let maxY = Math.max(0, ...finite.map((point) => point.y), marker?.y ?? -Infinity);
    if (maxY - minY < 1e-9) maxY = minY + 1;
    const px = (x: number) => pad.l + (x - minX) / Math.max(1e-9, maxX - minX) * (width - pad.l - pad.r);
    const py = (y: number) => pad.t + (maxY - y) / (maxY - minY) * (height - pad.t - pad.b);
    ctx.strokeStyle = "#e2e8f1"; ctx.lineWidth = 1;
    for (let line = 0; line <= 2; line += 1) { const y = pad.t + (height - pad.t - pad.b) * line / 2; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); }
    const color = snapshot.mode === "sandbox" ? snapshot.sandboxGraph.color : electromagnetismLab(snapshot.mode).graph.series[0].color;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); finite.forEach((point, index) => { if (index === 0) ctx.moveTo(px(point.x), py(point.y)); else ctx.lineTo(px(point.x), py(point.y)); }); ctx.stroke();
    if (marker) { ctx.fillStyle = "#fff"; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px(marker.x), py(marker.y), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = "#718096"; ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText("작음", pad.l, height - 8); ctx.textAlign = "right"; ctx.fillText("큼", width - pad.r, height - 8);
    ctx.textAlign = "right"; ctx.fillText("높음", pad.l - 5, pad.t + 4); ctx.fillText("낮음", pad.l - 5, height - pad.b);
  }

  private renderSandboxControls(selected: ElectromagnetismSandboxObject | null, snapshot: ElectromagnetismSnapshot): void {
    const controls = this.require<HTMLElement>(this.hosts.experimentPanel, "[data-em-controls]");
    if (!selected) {
      controls.innerHTML = "";
      controls.hidden = true;
      return;
    }
    controls.hidden = false;
    const choices = sandboxValueChoices[selected.kind] ?? [];
    const selectedCurrent = snapshot.sandboxCurrents.find((entry) => entry.objectId === selected.id)?.current ?? 0;
    const bulbPower = selected.kind === "bulb" ? sandboxBulbPower(selectedCurrent, selected.value) : 0;
    const bulbBrightness = selected.kind === "bulb" ? sandboxBulbBrightness(selectedCurrent, selected.value) : 0;
    const arrangementLabels = { none: "연결된 전지 없음", single: "전지 1개", series: "전지 직렬 연결", parallel: "전지 병렬 연결", mixed: "혼합 연결" } as const;
    const valueLabel = selected.kind === "charge" ? "전하량" : selected.kind === "battery" || selected.kind === "generator" ? "전압" : selected.kind === "resistor" || selected.kind === "bulb" || selected.kind === "motor" ? "저항·부하" : selected.kind === "capacitor" ? "판 사이 간격" : selected.kind === "current-wire" ? "전류 세기" : selected.kind === "field-region" ? "자기장 세기" : selected.kind === "magnet" ? "자석 세기" : selected.kind === "coil" ? "코일 감은 수" : selected.kind === "transformer" ? "2차 코일 감은 수" : selected.kind === "iron-load" ? "짐 무게" : "상태";
    controls.innerHTML = `
      <div class="em-selection-summary"><strong>${sandboxKindLabel[selected.kind]}</strong><span>${this.sandboxValueText(selected)}</span></div>
      <p class="em-interaction-help">${sandboxInteractionHelp[selected.kind]}</p>
      ${choices.length ? `<div class="em-choice"><span>${valueLabel}</span>${choices.map((choice) => `<button data-em-sandbox-value="${choice.value}" class="${Math.abs(Math.abs(selected.value) - choice.value) < 1e-12 ? "is-active" : ""}">${choice.label}</button>`).join("")}</div>` : ""}
      ${selected.kind === "battery" ? `<button class="em-wide-control" data-em-sandbox-action="battery-flip">전지 방향 뒤집기 (+/−)</button><p class="em-coupling-state">${arrangementLabels[snapshot.sandboxMetrics.batteryArrangement]} · 회로 전압 ${qualitativeLevel(snapshot.sandboxMetrics.circuitVoltage, 0, 18)}</p>` : ""}
      ${selected.kind === "bulb" ? `<p class="em-coupling-state">전구 ${qualitativeLevel(bulbBrightness, 0, 1, ["어두움", "보통", "밝음"])} · 전류 ${Math.abs(selectedCurrent) > 0.01 ? "흐름" : "멈춤"}</p>` : ""}
      ${selected.kind === "charge" ? `<button class="em-wide-control" data-em-sandbox-action="sign">${selected.value >= 0 ? "음전하로 바꾸기 (−)" : "양전하로 바꾸기 (+)"}</button><button class="em-wide-control ${selected.moving ? "is-active" : ""}" data-em-sandbox-action="charge-motion">${selected.moving ? "운동 멈추기" : "이 방향으로 출발"}</button>` : ""}
      ${selected.kind === "current-wire" ? `<button class="em-wide-control" data-em-sandbox-action="current">전류 방향 뒤집기 (${selected.value >= 0 ? "⊙ → ⊗" : "⊗ → ⊙"})</button>` : ""}
      ${selected.kind === "field-region" ? `<button class="em-wide-control" data-em-sandbox-action="field-direction">자기장 방향 뒤집기 (${selected.value >= 0 ? "⊙ → ⊗" : "⊗ → ⊙"})</button>` : ""}
      ${selected.kind === "capacitor" ? `<div class="em-choice"><span>미리 저장할 전압</span>${[{ label: "비우기", value: 0 }, { label: "보통", value: 4.5 }, { label: "높게", value: 9 }].map(({ label, value }) => `<button data-em-sandbox-secondary-value="${value}" class="${Math.abs((selected.secondaryValue ?? 0) - value) < 1e-12 ? "is-active" : ""}">${label}</button>`).join("")}</div><p class="em-coupling-state">축전기 · ${Math.abs(selected.secondaryValue ?? 0) > 0.05 ? "충전됨" : "비어 있음"}</p>` : ""}
      ${selected.kind === "magnet" ? `<button class="em-wide-control" data-em-sandbox-action="flip">N/S 방향 뒤집기</button><p>자석을 Canvas에서 짧게 눌러도 뒤집혀요.</p>` : ""}
      ${selected.kind === "switch" ? `<button class="em-wide-control" data-em-sandbox-action="toggle">${selected.enabled === false ? "스위치 닫기" : "스위치 열기"}</button>` : ""}
      ${selected.kind === "coil" ? `<p class="em-coupling-state">${Math.abs(selectedCurrent) > 1e-6 ? "전류가 흘러 전자석이 되었어요." : "닫힌 회로에 연결하거나 자석을 움직여 전류를 만들어 보세요."}</p>` : ""}
      ${selected.kind === "motor" ? `<p class="em-coupling-state">${Math.abs(selectedCurrent) > 1e-6 ? "전류가 흘러 회전 중이에요." : "닫힌 회로에 연결하면 축이 회전해요."}</p>` : ""}
      ${selected.kind === "generator" ? `<button class="em-wide-control ${selected.enabled === false ? "" : "is-active"}" data-em-sandbox-action="generator-toggle">${selected.enabled === false ? "손잡이 돌리기" : "회전 멈추기"}</button>` : ""}
      ${selected.kind === "probe" ? "<p>탐침을 끌어 옮기면 그 위치의 전기장과 전위가 측정돼요.</p>" : ""}
      <div class="em-object-actions">
        <button data-em-sandbox-action="duplicate">하나 더 복제</button>
        ${snapshot.sandboxConnections.some((connection) => connection.from === selected.id || connection.to === selected.id) ? `<button data-em-sandbox-action="disconnect">연결 끊기</button>` : ""}
      </div>`;
  }

  private sandboxValueText(object: ElectromagnetismSandboxObject): string {
    if (object.kind === "charge") return `${object.value >= 0 ? "+ 양전하" : "− 음전하"} · ${qualitativeLevel(Math.abs(object.value), 1e-6, 4e-6, ["작게", "보통", "크게"])}`;
    if (object.kind === "battery") return `전압 ${qualitativeLevel(object.value, 1.5, 9)}`;
    if (object.kind === "resistor" || object.kind === "bulb") return `부하 ${qualitativeLevel(object.value, 2, 20, ["작음", "보통", "큼"])}`;
    if (object.kind === "coil") return `코일 ${qualitativeLevel(object.value, 40, 140, ["적게", "보통", "많이"])}`;
    if (object.kind === "iron-load") return ["", "가벼운 짐", "보통 짐", "무거운 짐"][Math.round(object.value)] ?? "철제 짐";
    if (object.kind === "motor") return `부하 ${qualitativeLevel(object.value, 3, 12, ["작음", "보통", "큼"])}`;
    if (object.kind === "generator") return `발전 ${qualitativeLevel(object.value, 3, 9)} · ${object.enabled === false ? "멈춤" : "회전 중"}`;
    if (object.kind === "transformer") return `2차 코일 ${qualitativeLevel(object.value, 40, 140, ["적게", "보통", "많이"])}`;
    if (object.kind === "capacitor") return `판 간격 ${qualitativeLevel(object.value, 1, 10, ["좁음", "보통", "넓음"])} · ${Math.abs(object.secondaryValue ?? 0) > 0.05 ? "충전됨" : "비어 있음"}`;
    if (object.kind === "current-wire") return `${object.value >= 0 ? "화면 밖 ⊙" : "화면 안 ⊗"} · 전류 ${qualitativeLevel(Math.abs(object.value), 2, 9)}`;
    if (object.kind === "field-region") return `${object.value >= 0 ? "화면 밖 ⊙" : "화면 안 ⊗"} · 세기 ${qualitativeLevel(Math.abs(object.value), 0.5, 1.5)}`;
    if (object.kind === "magnet") return `${object.direction === -1 ? "S–N" : "N–S"} · 세기 ${qualitativeLevel(object.value, 0.5, 1.5)}`;
    if (object.kind === "switch") return object.enabled === false ? "열림" : "닫힘";
    return "위치 측정 중";
  }

  private pointer(event: PointerEvent): Vector2 {
    return this.renderer.pointerToModel(event.clientX, event.clientY);
  }

  private animate = (time: number): void => {
    const dt = this.previousFrameTime === 0 ? 1 / 60 : Math.min(1 / 30, (time - this.previousFrameTime) / 1000);
    this.previousFrameTime = time;
    if (!this.showingLab) {
      this.frame = requestAnimationFrame(this.animate);
      return;
    }
    const wasRunning = this.model.snapshot().running;
    this.model.step(dt);
    if (wasRunning) this.render();
    else {
      const snapshot = this.model.snapshot();
      this.renderer.render(snapshot, snapshot.time, this.selectedSandboxId, this.wiring, this.wireStart);
    }
    this.frame = requestAnimationFrame(this.animate);
  };

  private require<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`${selector} not found in electromagnetism experience`);
    return element;
  }

  private format(value: number): string {
    const absolute = Math.abs(value);
    if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) return value.toExponential(2);
    if (absolute >= 100) return value.toFixed(0);
    if (absolute >= 10) return value.toFixed(1);
    return value.toFixed(2).replace(/\.00$/, "");
  }
}

export const electromagnetismExperience: SubjectExperience = {
  definition: ELECTROMAGNETISM_SUBJECT,
  mount: (hosts) => new ElectromagnetismController(hosts),
};
