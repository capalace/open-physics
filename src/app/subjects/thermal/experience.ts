import { SubjectRouteSession, type SubjectController, type SubjectExperience, type SubjectHosts, type SubjectRoute } from "../subject-experience";
import { subjectBrowserMarkup, subjectCanvasPromptMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup, subjectSelectionMarkup, subjectSettingsHeaderMarkup } from "../subject-ui";
import { thermalDefinition, thermalLab, type ThermalLabId } from "./catalog";
import { ThermalWorld, type ThermalSceneId, type ThermalTool } from "./models";
import { renderThermalGraph, ThermalRenderer } from "./renderer";
import "./style.css";
import { formatDisplayNumber, formatSignedDisplayNumber } from "../../format-value";

const sandboxGraph = {
  kind: "line" as const,
  title: "장치 배치에 따른 온도",
  xLabel: "가로 위치 (%)",
  yLabel: "온도 (K)",
  series: [{ label: "공간 온도", color: "#ef7044" }],
};

const palette: ReadonlyArray<{ type: ThermalTool; label: string }> = [
  { type: "container", label: "입자 용기" }, { type: "heater", label: "열원" },
  { type: "cooler", label: "냉각원" }, { type: "conductor", label: "전도체" },
  { type: "insulator", label: "단열체" }, { type: "piston", label: "피스톤" },
  { type: "thermometer", label: "온도계" },
];

export function thermalPrimaryControlValue(snapshot: ReturnType<ThermalWorld["snapshot"]>): string {
  switch (snapshot.scene) {
    case "particles": return `${snapshot.temperature.toFixed(0)} K`;
    case "heat-transfer": return `열전도 ${(snapshot.control * 100).toFixed(0)}%`;
    case "thermal-expansion": return `${snapshot.temperature.toFixed(0)} °C`;
    case "phase-change": return `${snapshot.energy.toFixed(0)} kJ`;
    case "gas": return `${formatDisplayNumber(snapshot.volume)} L`;
    case "heat-energy": return `${formatDisplayNumber(snapshot.mass)} kg`;
    case "heat-engine": return `${snapshot.temperature.toFixed(0)} K`;
    case "entropy": return snapshot.control < 0.05 ? "칸막이 닫힘" : `섞임 ${(snapshot.control * 100).toFixed(0)}%`;
    case "sandbox": return "";
  }
}

export function thermalPrimaryOutcome(snapshot: ReturnType<ThermalWorld["snapshot"]>): { text: string; tone: "neutral" | "success" | "warning" } {
  switch (snapshot.scene) {
    case "particles": return { text: `입자 평균 속력 ${formatDisplayNumber(Math.sqrt(snapshot.temperature / 300))}배`, tone: "neutral" };
    case "heat-transfer": return { text: `누적 이동 열 ${formatDisplayNumber(snapshot.energy)} kJ`, tone: snapshot.energy > 10 ? "success" : "neutral" };
    case "thermal-expansion": return { text: `길이 변화 ${formatSignedDisplayNumber(snapshot.expansion, 2)} mm`, tone: "neutral" };
    case "phase-change": {
      const phase = snapshot.liquidFraction <= 0 ? "고체" : snapshot.liquidFraction >= 1 ? "액체" : `녹는 중 ${(snapshot.liquidFraction * 100).toFixed(0)}%`;
      return { text: `${phase} · ${formatDisplayNumber(snapshot.temperature)} °C`, tone: snapshot.liquidFraction > 0 && snapshot.liquidFraction < 1 ? "success" : "neutral" };
    }
    case "gas": return { text: `압력 ${formatDisplayNumber(snapshot.pressure)} kPa`, tone: snapshot.volume < 10 ? "warning" : "neutral" };
    case "heat-energy": return { text: `온도 변화 ${formatDisplayNumber(snapshot.temperature - 20)} °C`, tone: "neutral" };
    case "heat-engine": return { text: `최대 효율 ${(snapshot.efficiency * 100).toFixed(0)}% · 일 ${snapshot.energy.toFixed(0)} J`, tone: "success" };
    case "entropy": return { text: `엔트로피 변화 ${formatDisplayNumber(snapshot.entropy)} J/K`, tone: snapshot.entropy > 0 ? "success" : "neutral" };
    case "sandbox": return { text: "", tone: "neutral" };
  }
}

