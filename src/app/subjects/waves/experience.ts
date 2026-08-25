import type { SubjectController, SubjectExperience, SubjectHosts } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup } from "../subject-ui";
import { WAVES_LAB_IDS, wavesDefinition, type WavesLabId } from "./catalog";
import { WavesModel, type WaveDeviceKind, type WavesSnapshot } from "./models";
import { drawGraph, WavesRenderer } from "./renderer";
import "./style.css";

const palette: readonly { kind: WaveDeviceKind; label: string }[] = [
  { kind: "source", label: "파원" },
  { kind: "second-source", label: "두 번째 파원" },
  { kind: "medium", label: "줄·매질" },
  { kind: "boundary", label: "경계" },
  { kind: "observer", label: "관찰자" },
  { kind: "detector", label: "검출기" },
];

type ListenerScope = "persistent" | "inspector";

/** Keeps replaced inspector controls from retaining detached DOM and callbacks. */
export class WavesListenerRegistry {
  private persistent: Array<() => void> = [];
  private inspector: Array<() => void> = [];

  listen(target: EventTarget, event: string, listener: EventListener, scope: ListenerScope = "persistent"): void {
    target.addEventListener(event, listener);
    const dispose = () => target.removeEventListener(event, listener);
    (scope === "inspector" ? this.inspector : this.persistent).push(dispose);
  }

  clearInspector(): void {
    this.inspector.forEach((dispose) => dispose());
    this.inspector = [];
  }

  disposeAll(): void {
    this.clearInspector();
    this.persistent.forEach((dispose) => dispose());
    this.persistent = [];
  }
}

class WavesController implements SubjectController {
  private readonly model = new WavesModel("sandbox");
  private readonly canvas = document.createElement("canvas");
  private readonly graphCanvas = document.createElement("canvas");
  private readonly measurement = document.createElement("p");
  private readonly renderer: WavesRenderer;
  private active: WavesLabId | "sandbox" = "sandbox";
  private readonly listeners = new WavesListenerRegistry();

  constructor(private readonly hosts: SubjectHosts) {
    hosts.experimentPanel.classList.add("waves-experience__experiments");
    hosts.workspace.classList.add("waves-experience__workspace");
    hosts.inspectorPanel.classList.add("waves-experience__inspector");
    this.renderExperimentList();
    this.renderWorkspace();
    this.renderInspector();
    this.renderer = new WavesRenderer(this.canvas, this.model, () => this.refreshReadout());
    this.activate("sandbox");
  }

  resize(): void { this.renderer.resize(); this.refreshReadout(); }

  unmount(): void {
    this.renderer.destroy();
    this.listeners.disposeAll();
    this.hosts.experimentPanel.replaceChildren();
    this.hosts.workspace.replaceChildren();
    this.hosts.inspectorPanel.replaceChildren();
    this.hosts.experimentPanel.classList.remove("waves-experience__experiments");
    this.hosts.workspace.classList.remove("waves-experience__workspace");
    this.hosts.inspectorPanel.classList.remove("waves-experience__inspector");
  }

  private listen(element: EventTarget, event: string, listener: EventListener, scope: ListenerScope = "persistent"): void {
    this.listeners.listen(element, event, listener, scope);
  }

