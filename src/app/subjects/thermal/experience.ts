import { SubjectRouteSession, type SubjectController, type SubjectExperience, type SubjectHosts, type SubjectRoute } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup, subjectSelectionMarkup, subjectSettingsHeaderMarkup } from "../subject-ui";
import { thermalDefinition, thermalLab, type ThermalLabId } from "./catalog";
import { ThermalWorld, type ThermalSceneId, type ThermalTool } from "./models";
import { renderThermalGraph, ThermalRenderer } from "./renderer";
import "./style.css";

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

const guidedControlLabels: Record<ThermalLabId, { label: string; low: string; high: string }> = {
  particles: { label: "가열 세기", low: "차갑게", high: "뜨겁게" },
  "heat-transfer": { label: "연결 재료", low: "단열체", high: "전도체" },
  "thermal-expansion": { label: "막대 온도", low: "낮게", high: "높게" },
  "phase-change": { label: "가한 열", low: "적게", high: "많이" },
  gas: { label: "피스톤 위치", low: "압축", high: "팽창" },
  "heat-energy": { label: "물질의 양", low: "적게", high: "많이" },
  "heat-engine": { label: "뜨거운 저장고 온도", low: "낮게", high: "높게" },
  entropy: { label: "칸막이", low: "닫힘", high: "열림" },
};

export class ThermalExperienceController implements SubjectController {
  readonly world = new ThermalWorld("sandbox");
  private renderer: ThermalRenderer;
  private graphCanvas: HTMLCanvasElement;
  private animation = 0;
  private previousTime = 0;
  private disposed = false;
  private readonly routeSession: SubjectRouteSession;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.workspace.innerHTML = `<section class="thermal-experience subject-lab-screen" data-subject-lab-screen hidden><div class="thermal-toolbar world-toolbar" aria-label="열 실험 실행"><div class="transport-controls"><button class="primary-button" type="button" data-action="play">▶ 실행</button><button class="icon-button text-button" type="button" data-action="step">한 단계</button><button class="icon-button text-button" type="button" data-action="reset">↻ 처음으로</button></div><div class="toolbar-divider"></div><span class="run-indicator" data-running="false">멈춤</span></div><canvas class="thermal-canvas" aria-label="열 실험 장면"></canvas></section>`;
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
    const toolbar = shell.querySelector<HTMLElement>(".thermal-toolbar")!;
    const width = Math.max(520, shell.clientWidth || 900);
    const height = Math.max(420, shell.clientHeight - toolbar.offsetHeight - 12 || 560);
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
    if (this.world.scene === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        thermalDefinition,
        ["위 도구에서 장치를 추가해요.", "장치를 끌어 서로 가까이 놓아요.", "손잡이로 세기를 바꾸고 측정해요."],
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
    const control = guidedControlLabels[this.world.scene as ThermalLabId];
    const ratio = this.world.snapshot().control;
    controlHost.innerHTML = `<label class="subject-direct-control"><span>${control.label}</span><input type="range" min="0" max="100" step="1" value="${Math.round(ratio * 100)}" data-thermal-primary-range aria-label="${control.label}"><div><small>${control.low}</small><output>${Math.round(ratio * 100)}%</output><small>${control.high}</small></div></label><p class="subject-settings-hint">슬라이더나 캔버스의 손잡이로 같은 조건을 바꿀 수 있어요.</p>`;
    controlHost.querySelector<HTMLInputElement>("[data-thermal-primary-range]")!.addEventListener("input", (event) => {
      this.world.setControl(Number((event.target as HTMLInputElement).value) / 100); this.refresh();
    });
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
    const range = this.hosts.experimentPanel.querySelector<HTMLInputElement>("[data-thermal-primary-range]");
    if (range) {
      range.value = String(Math.round(snapshot.control * 100));
      const output = range.parentElement?.querySelector("output");
      if (output) output.textContent = `${Math.round(snapshot.control * 100)}%`;
    }
    if (this.world.scene !== "sandbox") {
      renderThermalGraph(this.graphCanvas, snapshot, thermalLab(this.world.scene).graph);
      const current = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-current");
      if (current) current.textContent = this.currentValue(snapshot);
    } else {
      renderThermalGraph(this.graphCanvas, snapshot, sandboxGraph);
      const current = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-current");
      if (current) {
        const measured = snapshot.thermometerReadings[0]?.temperature ?? snapshot.temperature;
        current.textContent = `온도계 ${measured.toFixed(1)} K · 압력 ${snapshot.pressure.toFixed(1)} kPa · 열 흐름 ${snapshot.heatFlow.toFixed(1)}`;
      }
    }
  }

  private currentValue(snapshot: ReturnType<ThermalWorld["snapshot"]>): string {
    switch (snapshot.scene) {
      case "particles": return `현재 ${snapshot.temperature.toFixed(0)} K`;
      case "heat-transfer": return `누적 ${snapshot.energy.toFixed(2)} kJ`;
      case "thermal-expansion": return `${snapshot.temperature.toFixed(0)} °C · ΔL ${snapshot.expansion >= 0 ? "+" : ""}${snapshot.expansion.toFixed(2)} mm`;
      case "phase-change": return `${snapshot.energy.toFixed(0)} kJ · ${snapshot.temperature.toFixed(1)} °C`;
      case "gas": return `${snapshot.volume.toFixed(1)} L · ${snapshot.pressure.toFixed(1)} kPa`;
      case "heat-energy": return `${snapshot.mass.toFixed(2)} kg · ΔT ${(snapshot.temperature - 20).toFixed(1)} °C`;
      case "heat-engine": return `${snapshot.volume.toFixed(1)} L · ${snapshot.pressure.toFixed(1)} kPa · 효율 ${(snapshot.efficiency * 100).toFixed(0)}%`;
      case "entropy": return `섞임 ${(snapshot.control * 100).toFixed(0)}% · ΔS ${snapshot.entropy.toFixed(2)} J/K`;
      case "sandbox": return "";
    }
  }
}

export const thermalExperience: SubjectExperience = {
  definition: thermalDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new ThermalExperienceController(hosts); },
};
