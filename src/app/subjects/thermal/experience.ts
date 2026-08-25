import type { SubjectController, SubjectExperience, SubjectHosts } from "../subject-experience";
import { thermalDefinition, thermalLab, type ThermalLabId } from "./catalog";
import { ThermalWorld, type ThermalSceneId, type ThermalTool } from "./models";
import { renderThermalGraph, ThermalRenderer } from "./renderer";
import "./style.css";

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
    hosts.workspace.innerHTML = `<section class="thermal-experience"><div class="thermal-toolbar" aria-label="열 실험 실행"><button type="button" data-action="play">⏸ 멈춤</button><button type="button" data-action="step">한 단계</button><button type="button" data-action="reset">↻ 처음으로</button></div><canvas class="thermal-canvas" aria-label="열 실험 장면"></canvas></section>`;
    hosts.experimentPanel.innerHTML = `<div class="thermal-panel"><label class="thermal-label" for="thermal-lab-select">실험 선택</label><select id="thermal-lab-select" class="thermal-select">${thermalDefinition.labs.map((lab) => `<option value="${lab.id}">${lab.icon} ${lab.title}</option>`).join("")}<option value="sandbox">＋ ${thermalDefinition.sandboxTitle}</option></select><div class="thermal-palette" hidden></div></div>`;
    hosts.inspectorPanel.innerHTML = `<article class="thermal-guide"></article><section class="thermal-graph-card"><h3></h3><canvas class="thermal-graph" aria-label="열 실험 그래프"></canvas><div class="thermal-legend"></div></section>`;
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
    this.refreshPanels();
    this.refresh();
  }

  private bind(): void {
    this.hosts.experimentPanel.querySelector("select")!.addEventListener("change", (event) => this.activate((event.target as HTMLSelectElement).value as ThermalSceneId));
    this.hosts.workspace.querySelector("[data-action=play]")!.addEventListener("click", () => { this.world.toggle(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=step]")!.addEventListener("click", () => { const wasRunning = this.world.running; this.world.play(); this.world.step(1 / 15); if (!wasRunning) this.world.pause(); this.refresh(); });
    this.hosts.workspace.querySelector("[data-action=reset]")!.addEventListener("click", () => this.activate(this.world.scene));
  }

  private refreshPanels(): void {
    const guide = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-guide")!;
    const paletteHost = this.hosts.experimentPanel.querySelector<HTMLElement>(".thermal-palette")!;
    if (this.world.scene === "sandbox") {
      guide.innerHTML = `<p class="thermal-kicker">자유 탐구</p><h2>${thermalDefinition.sandboxTitle}</h2><p>${thermalDefinition.sandboxDescription}</p><ol><li>팔레트에서 장치를 추가해요.</li><li>장치를 끌어 서로 가까이 놓아요.</li><li>아래 손잡이로 세기를 바꾸고 측정해요.</li></ol><p class="thermal-observe">장면의 입자 운동과 온도·압력 측정이 함께 달라지는지 보세요.</p>`;
      paletteHost.hidden = false;
      paletteHost.innerHTML = `<p>장치 팔레트</p>${palette.map((item) => `<button type="button" data-tool="${item.type}">＋ ${item.label}</button>`).join("")}<button type="button" data-remove>마지막 장치 지우기</button>`;
      paletteHost.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => button.addEventListener("click", () => { this.world.addObject(button.dataset.tool as ThermalTool, 0.45 + (this.world.snapshot().objects.length % 4) * 0.1, 0.48); this.refresh(); }));
      paletteHost.querySelector<HTMLButtonElement>("[data-remove]")!.addEventListener("click", () => { const removable = [...this.world.snapshot().objects].reverse().find((object) => !object.protected); if (removable) this.world.removeObject(removable.id); this.refresh(); });
      this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-graph-card")!.hidden = true;
      return;
    }
    paletteHost.hidden = true;
    const lab = thermalLab(this.world.scene as ThermalLabId);
    guide.innerHTML = `<p class="thermal-kicker">${lab.category}</p><h2>${lab.icon} ${lab.title}</h2><p class="thermal-question">${lab.question}</p><ol>${lab.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="thermal-observe"><strong>관찰:</strong> ${lab.observe}</p><details open><summary>${lab.law.title}</summary><p>${lab.law.description}</p><code>${lab.law.equation}</code></details>`;
    const card = this.hosts.inspectorPanel.querySelector<HTMLElement>(".thermal-graph-card")!;
    card.hidden = false;
    card.querySelector("h3")!.textContent = lab.graph.title;
    card.querySelector<HTMLElement>(".thermal-legend")!.innerHTML = lab.graph.series.map((series) => `<span><i style="background:${series.color}"></i>${series.label}</span>`).join("");
  }

  private frame(time: number): void {
    if (this.disposed) return;
    const elapsed = this.previousTime === 0 ? 0 : Math.min(0.05, (time - this.previousTime) / 1000);
    this.previousTime = time;
    this.world.step(elapsed);
    this.refresh();
    this.animation = requestAnimationFrame((next) => this.frame(next));
  }

  private refresh(): void {
    this.renderer.render();
    const button = this.hosts.workspace.querySelector<HTMLButtonElement>("[data-action=play]");
    if (button) button.textContent = this.world.running ? "⏸ 멈춤" : "▶ 실행";
    if (this.world.scene !== "sandbox") renderThermalGraph(this.graphCanvas, this.world.snapshot(), thermalLab(this.world.scene).graph);
  }
}

export const thermalExperience: SubjectExperience = {
  definition: thermalDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new ThermalExperienceController(hosts); },
};