export class ThermalExperienceController implements SubjectController {
  readonly world = new ThermalWorld("sandbox");
  private renderer: ThermalRenderer;
  private graphCanvas: HTMLCanvasElement;
  private animation = 0;
  private previousTime = 0;
  private disposed = false;
  private readonly routeSession: SubjectRouteSession;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.workspace.innerHTML = `<section class="thermal-experience subject-lab-screen" data-subject-lab-screen hidden><div class="thermal-toolbar world-toolbar" aria-label="열 실험 실행"><div class="transport-controls"><button class="primary-button" type="button" data-action="play">▶ 실행</button><button class="icon-button text-button" type="button" data-action="step">한 단계</button><button class="icon-button text-button" type="button" data-action="reset">↻ 처음으로</button></div><div class="toolbar-divider"></div><span class="run-indicator" data-running="false" aria-live="polite">멈춤</span></div>${subjectCanvasPromptMarkup()}<canvas class="thermal-canvas" aria-label="열 실험 장면"></canvas></section>`;
    const browser = subjectBrowserMarkup(thermalDefinition, {
      rootClass: "thermal-panel",
      listClass: "thermal-lab-list",
      buttonClass: "thermal-lab-button",
      choiceAttribute: "data-scene",
    });
    hosts.workspace.insertAdjacentHTML("afterbegin", subjectSelectionMarkup(thermalDefinition, browser));
    hosts.experimentPanel.innerHTML = `${subjectSettingsHeaderMarkup()}<div class="thermal-palette subject-settings-tools" data-subject-settings-tools hidden></div><div data-subject-device-settings></div>`;
    hosts.inspectorPanel.innerHTML = `<article class="thermal-guide"></article><section class="thermal-graph-card"><h3></h3><p class="thermal-current" aria-live="polite"></p><canvas class="thermal-graph" aria-label="열 실험 그래프"></canvas><div class="thermal-legend"></div></section>`;
    const canvas = hosts.workspace.querySelector<HTMLCanvasElement>(".thermal-canvas")!;
    this.graphCanvas = hosts.inspectorPanel.querySelector<HTMLCanvasElement>(".thermal-graph")!;
    this.renderer = new ThermalRenderer(this.world, canvas, () => this.refresh());
    this.routeSession = new SubjectRouteSession({ definition: thermalDefinition, onRoute: (route) => this.applyRoute(route) });
    this.bind();
    hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-back]")!.addEventListener("click", () => this.routeSession.returnToSelection());
    this.routeSession.start();
    this.animation = requestAnimationFrame((time) => this.frame(time));
  }

  resize(): void {
    const shell = this.hosts.workspace.querySelector<HTMLElement>(".thermal-experience")!;
    const width = Math.max(320, shell.clientWidth || 900);
    const height = width * (window.matchMedia("(max-width: 700px)").matches ? 3 / 4 : 5 / 8);
    this.renderer.resize(width, height);
    this.refresh();
  }

  unmount(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.renderer.destroy();
    this.routeSession.dispose();
    this.hosts.workspace.innerHTML = "";
    this.hosts.experimentPanel.innerHTML = "";
    this.hosts.inspectorPanel.innerHTML = "";
    delete document.body.dataset.subjectScreen;
  }

  activate(scene: ThermalSceneId): void {
    this.world.reset(scene);
    this.refreshPanels();
    this.refresh();
  }

  private bind(): void {
    this.hosts.workspace.querySelectorAll<HTMLElement>("[data-scene]").forEach((button) =>
      button.addEventListener("click", () => this.routeSession.openLab(button.dataset.scene as ThermalSceneId)));
    this.hosts.workspace.querySelector("[data-action=play]")!.addEventListener("click", () => { this.world.toggle(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=step]")!.addEventListener("click", () => { const wasRunning = this.world.running; this.world.play(); this.world.step(1 / 15); if (!wasRunning) this.world.pause(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=reset]")!.addEventListener("click", () => this.activate(this.world.scene));
  }

  private refreshPanels(): void {
    const guide = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-guide")!;
    const paletteHost = this.hosts.experimentPanel.querySelector<HTMLElement>(".thermal-palette")!;
    const controlHost = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-device-settings]")!;
    controlHost.replaceChildren();
    this.hosts.workspace.querySelector(".world-toolbar")?.classList.toggle("is-sandbox", this.world.scene === "sandbox");
    this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-title]")!.textContent = this.world.scene === "sandbox" ? "실험실 도구" : "바꿔 볼 조건";
    this.hosts.experimentPanel.querySelector<HTMLElement>(".subject-settings-header > div")!.hidden = this.world.scene !== "sandbox";
    this.hosts.workspace.querySelector<HTMLElement>("[data-subject-action-prompt]")!.hidden = this.world.scene === "sandbox";
    if (this.world.scene === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        thermalDefinition,
        ["위 도구에서 장치를 추가해요.", "장치를 끌어 서로 가까이 놓아요.", "선택한 장치의 설정을 바꾸고 측정해요."],
        "장면의 입자 운동과 온도·압력 측정이 함께 달라지는지 보세요.",
      );
      paletteHost.hidden = false;
      const removable = [...this.world.snapshot().objects].reverse().find((object) => !object.protected);
      paletteHost.innerHTML = `<span class="palette-label">추가</span>${palette.map((item) => `<button type="button" data-tool="${item.type}">＋ ${item.label}</button>`).join("")}<button class="danger-button" type="button" data-remove ${removable ? "" : "disabled"}>삭제</button>`;
      paletteHost.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => button.addEventListener("click", () => { this.world.addObject(button.dataset.tool as ThermalTool, 0.45 + (this.world.snapshot().objects.length % 4) * 0.1, 0.48); this.refreshPanels(); this.refresh(); }));
      paletteHost.querySelector<HTMLButtonElement>("[data-remove]")!.addEventListener("click", () => { const target = [...this.world.snapshot().objects].reverse().find((object) => !object.protected); if (target) this.world.removeObject(target.id); this.refreshPanels(); this.refresh(); });
      const card = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-graph-card")!;
      card.hidden = false;
      card.querySelector("h3")!.textContent = sandboxGraph.title;
      card.querySelector<HTMLElement>(".thermal-legend")!.innerHTML = `<span><i style="background:${sandboxGraph.series[0].color}"></i>${sandboxGraph.series[0].label}</span>`;
      return;
    }
    paletteHost.hidden = true;
    const lab = thermalLab(this.world.scene as ThermalLabId);
    guide.innerHTML = subjectGuideMarkup(lab);
    const card = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-graph-card")!;
    card.hidden = false;
    card.querySelector("h3")!.textContent = lab.graph.title;
    card.querySelector<HTMLElement>(".thermal-legend")!.innerHTML = lab.graph.series.map((series) => `<span><i style="background:${series.color}"></i>${series.label}</span>`).join("");
  }

  private applyRoute(route: SubjectRoute): void {
    const selection = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-selection-screen]")!;
    const lab = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-lab-screen]")!;
    if (route.screen === "selection") {
      this.world.pause();
      document.body.dataset.subjectScreen = "selection";
      selection.hidden = false;
      lab.hidden = true;
      return;
    }
    document.body.dataset.subjectScreen = "lab";
    selection.hidden = true;
    lab.hidden = false;
    this.activate(route.labId as ThermalSceneId);
    this.resize();
  }

  private frame(time: number): void {
    if (this.disposed) return;
    const elapsed = this.previousTime === 0 ? 0 : Math.min(0.05, (time - this.previousTime) / 1000);
    this.previousTime = time;
    if (this.world.running && elapsed > 0) {
      this.world.step(elapsed);
      this.refresh();
    }
    this.animation = requestAnimationFrame((next) => this.frame(next));
  }

  private refresh(): void {
    this.renderer.render();
    const button = this.hosts.workspace.querySelector<HTMLButtonElement>("[data-action=play]");
    if (button) { button.textContent = this.world.running ? "Ⅱ 일시정지" : "▶ 실행"; button.dataset.running = String(this.world.running); }
    const run = this.hosts.workspace.querySelector<HTMLElement>(".run-indicator");
    if (run) { run.textContent = this.world.running ? "실행 중" : "멈춤"; run.dataset.running = String(this.world.running); }
    const snapshot = this.world.snapshot();
    if (this.world.scene !== "sandbox") {
      renderThermalGraph(this.graphCanvas, snapshot, thermalLab(this.world.scene).graph);
      const current = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-current");
      if (current) current.textContent = this.currentValue(snapshot);
    } else {
      renderThermalGraph(this.graphCanvas, snapshot, sandboxGraph);
      const current = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-current");
      if (current) {
        const measured = snapshot.thermometerReadings[0]?.temperature ?? snapshot.temperature;
        current.textContent = `온도계 ${formatDisplayNumber(measured)} K · 압력 ${formatDisplayNumber(snapshot.pressure)} kPa · 열 흐름 ${formatDisplayNumber(snapshot.heatFlow)}`;
      }
    }
  }

  private currentValue(snapshot: ReturnType<ThermalWorld["snapshot"]>): string {
    switch (snapshot.scene) {
      case "particles": return `현재 ${snapshot.temperature.toFixed(0)} K`;
      case "heat-transfer": return `누적 ${formatDisplayNumber(snapshot.energy)} kJ`;
      case "thermal-expansion": return `${formatDisplayNumber(snapshot.temperature, 0)} °C · ΔL ${formatSignedDisplayNumber(snapshot.expansion, 2)} mm`;
      case "phase-change": return `${formatDisplayNumber(snapshot.energy, 0)} kJ · ${formatDisplayNumber(snapshot.temperature)} °C`;
      case "gas": return `${formatDisplayNumber(snapshot.volume)} L · ${formatDisplayNumber(snapshot.pressure)} kPa`;
      case "heat-energy": return `${formatDisplayNumber(snapshot.mass)} kg · ΔT ${formatDisplayNumber(snapshot.temperature - 20)} °C`;
      case "heat-engine": return `${formatDisplayNumber(snapshot.volume)} L · ${formatDisplayNumber(snapshot.pressure)} kPa · 효율 ${formatDisplayNumber(snapshot.efficiency * 100, 0)}%`;
      case "entropy": return `섞임 ${formatDisplayNumber(snapshot.control * 100, 0)}% · ΔS ${formatDisplayNumber(snapshot.entropy)} J/K`;
      case "sandbox": return "";
    }
  }
}

export const thermalExperience: SubjectExperience = {
  definition: thermalDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new ThermalExperienceController(hosts); },
};