  private renderExperimentList(): void {
    this.hosts.experimentPanel.innerHTML = subjectBrowserMarkup(wavesDefinition, {
      rootClass: "waves-experience__browser",
      buttonClass: "waves-experience__lab",
      sandboxClass: "waves-experience__lab--sandbox",
      choiceAttribute: "data-lab-id",
    });
    this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => {
      this.listen(button, "click", () => this.activate(button.dataset.labId as WavesLabId | "sandbox"));
    });
    this.markActive();
  }

  private renderWorkspace(): void {
    const shell = document.createElement("section"); shell.className = "waves-experience";
    const toolbar = document.createElement("div"); toolbar.className = "waves-experience__toolbar world-toolbar";
    const play = this.actionButton("재생·멈춤", () => { this.model.toggleRunning(); this.refreshReadout(); });
    const step = this.actionButton("한 단계", () => { const wasRunning = this.model.snapshot().running; this.model.setRunning(true); this.model.step(1 / 30); this.model.setRunning(wasRunning); this.refreshReadout(); });
    const reset = this.actionButton("처음으로", () => { this.model.reset(); this.renderInspector(); this.refreshReadout(); });
    const transport = document.createElement("div"); transport.className = "transport-controls";
    play.className = "primary-button";
    step.className = "icon-button text-button";
    reset.className = "icon-button text-button";
    transport.append(play, step, reset); toolbar.append(transport);
    const sandboxTools = document.createElement("div");
    sandboxTools.className = "waves-experience__palette creation-controls";
    sandboxTools.hidden = true;
    palette.forEach(({ kind, label }) => {
      sandboxTools.append(this.actionButton(`＋ ${label}`, () => {
        this.model.addDevice(kind); this.renderInspector(); this.refreshReadout();
      }));
    });
    toolbar.append(sandboxTools);
    this.canvas.className = "waves-experience__canvas";
    this.canvas.setAttribute("aria-label", "직접 조작할 수 있는 파동 실험 Canvas");
    shell.append(toolbar, this.canvas);
    this.hosts.workspace.replaceChildren(shell);
  }

  private actionButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    this.listen(button, "click", action); return button;
  }

  private activate(mode: WavesLabId | "sandbox"): void {
    this.active = mode;
    this.model.activate(mode);
    this.markActive();
    const toolbar = this.hosts.workspace.querySelector<HTMLElement>(".world-toolbar")!;
    toolbar.classList.toggle("is-sandbox", mode === "sandbox");
    toolbar.querySelector<HTMLElement>(".waves-experience__palette")!.hidden = mode !== "sandbox";
    this.renderInspector();
    this.refreshReadout();
  }

  private markActive(): void {
    this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => {
      const selected = button.dataset.labId === this.active;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  private renderInspector(): void {
    this.listeners.clearInspector();
    const fragment = document.createDocumentFragment();
    const snapshot = this.model.snapshot();
    if (this.active === "sandbox") this.renderSandboxInspector(fragment, snapshot);
    else this.renderGuidedInspector(fragment);
    this.hosts.inspectorPanel.replaceChildren(fragment);
  }

  private renderGuidedInspector(fragment: DocumentFragment): void {
    const lab = wavesDefinition.labs.find((item) => item.id === this.active);
    if (!lab) return;
    const article = document.createElement("article");
    article.innerHTML = `${subjectGuideMarkup(lab)}
      <div class="waves-experience__term"><strong>${lab.controls[0]}</strong></div>
      <section class="waves-experience__graph"><h3>${lab.graph.title}</h3><p>${lab.graph.yLabel} / ${lab.graph.xLabel}</p></section>`;
    this.measurement.className = "waves-experience__measurement";
    this.graphCanvas.className = "waves-experience__graph-canvas";
    article.querySelector(".waves-experience__graph")?.append(this.measurement, this.graphCanvas);
    fragment.append(article);
  }

  private renderSandboxInspector(fragment: DocumentFragment, snapshot: WavesSnapshot): void {
    const article = document.createElement("article");
    article.innerHTML = `${subjectSandboxGuideMarkup(
      wavesDefinition,
      ["위 도구에서 장치를 추가해요.", "Canvas에서 장치를 잡아 옮겨요.", "파형과 측정값의 변화를 비교해요."],
      "장치를 옮길 때 파동이 멈추고, 놓으면 새 배치에서 다시 이어지는지 보세요.",
    )}<h3>놓은 장치</h3>`;
    const list = document.createElement("ul"); list.className = "waves-experience__device-list";
    snapshot.devices.forEach((item) => {
      const row = document.createElement("li"); row.textContent = palette.find(({ kind }) => kind === item.kind)?.label ?? item.kind;
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "삭제";
      this.listen(remove, "click", () => { this.model.removeDevice(item.id); this.renderInspector(); this.refreshReadout(); }, "inspector");
      row.append(remove); list.append(row);
    });
    this.measurement.className = "waves-experience__measurement";
    article.append(list, this.measurement); fragment.append(article);
  }

  private refreshReadout(): void {
    const snapshot = this.model.snapshot();
    this.measurement.textContent = snapshot.measurement;
    if (this.active !== "sandbox" && this.graphCanvas.isConnected) drawGraph(this.graphCanvas, snapshot);
  }
}

export const wavesExperience: SubjectExperience = {
  definition: wavesDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new WavesController(hosts); },
};

export { WAVES_LAB_IDS };
