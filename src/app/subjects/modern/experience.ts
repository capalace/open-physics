import type { SubjectController, SubjectExperience, SubjectGraphDefinition, SubjectHosts } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup } from "../subject-ui";
import { modernDefinition, type ModernLabId } from "./catalog";
import { ModernModel, type ModernDeviceKind, type ModernSnapshot } from "./models";
import { drawModernGraph, ModernRenderer } from "./renderer";
import "./style.css";

const palette: readonly { kind: ModernDeviceKind; label: string }[] = [
  { kind: "photon-source", label: "광자원" }, { kind: "metal", label: "금속 표면" },
  { kind: "atom", label: "에너지 준위 원자" }, { kind: "barrier", label: "장벽" },
  { kind: "detector", label: "검출기" }, { kind: "nucleus", label: "핵 표본" },
];

type ListenerScope = "persistent" | "inspector";

export class ModernListenerRegistry {
  private persistent: Array<() => void> = [];
  private inspector: Array<() => void> = [];
  listen(target: EventTarget, event: string, listener: EventListener, scope: ListenerScope = "persistent"): void {
    target.addEventListener(event, listener);
    const dispose = () => target.removeEventListener(event, listener);
    (scope === "inspector" ? this.inspector : this.persistent).push(dispose);
  }
  clearInspector(): void { this.inspector.forEach((dispose) => dispose()); this.inspector = []; }
  disposeAll(): void { this.clearInspector(); this.persistent.forEach((dispose) => dispose()); this.persistent = []; }
}

export const modernGraphLegendMarkup = (graph: SubjectGraphDefinition): string =>
  graph.series.map((series) => `<span><i aria-hidden="true" style="color:${series.color}">●</i> ${series.label}</span>`).join(" ");

class ModernController implements SubjectController {
  private readonly model = new ModernModel(); private readonly canvas = document.createElement("canvas");
  private readonly graphCanvas = document.createElement("canvas"); private readonly measurement = document.createElement("p");
  private readonly renderer: ModernRenderer; private active: ModernLabId | "sandbox" = "relativity";
  private readonly listeners = new ModernListenerRegistry();

