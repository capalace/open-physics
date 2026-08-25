import type { SubjectController, SubjectExperience, SubjectGraphDefinition, SubjectHosts } from "../subject-experience";
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
    const fragment = document.createDocumentFragment(); const heading = document.createElement("h2"); heading.textContent = "현대물리 실험 선택"; fragment.append(heading);
    modernDefinition.labs.forEach((lab) => { const button = document.createElement("button"); button.type = "button"; button.dataset.labId = lab.id; button.className = "modern-experience__lab"; button.innerHTML = `<span aria-hidden="true">${lab.icon}</span><strong>${lab.title}</strong><small>${lab.category}</small>`; this.listen(button, "click", () => this.activate(lab.id as ModernLabId)); fragment.append(button); });
    const sandbox = document.createElement("button"); sandbox.type = "button"; sandbox.dataset.labId = "sandbox"; sandbox.className = "modern-experience__lab modern-experience__lab--sandbox"; sandbox.innerHTML = `<span aria-hidden="true">＋</span><strong>${modernDefinition.sandboxTitle}</strong><small>자유 구성</small>`; this.listen(sandbox, "click", () => this.activate("sandbox")); fragment.append(sandbox);
    this.hosts.experimentPanel.replaceChildren(fragment); this.markActive();
  }
  private renderWorkspace(): void {
    const shell = document.createElement("section"); shell.className = "modern-experience"; const toolbar = document.createElement("div"); toolbar.className = "modern-experience__toolbar";
    toolbar.append(this.button("재생·멈춤", () => { this.model.toggleRunning(); this.refresh(); }), this.button("한 단계", () => { const running = this.model.snapshot().running; this.model.setRunning(true); this.model.step(1 / 30); this.model.setRunning(running); this.refresh(); }), this.button("처음으로", () => { this.model.reset(); this.renderInspector(); this.refresh(); }));
    this.canvas.className = "modern-experience__canvas"; this.canvas.setAttribute("aria-label", "직접 조작할 수 있는 현대물리 실험 Canvas"); shell.append(toolbar, this.canvas); this.hosts.workspace.replaceChildren(shell);
  }
  private activate(mode: ModernLabId | "sandbox"): void { this.active = mode; this.model.activate(mode); this.markActive(); this.renderInspector(); this.refresh(); }
  private markActive(): void { this.hosts.experimentPanel.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => { const active = button.dataset.labId === this.active; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); }); }
  private renderInspector(): void {
    this.listeners.clearInspector();
    const fragment = document.createDocumentFragment(); const snapshot = this.model.snapshot();
    if (this.active === "sandbox") this.sandboxInspector(fragment, snapshot); else this.guidedInspector(fragment);
    this.hosts.inspectorPanel.replaceChildren(fragment);
  }
  private guidedInspector(fragment: DocumentFragment): void {
    const lab = modernDefinition.labs.find((item) => item.id === this.active); if (!lab) return; const article = document.createElement("article");
    article.innerHTML = `<p class="modern-experience__category">${lab.category}</p><h2>${lab.title}</h2><p class="modern-experience__question">${lab.question}</p><ol>${lab.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="modern-experience__observe"><strong>관찰:</strong> ${lab.observe}</p><div class="modern-experience__term"><strong>${lab.controls[0]}</strong></div><section class="modern-experience__law"><h3>${lab.law.title}</h3><p>${lab.law.description}</p><code>${lab.law.equation}</code></section><section class="modern-experience__graph"><h3>${lab.graph.title}</h3><p>${lab.graph.yLabel} / ${lab.graph.xLabel}</p><p class="modern-experience__legend">${modernGraphLegendMarkup(lab.graph)}</p></section>`;
    this.measurement.className = "modern-experience__measurement"; this.graphCanvas.className = "modern-experience__graph-canvas"; article.querySelector(".modern-experience__graph")?.append(this.measurement, this.graphCanvas); fragment.append(article);
  }
  private sandboxInspector(fragment: DocumentFragment, snapshot: ModernSnapshot): void {
    const article = document.createElement("article"); article.innerHTML = `<p class="modern-experience__category">자유 구성</p><h2>${modernDefinition.sandboxTitle}</h2><p>${modernDefinition.sandboxDescription}</p><p class="modern-experience__observe">장치를 추가하고 Canvas에서 끌어 배치하세요. 배치 중에는 검출 사건이 멈춰 있어요.</p><h3>장치 팔레트</h3>`;
    const controls = document.createElement("div"); controls.className = "modern-experience__palette"; palette.forEach(({ kind, label }) => controls.append(this.button(`＋ ${label}`, () => { this.model.addDevice(kind); this.renderInspector(); this.refresh(); }, "inspector")));
    const list = document.createElement("ul"); list.className = "modern-experience__device-list"; snapshot.devices.forEach((item) => { const row = document.createElement("li"); row.textContent = palette.find(({ kind }) => kind === item.kind)?.label ?? item.kind; row.append(this.button("삭제", () => { this.model.removeDevice(item.id); this.renderInspector(); this.refresh(); }, "inspector")); list.append(row); });
    this.measurement.className = "modern-experience__measurement"; article.append(controls, list, this.measurement); fragment.append(article);
  }
  private refresh(): void { const snapshot = this.model.snapshot(); this.measurement.textContent = snapshot.measurement; if (this.active !== "sandbox" && this.graphCanvas.isConnected) drawModernGraph(this.graphCanvas, snapshot); }
}

export const modernExperience: SubjectExperience = { definition: modernDefinition, mount(hosts: SubjectHosts): SubjectController { return new ModernController(hosts); } };
