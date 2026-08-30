import { SubjectRouteSession, type SubjectController, type SubjectExperience, type SubjectGraphDefinition, type SubjectHosts, type SubjectRoute } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup, subjectSelectionMarkup, subjectSettingsHeaderMarkup } from "../subject-ui";
import { modernDefinition, type ModernLabId } from "./catalog";
import { ModernModel, modernPrimaryControlRatio, type ModernDeviceKind, type ModernSnapshot } from "./models";
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
  private readonly model = new ModernModel("sandbox"); private readonly canvas = document.createElement("canvas");
  private readonly graphCanvas = document.createElement("canvas"); private readonly measurement = document.createElement("p");
  private readonly renderer: ModernRenderer; private active: ModernLabId | "sandbox" = "sandbox";
  private readonly listeners = new ModernListenerRegistry();
  private readonly routeSession: SubjectRouteSession;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.experimentPanel.classList.add("modern-experience__experiments"); hosts.workspace.classList.add("modern-experience__workspace"); hosts.inspectorPanel.classList.add("modern-experience__inspector");
    this.renderSettings(); this.renderWorkspace(); this.renderExperiments();
    this.renderer = new ModernRenderer(this.canvas, this.model, () => this.refresh());
    this.routeSession = new SubjectRouteSession({ definition: modernDefinition, onRoute: (route) => this.applyRoute(route) });
    this.listen(this.hosts.experimentPanel.querySelector("[data-subject-back]")!, "click", () => this.routeSession.returnToSelection());
    this.routeSession.start();
  }
  resize(): void { this.renderer.resize(); this.refresh(); }
  unmount(): void {
    this.renderer.destroy(); this.routeSession.dispose(); this.listeners.disposeAll();
    this.hosts.experimentPanel.replaceChildren(); this.hosts.workspace.replaceChildren(); this.hosts.inspectorPanel.replaceChildren();
    this.hosts.experimentPanel.classList.remove("modern-experience__experiments"); this.hosts.workspace.classList.remove("modern-experience__workspace"); this.hosts.inspectorPanel.classList.remove("modern-experience__inspector");
    delete document.body.dataset.subjectScreen;
  }
  private listen(element: EventTarget, event: string, listener: EventListener, scope: ListenerScope = "persistent"): void { this.listeners.listen(element, event, listener, scope); }
  private button(label: string, action: () => void, scope: ListenerScope = "persistent"): HTMLButtonElement { const result = document.createElement("button"); result.type = "button"; result.textContent = label; this.listen(result, "click", action, scope); return result; }
  private renderExperiments(): void {
    const browser = subjectBrowserMarkup(modernDefinition, {
      rootClass: "modern-experience__browser",
      buttonClass: "modern-experience__lab",
      sandboxClass: "modern-experience__lab--sandbox",
      choiceAttribute: "data-lab-id",
    });
    this.hosts.workspace.insertAdjacentHTML("afterbegin", subjectSelectionMarkup(modernDefinition, browser));
    this.hosts.workspace.querySelectorAll<HTMLButtonElement>("[data-lab-id]").forEach((button) => {
      this.listen(button, "click", () => this.routeSession.openLab(button.dataset.labId as ModernLabId | "sandbox"));
    });
  }
  private renderSettings(): void {
    this.hosts.experimentPanel.innerHTML = `${subjectSettingsHeaderMarkup()}<div class="modern-experience__palette subject-settings-tools" data-subject-settings-tools hidden><span class="palette-label">장치 추가</span></div><div data-subject-device-settings></div>`;
    const tools = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-tools]")!;
    palette.forEach(({ kind, label }) => tools.append(this.button(`＋ ${label}`, () => { this.model.addDevice(kind); this.renderInspector(); this.refresh(); })));
  }
  private renderWorkspace(): void {
    const shell = document.createElement("section"); shell.className = "modern-experience"; const toolbar = document.createElement("div"); toolbar.className = "modern-experience__toolbar world-toolbar";
    const play = this.button("▶ 실행", () => { this.model.toggleRunning(); this.refresh(); }); const step = this.button("한 단계", () => { const running = this.model.snapshot().running; this.model.setRunning(true); this.model.step(1 / 30); this.model.setRunning(running); this.refresh(); }); const reset = this.button("↻ 처음으로", () => { this.model.reset(); this.renderInspector(); this.refresh(); });
    const transport = document.createElement("div"); transport.className = "transport-controls"; play.className = "primary-button"; step.className = "icon-button text-button"; reset.className = "icon-button text-button"; transport.append(play, step, reset);
    const divider = document.createElement("div"); divider.className = "toolbar-divider";
    const run = document.createElement("span"); run.className = "run-indicator"; run.dataset.running = "false"; run.textContent = "멈춤";
    toolbar.append(transport, divider, run);
    shell.classList.add("subject-lab-screen"); shell.dataset.subjectLabScreen = ""; shell.hidden = true;
    this.canvas.className = "modern-experience__canvas"; this.canvas.setAttribute("aria-label", "직접 조작할 수 있는 현대물리 실험 Canvas"); shell.append(toolbar, this.canvas); this.hosts.workspace.replaceChildren(shell);
  }
  private applyRoute(route: SubjectRoute): void {
    const selection = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-selection-screen]")!; const lab = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-lab-screen]")!;
    if (route.screen === "selection") { this.model.setRunning(false); document.body.dataset.subjectScreen = "selection"; selection.hidden = false; lab.hidden = true; return; }
    document.body.dataset.subjectScreen = "lab"; selection.hidden = true; lab.hidden = false; this.activate(route.labId as ModernLabId | "sandbox"); this.resize();
  }
  private activate(mode: ModernLabId | "sandbox"): void { this.active = mode; this.model.activate(mode); const toolbar = this.hosts.workspace.querySelector<HTMLElement>(".world-toolbar")!; toolbar.classList.toggle("is-sandbox", mode === "sandbox"); this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-tools]")!.hidden = mode !== "sandbox"; this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-title]")!.textContent = mode === "sandbox" ? "실험실 도구" : "바꿔 볼 조건"; this.renderInspector(); this.refresh(); }
  private renderInspector(): void {
    this.listeners.clearInspector();
    const fragment = document.createDocumentFragment(); const snapshot = this.model.snapshot();
    if (this.active === "sandbox") this.sandboxInspector(fragment, snapshot); else this.guidedInspector(fragment);
    this.hosts.inspectorPanel.replaceChildren(fragment);
    this.renderDeviceSettings(snapshot);
  }
  private guidedInspector(fragment: DocumentFragment): void {
    const lab = modernDefinition.labs.find((item) => item.id === this.active); if (!lab) return; const article = document.createElement("article");
    article.innerHTML = `${subjectGuideMarkup(lab)}<div class="modern-experience__term"><strong>${lab.controls[0]}</strong></div><section class="modern-experience__graph"><h3>${lab.graph.title}</h3><p>${lab.graph.yLabel} / ${lab.graph.xLabel}</p><p class="modern-experience__legend">${modernGraphLegendMarkup(lab.graph)}</p></section>`;
    this.measurement.className = "modern-experience__measurement"; this.graphCanvas.className = "modern-experience__graph-canvas"; article.querySelector(".modern-experience__graph")?.append(this.measurement, this.graphCanvas); fragment.append(article);
  }
  private sandboxInspector(fragment: DocumentFragment, snapshot: ModernSnapshot): void {
    const article = document.createElement("article"); article.innerHTML = subjectSandboxGuideMarkup(modernDefinition, ["왼쪽 도구에서 장치를 추가해요.", "Canvas에서 장치를 잡아 옮겨요.", "검출 사건과 측정값을 비교해요."], "장치를 배치하는 동안 검출이 멈추고, 놓으면 새 조건에서 다시 시작하는지 보세요.");
    this.measurement.className = "modern-experience__measurement"; article.append(this.measurement); fragment.append(article);
  }
  private renderDeviceSettings(snapshot: ModernSnapshot): void {
    const host = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-device-settings]")!; host.replaceChildren();
    if (this.active !== "sandbox") {
      const lab = modernDefinition.labs.find((item) => item.id === this.active)!;
      const ratio = modernPrimaryControlRatio(snapshot) ?? 0;
      const controlName = lab.controls[0].split(" · ")[0];
      host.innerHTML = `<label class="subject-direct-control"><span>${controlName}</span><input type="range" min="0" max="100" step="1" value="${Math.round(ratio * 100)}" data-modern-primary-range aria-label="${lab.controls[0]}"><div><small>낮게</small><output>${Math.round(ratio * 100)}%</output><small>높게</small></div></label><p class="subject-settings-hint">슬라이더나 캔버스의 손잡이로 같은 조건을 바꿀 수 있어요.</p>`;
      const range = host.querySelector<HTMLInputElement>("[data-modern-primary-range]")!;
      this.listen(range, "input", () => { this.model.setPrimaryControlRatio(Number(range.value) / 100); this.refresh(); }, "inspector");
      return;
    }
    const list = document.createElement("ul"); list.className = "modern-experience__device-list"; snapshot.devices.forEach((item) => { const row = document.createElement("li"); row.textContent = palette.find(({ kind }) => kind === item.kind)?.label ?? item.kind; row.append(this.button("삭제", () => { this.model.removeDevice(item.id); this.renderInspector(); this.refresh(); }, "inspector")); list.append(row); }); host.append(list);
  }
  private refresh(): void { const snapshot = this.model.snapshot(); this.measurement.textContent = snapshot.measurement; const range = this.hosts.experimentPanel.querySelector<HTMLInputElement>("[data-modern-primary-range]"); const ratio = modernPrimaryControlRatio(snapshot); if (range && ratio !== null) { range.value = String(Math.round(ratio * 100)); const output = range.parentElement?.querySelector("output"); if (output) output.textContent = `${Math.round(ratio * 100)}%`; } const play = this.hosts.workspace.querySelector<HTMLButtonElement>(".transport-controls .primary-button"); if (play) { play.textContent = snapshot.running ? "Ⅱ 일시정지" : "▶ 실행"; play.dataset.running = String(snapshot.running); } const run = this.hosts.workspace.querySelector<HTMLElement>(".run-indicator"); if (run) { run.textContent = snapshot.running ? "실행 중" : "멈춤"; run.dataset.running = String(snapshot.running); } if (this.active !== "sandbox" && this.graphCanvas.isConnected) drawModernGraph(this.graphCanvas, snapshot); }
}

export const modernExperience: SubjectExperience = { definition: modernDefinition, mount(hosts: SubjectHosts): SubjectController { return new ModernController(hosts); } };