  constructor(private readonly hosts: SubjectHosts) {
    hosts.experimentPanel.classList.add("modern-experience__experiments"); hosts.workspace.classList.add("modern-experience__workspace"); hosts.inspectorPanel.classList.add("modern-experience__inspector");
    this.renderExperiments(); this.renderWorkspace(); this.renderInspector();
    this.renderer = new ModernRenderer(this.canvas, this.model, () => this.refresh()); this.refresh();
  }
  resize(): void { this.renderer.resize(); this.refresh(); }
  unmount(): void {
    this.renderer.destroy(); this.listeners.disposeAll();
    this.hosts.experimentPanel.replaceChildren(); this.hosts.workspace.replaceChildren(); this.hosts.inspectorPanel.replaceChildren();
    this.hosts.experimentPanel.classList.remove("modern-experience__experiments"); this.hosts.workspace.classList.remove("modern-experience__workspace"); this.hosts.inspectorPanel.classList.remove("modern-experience__inspector");
  }
  private listen(element: EventTarget, event: string, listener: EventListener, scope: ListenerScope = "persistent"): void { this.listeners.listen(element, event, listener, scope); }
  private button(label: string, action: () => void, scope: ListenerScope = "persistent"): HTMLButtonElement { const result = document.createElement("button"); result.type = "button"; result.textContent = label; this.listen(result, "click", action, scope); return result; }
  private renderExperiments(): void {
    this.hosts.experimentPanel.innerHTML = subjectBrowserMarkup(modernDefinition, {
      rootClass: "modern-experience__browser",
      buttonClass: "modern-experience__lab",
      sandboxClass: "modern-experience__lab--sandbox",
      choiceAttribute: "data-lab-id",
    });
    this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => {
      this.listen(button, "click", () => this.activate(button.dataset.labId as ModernLabId | "sandbox"));
    });
    this.markActive();
  }
  private renderWorkspace(): void {
    const shell = document.createElement("section"); shell.className = "modern-experience"; const toolbar = document.createElement("div"); toolbar.className = "modern-experience__toolbar world-toolbar";
    const play = this.button("재생·멈춤", () => { this.model.toggleRunning(); this.refresh(); }); const step = this.button("한 단계", () => { const running = this.model.snapshot().running; this.model.setRunning(true); this.model.step(1 / 30); this.model.setRunning(running); this.refresh(); }); const reset = this.button("처음으로", () => { this.model.reset(); this.renderInspector(); this.refresh(); });
    const transport = document.createElement("div"); transport.className = "transport-controls"; play.className = "primary-button"; step.className = "icon-button text-button"; reset.className = "icon-button text-button"; transport.append(play, step, reset); toolbar.append(transport);
    const sandboxTools = document.createElement("div"); sandboxTools.className = "modern-experience__palette creation-controls"; sandboxTools.hidden = true;
    palette.forEach(({ kind, label }) => sandboxTools.append(this.button(`＋ ${label}`, () => { this.model.addDevice(kind); this.renderInspector(); this.refresh(); })));
    toolbar.append(sandboxTools);
    this.canvas.className = "modern-experience__canvas"; this.canvas.setAttribute("aria-label", "직접 조작할 수 있는 현대물리 실험 Canvas"); shell.append(toolbar, this.canvas); this.hosts.workspace.replaceChildren(shell);
  }
  private activate(mode: ModernLabId | "sandbox"): void { this.active = mode; this.model.activate(mode); this.markActive(); const toolbar = this.hosts.workspace.querySelector<HTMLElement>(".world-toolbar")!; toolbar.classList.toggle("is-sandbox", mode === "sandbox"); toolbar.querySelector<HTMLElement>(".modern-experience__palette")!.hidden = mode !== "sandbox"; this.renderInspector(); this.refresh(); }
  private markActive(): void { this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => { const active = button.dataset.labId === this.active; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); }); }
  private renderInspector(): void {
    this.listeners.clearInspector();
    const fragment = document.createDocumentFragment(); const snapshot = this.model.snapshot();
    if (this.active === "sandbox") this.sandboxInspector(fragment, snapshot); else this.guidedInspector(fragment);
    this.hosts.inspectorPanel.replaceChildren(fragment);
  }
  private guidedInspector(fragment: DocumentFragment): void {
    const lab = modernDefinition.labs.find((item) => item.id === this.active); if (!lab) return; const article = document.createElement("article");
    article.innerHTML = `${subjectGuideMarkup(lab)}<div class="modern-experience__term"><strong>${lab.controls[0]}</strong></div><section class="modern-experience__graph"><h3>${lab.graph.title}</h3><p>${lab.graph.yLabel} / ${lab.graph.xLabel}</p><p class="modern-experience__legend">${modernGraphLegendMarkup(lab.graph)}</p></section>`;
    this.measurement.className = "modern-experience__measurement"; this.graphCanvas.className = "modern-experience__graph-canvas"; article.querySelector(".modern-experience__graph")?.append(this.measurement, this.graphCanvas); fragment.append(article);
  }
  private sandboxInspector(fragment: DocumentFragment, snapshot: ModernSnapshot): void {
    const article = document.createElement("article"); article.innerHTML = `${subjectSandboxGuideMarkup(modernDefinition, ["위 도구에서 장치를 추가해요.", "Canvas에서 장치를 잡아 옮겨요.", "검출 사건과 측정값을 비교해요."], "장치를 배치하는 동안 검출이 멈추고, 놓으면 새 조건에서 다시 시작하는지 보세요.")}<h3>놓은 장치</h3>`;
    const list = document.createElement("ul"); list.className = "modern-experience__device-list"; snapshot.devices.forEach((item) => { const row = document.createElement("li"); row.textContent = palette.find(({ kind }) => kind === item.kind)?.label ?? item.kind; row.append(this.button("삭제", () => { this.model.removeDevice(item.id); this.renderInspector(); this.refresh(); }, "inspector")); list.append(row); });
    this.measurement.className = "modern-experience__measurement"; article.append(list, this.measurement); fragment.append(article);
  }
  private refresh(): void { const snapshot = this.model.snapshot(); this.measurement.textContent = snapshot.measurement; if (this.active !== "sandbox" && this.graphCanvas.isConnected) drawModernGraph(this.graphCanvas, snapshot); }
}

export const modernExperience: SubjectExperience = { definition: modernDefinition, mount(hosts: SubjectHosts): SubjectController { return new ModernController(hosts); } };
