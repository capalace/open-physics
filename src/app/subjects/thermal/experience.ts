import type { SubjectController, SubjectExperience, SubjectHosts } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup } from "../subject-ui";
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

export class ThermalExperienceController implements SubjectController {
  readonly world = new ThermalWorld();
  private renderer: ThermalRenderer;
  private graphCanvas: HTMLCanvasElement;
  private animation = 0;
  private previousTime = 0;
  private disposed = false;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.workspace.innerHTML = `<section class="thermal-experience"><div class="thermal-toolbar world-toolbar" aria-label="열 실험 실행"><button class="primary-button" type="button" data-action="play">⏸ 멈춤</button><button class="icon-button text-button" type="button" data-action="step">한 단계</button><button class="icon-button text-button" type="button" data-action="reset">↻ 처음으로</button></div><canvas class="thermal-canvas" aria-label="열 실험 장면"></canvas></section>`;
    hosts.experimentPanel.innerHTML = `${subjectBrowserMarkup(thermalDefinition, {
      rootClass: "thermal-panel",
      listClass: "thermal-lab-list",
      buttonClass: "thermal-lab-button",
      choiceAttribute: "data-scene",
    })}<div class="thermal-palette" hidden></div>`;
    hosts.inspectorPanel.innerHTML = `<article class="thermal-guide"></article><section class="thermal-graph-card"><h3></h3><p class="thermal-current" aria-live="polite"></p><canvas class="thermal-graph" aria-label="열 실험 그래프"></canvas><div class="thermal-legend"></div></section>`;
    const canvas = hosts.workspace.querySelector<HTMLCanvasElement>(".thermal-canvas")!;
    this.graphCanvas = hosts.inspectorPanel.querySelector<HTMLCanvasElement>(".thermal-graph")!;
    this.renderer = new ThermalRenderer(this.world, canvas, () => this.refresh());
    this.bind();
    this.refreshPanels();
    this.resize();
    this.animation = requestAnimationFrame((time) => this.frame(time));
  }

  resize(): void {
    const width = Math.max(520, this.hosts.workspace.clientWidth || 900);
    const height = Math.max(420, this.hosts.workspace.clientHeight - 58 || 560);
    this.renderer.resize(width, height);
    this.refresh();
  }

  unmount(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.renderer.destroy();
    this.hosts.workspace.innerHTML = "";
    this.hosts.experimentPanel.innerHTML = "";
    this.hosts.inspectorPanel.innerHTML = "";
  }

  activate(scene: ThermalSceneId): void {
    this.world.reset(scene);
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-scene]").forEach((button) => {
      const active = button.dataset.scene === scene;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.refreshPanels();
    this.refresh();
  }

  private bind(): void {
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-scene]").forEach((button) =>
      button.addEventListener("click", () => this.activate(button.dataset.scene as ThermalSceneId)));
    this.hosts.workspace.querySelector("[data-action=play]")!.addEventListener("click", () => { this.world.toggle(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=step]")!.addEventListener("click", () => { const wasRunning = this.world.running; this.world.play(); this.world.step(1 / 15); if (!wasRunning) this.world.pause(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=reset]")!.addEventListener("click", () => this.activate(this.world.scene));
  }

  private refreshPanels(): void {
    const guide = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-guide")!;
    const paletteHost = this.hosts.experimentPanel.querySelector<HTMLElement>(".thermal-palette")!;
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-scene]").forEach((button) => {
      const active = button.dataset.scene === this.world.scene;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (this.world.scene === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        thermalDefinition,
        ["팔레트에서 장치를 추가해요.", "장치를 끌어 서로 가까이 놓아요.", "손잡이로 세기를 바꾸고 측정해요."],
        "장면의 입자 운동과 온도·압력 측정이 함께 달라지는지 보세요.",
      );
      paletteHost.hidden = false;
      paletteHost.innerHTML = `<p>장치 팔레트</p>${palette.map((item) => `<button type="button" data-tool="${item.type}">＋ ${item.label}</button>`).join("")}<button type="button" data-remove>마지막 장치 지우기</button>`;
      paletteHost.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => button.addEventListener("click", () => { this.world.addObject(button.dataset.tool as ThermalTool, 0.45 + (this.world.snapshot().objects.length % 4) * 0.1, 0.48); this.refresh(); }));
      paletteHost.querySelector<HTMLButtonElement>("[data-remove]")!.addEventListener("click", () => { const removable = [...this.world.snapshot().objects].reverse().find((object) => !object.protected); if (removable) this.world.removeObject(removable.id); this.refresh(); });
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
    if (button) button.textContent = this.world.running ? "⏸ 멈춤" : "▶ 실행";
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
        current.textContent = `온도계 ${measured.toFixed(1)} K · 압력 ${snapshot.pressure.toFixed(1)} kPa · 열 흐름 ${snapshot.heatFlow.toFixed(1)}`;
      }
    }
  }

  private currentValue(snapshot: ReturnType<ThermalWorld["snapshot"]>): string {
    switch (snapshot.scene) {
      case "particles": return `현재 ${snapshot.temperature.toFixed(0)} K`;
      case "heat-transfer": return `누적 ${snapshot.energy.toFixed(2)} kJ`;
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
