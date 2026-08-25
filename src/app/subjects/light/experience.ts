import type { SubjectController, SubjectExperience, SubjectHosts } from "../subject-experience";
import { lightDefinition, lightLab, type LightLabId } from "./catalog";
import { LightLabModel, type LightDeviceKind, type LightSceneId } from "./models";
import { LightRenderer } from "./renderer";
import "./style.css";

class LightController implements SubjectController {
  private readonly model = new LightLabModel();
  private readonly canvas: HTMLCanvasElement;
  private readonly graphCanvas: HTMLCanvasElement;
  private readonly renderer: LightRenderer;
  private readonly abort = new AbortController();
  private selectedSandboxDevice: string | null = null;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.experimentPanel.classList.add("light-experience__experiments");
    hosts.workspace.classList.add("light-experience__workspace");
    hosts.inspectorPanel.classList.add("light-experience__inspector");
    hosts.workspace.innerHTML = `<div class="light-experience__stage"><canvas aria-label="빛 실험 장면"></canvas><div class="light-experience__value" aria-live="polite"></div></div>`;
    this.canvas = hosts.workspace.querySelector("canvas")!;
    hosts.inspectorPanel.innerHTML = `<section class="light-experience__guide"></section><section class="light-experience__graph"><h3></h3><canvas aria-label="실험 그래프"></canvas><div class="light-experience__axes"></div></section><section class="light-experience__palette" hidden></section>`;
    this.graphCanvas = hosts.inspectorPanel.querySelector(".light-experience__graph canvas")!;
    this.renderer = new LightRenderer(this.canvas, this.graphCanvas);
    this.renderExperimentList();
    this.bindPointer();
    this.activate("propagation");
  }

  resize(): void { this.renderer.resize(); this.paint(); }

  unmount(): void {
    this.abort.abort();
    this.hosts.experimentPanel.classList.remove("light-experience__experiments");
    this.hosts.workspace.classList.remove("light-experience__workspace");
    this.hosts.inspectorPanel.classList.remove("light-experience__inspector");
    this.hosts.experimentPanel.replaceChildren();
    this.hosts.workspace.replaceChildren();
    this.hosts.inspectorPanel.replaceChildren();
  }

  private renderExperimentList(): void {
    const cards = lightDefinition.labs.map((lab) => `<button type="button" data-light-lab="${lab.id}"><span>${lab.icon}</span><strong>${lab.title}</strong><small>${lab.category}</small></button>`).join("");
    this.hosts.experimentPanel.innerHTML = `<div class="light-experience"><p class="light-experience__eyebrow">${lightDefinition.eyebrow}</p><h2>빛 실험 선택</h2><div class="light-experience__list">${cards}<button type="button" data-light-lab="sandbox"><span>＋</span><strong>${lightDefinition.sandboxTitle}</strong><small>자유 구성</small></button></div></div>`;
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-light-lab]").forEach((button) => {
      button.addEventListener("click", () => this.activate(button.dataset.lightLab as LightSceneId), { signal: this.abort.signal });
    });
  }

  private bindPointer(): void {
    const point = (event: PointerEvent) => this.renderer.worldPoint(event);
    this.canvas.addEventListener("pointerdown", (event) => {
      const world = point(event);
      if (this.model.pointerDown(world)) {
        this.canvas.setPointerCapture(event.pointerId);
        if (this.model.activeScene === "sandbox") {
          const nearest = this.model.snapshot().devices.find((item) => Math.hypot(item.x - world.x, item.y - world.y) <= 30);
          this.selectedSandboxDevice = nearest?.id ?? null;
          this.renderPalette();
        }
      }
    }, { signal: this.abort.signal });
    this.canvas.addEventListener("pointermove", (event) => { if (this.model.pointerMove(point(event))) this.paint(); }, { signal: this.abort.signal });
    const release = () => this.model.pointerUp();
    this.canvas.addEventListener("pointerup", release, { signal: this.abort.signal });
    this.canvas.addEventListener("pointercancel", release, { signal: this.abort.signal });
  }

  private activate(sceneId: LightSceneId): void {
    this.model.load(sceneId);
    this.selectedSandboxDevice = null;
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-light-lab]").forEach((button) => {
      const active = button.dataset.lightLab === sceneId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.renderGuide();
    this.renderPalette();
    this.paint();
  }

  private renderGuide(): void {
    const guide = this.hosts.inspectorPanel.querySelector<HTMLElement>(".light-experience__guide")!;
    if (this.model.activeScene === "sandbox") {
      guide.innerHTML = `<p class="light-experience__eyebrow">자유 구성</p><h2>${lightDefinition.sandboxTitle}</h2><p>${lightDefinition.sandboxDescription}</p><ol><li>아래 팔레트에서 장치를 추가해요.</li><li>Canvas에서 장치를 잡아 옮겨요.</li><li>필요 없는 장치를 선택해 지워요.</li></ol><p class="light-experience__observe">광원과 장치를 옮길 때 실제 광선 경로가 함께 이어지는지 확인하세요.</p>`;
      return;
    }
    const lab = lightLab(this.model.activeScene as LightLabId);
    guide.innerHTML = `<p class="light-experience__eyebrow">탐구 질문</p><h2>${lab.title}</h2><p class="light-experience__question">${lab.question}</p><ol>${lab.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="light-experience__observe"><strong>관찰:</strong> ${lab.observe}</p><details><summary>${lab.law.title}</summary><p>${lab.law.description}</p><code>${lab.law.equation}</code></details><button type="button" data-light-reset>처음으로</button>`;
    guide.querySelector("[data-light-reset]")?.addEventListener("click", () => { this.model.reset(); this.paint(); }, { signal: this.abort.signal });
    const graph = this.hosts.inspectorPanel.querySelector<HTMLElement>(".light-experience__graph")!;
    graph.querySelector("h3")!.textContent = lab.graph.title;
    graph.querySelector(".light-experience__axes")!.textContent = `${lab.graph.xLabel} · ${lab.graph.yLabel}`;
  }

  private renderPalette(): void {
    const palette = this.hosts.inspectorPanel.querySelector<HTMLElement>(".light-experience__palette")!;
    palette.hidden = this.model.activeScene !== "sandbox";
    if (palette.hidden) return;
    const kinds: readonly LightDeviceKind[] = ["source", "mirror", "boundary", "lens", "prism", "slit", "screen"];
    const labels: Record<LightDeviceKind, string> = { source: "광원", mirror: "거울", boundary: "경계면", lens: "렌즈", prism: "프리즘", slit: "슬릿", screen: "스크린" };
    palette.innerHTML = `<h3>광학 장치</h3><div>${kinds.map((kind) => `<button type="button" data-add-light="${kind}">+ ${labels[kind]}</button>`).join("")}</div><button type="button" data-delete-light ${this.selectedSandboxDevice ? "" : "disabled"}>선택 장치 지우기</button><button type="button" data-light-reset>처음으로</button>`;
    palette.querySelectorAll<HTMLElement>("[data-add-light]").forEach((button) => button.addEventListener("click", () => {
      this.model.addDevice(button.dataset.addLight as LightDeviceKind); this.paint();
    }, { signal: this.abort.signal }));
    palette.querySelector("[data-delete-light]")?.addEventListener("click", () => {
      if (this.selectedSandboxDevice) this.model.removeDevice(this.selectedSandboxDevice);
      this.selectedSandboxDevice = null; this.renderPalette(); this.paint();
    }, { signal: this.abort.signal });
    palette.querySelector("[data-light-reset]")?.addEventListener("click", () => {
      this.model.reset(); this.selectedSandboxDevice = null; this.renderPalette(); this.paint();
    }, { signal: this.abort.signal });
  }

  private paint(): void {
    const snapshot = this.model.snapshot();
    this.renderer.draw(snapshot);
    this.hosts.workspace.querySelector<HTMLElement>(".light-experience__value")!.textContent = snapshot.graphValue;
  }
}

export const lightExperience: SubjectExperience = {
  definition: lightDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new LightController(hosts); },
};

export { LightLabModel } from "./models";
