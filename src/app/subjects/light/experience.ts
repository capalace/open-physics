import { SubjectRouteSession, type SubjectController, type SubjectExperience, type SubjectHosts, type SubjectRoute } from "../subject-experience";
import { subjectBrowserMarkup, subjectCanvasPromptMarkup, subjectGuideMarkup, subjectPrimaryControlMarkup, subjectSandboxGuideMarkup, subjectSelectionMarkup, subjectSettingsHeaderMarkup } from "../subject-ui";
import { interactionHitRadius } from "../canvas-theme";
import { lightDefinition, lightLab, type LightLabId } from "./catalog";
import { LightLabModel, lightUsesCanvasControl, type LightDeviceKind, type LightSceneId, type LightSnapshot } from "./models";
import { LightRenderer } from "./renderer";
import { LightEventScopes } from "./lifecycle";
import "./style.css";

export const lightGraphHeading = (sceneId: LightSceneId): { title: string; axes: string } => {
  if (sceneId === "sandbox") return { title: "장치 순서에 따른 광선 경로", axes: "만난 장치 (번째) · 진행 방향 (°)" };
  const graph = lightLab(sceneId).graph;
  return { title: graph.title, axes: `${graph.xLabel} · ${graph.yLabel}` };
};

export function lightPrimaryOutcome(snapshot: LightSnapshot): { text: string; tone: "neutral" | "success" | "warning" } {
  if (snapshot.sceneId === "total-internal-reflection") {
    return { text: snapshot.screenIntensity === 0 ? snapshot.graphValue : `아직 일부가 경계를 통과해요 · ${snapshot.graphValue}`, tone: snapshot.screenIntensity === 0 ? "success" : "neutral" };
  }
  if (snapshot.sceneId === "laser") {
    return { text: snapshot.graphValue, tone: (snapshot.screenIntensity ?? 0) > 0 ? "success" : "warning" };
  }
  if (snapshot.sceneId === "lenses" && snapshot.image) {
    return { text: `${snapshot.image.virtual ? "허상" : "실상"} · ${snapshot.graphValue}`, tone: snapshot.image.virtual ? "warning" : "success" };
  }
  return { text: snapshot.graphValue, tone: "neutral" };
}

const lightPresets: Record<LightLabId, readonly { label: string; ratio: number }[]> = {
  propagation: [{ label: "아래", ratio: .15 }, { label: "가운데", ratio: .5 }, { label: "위", ratio: .85 }],
  reflection: [{ label: "-45°", ratio: .16 }, { label: "0°", ratio: .5 }, { label: "+45°", ratio: .84 }],
  refraction: [{ label: "작은 각", ratio: .15 }, { label: "중간", ratio: .5 }, { label: "큰 각", ratio: .85 }],
  "total-internal-reflection": [{ label: "굴절", ratio: .15 }, { label: "임계각", ratio: .55 }, { label: "전반사", ratio: .9 }],
  lenses: [{ label: "초점 안", ratio: .9 }, { label: "2f", ratio: .52 }, { label: "멀리", ratio: .12 }],
  prism: [{ label: "왼쪽", ratio: .2 }, { label: "정면", ratio: .5 }, { label: "오른쪽", ratio: .8 }],
  diffraction: [{ label: "좁게", ratio: .08 }, { label: "중간", ratio: .5 }, { label: "넓게", ratio: .9 }],
  polarization: [{ label: "0°", ratio: 0 }, { label: "45°", ratio: .5 }, { label: "90°", ratio: 1 }],
  instruments: [{ label: "강한 확대", ratio: .05 }, { label: "중간", ratio: .45 }, { label: "약한 확대", ratio: .9 }],
  laser: [{ label: "문턱 아래", ratio: .35 }, { label: "문턱", ratio: .55 }, { label: "강한 출력", ratio: .9 }],
};

class LightController implements SubjectController {
  private readonly model = new LightLabModel("sandbox");
  private readonly canvas: HTMLCanvasElement;
  private readonly graphCanvas: HTMLCanvasElement;
  private readonly renderer: LightRenderer;
  private readonly events = new LightEventScopes();
  private selectedSandboxDevice: string | null = null;
  private readonly routeSession: SubjectRouteSession;

  constructor(private readonly hosts: SubjectHosts) {
    hosts.experimentPanel.classList.add("light-experience__experiments");
    hosts.workspace.classList.add("light-experience__workspace");
    hosts.inspectorPanel.classList.add("light-experience__inspector");
    hosts.workspace.innerHTML = `<div class="light-experience__shell subject-lab-screen" data-subject-lab-screen hidden><div class="light-experience__toolbar world-toolbar" aria-label="빛 실험 실행"><div class="transport-controls"><button class="icon-button text-button" type="button" data-light-toolbar-reset>↻ 처음으로</button></div><div class="toolbar-divider"></div><span class="run-indicator" data-running="false" aria-live="polite">멈춤</span></div>${subjectCanvasPromptMarkup()}<div class="light-experience__stage"><canvas aria-label="빛 실험 장면"></canvas><div class="light-experience__value" aria-live="polite"></div></div></div>`;
    this.canvas = hosts.workspace.querySelector("canvas")!;
    hosts.inspectorPanel.innerHTML = `<section class="light-experience__guide"></section><section class="light-experience__graph"><h3></h3><canvas aria-label="실험 그래프"></canvas><div class="light-experience__axes"></div></section>`;
    this.graphCanvas = hosts.inspectorPanel.querySelector(".light-experience__graph canvas")!;
    this.renderer = new LightRenderer(this.canvas, this.graphCanvas);
    this.renderSettings();
    this.renderExperimentList();
    this.bindPointer();
    hosts.workspace.querySelector("[data-light-toolbar-reset]")?.addEventListener("click", () => {
      this.model.reset();
      this.selectedSandboxDevice = null;
      this.renderPalette();
      this.paint();
    }, { signal: this.events.lifetimeSignal });
    this.routeSession = new SubjectRouteSession({ definition: lightDefinition, onRoute: (route) => this.applyRoute(route) });
    hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-back]")!.addEventListener("click", () => this.routeSession.returnToSelection(), { signal: this.events.lifetimeSignal });
    this.routeSession.start();
  }

  resize(): void { this.renderer.resize(); this.paint(); }

  unmount(): void {
    this.events.dispose();
    this.routeSession.dispose();
    this.hosts.experimentPanel.classList.remove("light-experience__experiments");
    this.hosts.workspace.classList.remove("light-experience__workspace");
    this.hosts.inspectorPanel.classList.remove("light-experience__inspector");
    this.hosts.experimentPanel.replaceChildren();
    this.hosts.workspace.replaceChildren();
    this.hosts.inspectorPanel.replaceChildren();
    delete document.body.dataset.subjectScreen;
  }

  private renderExperimentList(): void {
    const browser = subjectBrowserMarkup(lightDefinition, {
      rootClass: "light-experience",
      listClass: "light-experience__list",
      buttonClass: "light-experience__lab",
      choiceAttribute: "data-light-lab",
    });
    this.hosts.workspace.insertAdjacentHTML("afterbegin", subjectSelectionMarkup(lightDefinition, browser));
    this.hosts.workspace.querySelectorAll<HTMLElement>("[data-light-lab]").forEach((button) => {
      button.addEventListener("click", () => this.routeSession.openLab(button.dataset.lightLab as LightSceneId), { signal: this.events.lifetimeSignal });
    });
  }

  private renderSettings(): void {
    this.hosts.experimentPanel.innerHTML = `${subjectSettingsHeaderMarkup()}<div class="light-experience__palette subject-settings-tools" data-subject-settings-tools hidden></div><div data-subject-device-settings></div>`;
  }

  private bindPointer(): void {
    const point = (event: PointerEvent) => this.renderer.worldPoint(event);
    let dragging = false;
    this.canvas.addEventListener("pointerdown", (event) => {
      const world = point(event);
      if (this.model.pointerDown(world, interactionHitRadius(this.canvas, 960, 600))) {
        dragging = true;
        this.canvas.style.cursor = "grabbing";
        this.canvas.setPointerCapture(event.pointerId);
        if (this.model.activeScene === "sandbox") {
          const nearest = [...this.model.snapshot().devices].reverse().find((item) => Math.hypot(item.x - world.x, item.y - world.y) <= 30);
          this.selectedSandboxDevice = nearest?.id ?? null;
          this.renderPalette();
        }
      }
    }, { signal: this.events.lifetimeSignal });
    this.canvas.addEventListener("pointermove", (event) => {
      const world = point(event);
      if (dragging) { if (this.model.pointerMove(world)) this.paint(); return; }
      const snapshot = this.model.snapshot();
      const directTarget = snapshot.handle && lightUsesCanvasControl(snapshot.sceneId)
        && Math.hypot(snapshot.handle.x - world.x, snapshot.handle.y - world.y) <= interactionHitRadius(this.canvas, 960, 600);
      const sandboxTarget = snapshot.sceneId === "sandbox" && snapshot.devices.some((item) => Math.hypot(item.x - world.x, item.y - world.y) <= 34);
      this.canvas.style.cursor = directTarget || sandboxTarget ? "grab" : "default";
    }, { signal: this.events.lifetimeSignal });
    const release = () => { dragging = false; this.canvas.style.cursor = "default"; this.model.pointerUp(); };
    this.canvas.addEventListener("pointerup", release, { signal: this.events.lifetimeSignal });
    this.canvas.addEventListener("pointercancel", release, { signal: this.events.lifetimeSignal });
  }

  private activate(sceneId: LightSceneId): void {
    this.model.load(sceneId);
    this.selectedSandboxDevice = null;
    this.hosts.workspace.querySelector(".world-toolbar")?.classList.toggle("is-sandbox", sceneId === "sandbox");
    this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-title]")!.textContent = sceneId === "sandbox" ? "실험실 도구" : "바꿔 볼 조건";
    this.hosts.workspace.querySelector<HTMLElement>("[data-subject-action-prompt]")!.hidden = !lightUsesCanvasControl(sceneId);
    this.renderGuide();
    this.renderPalette();
    this.paint();
  }

  private applyRoute(route: SubjectRoute): void {
    const selection = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-selection-screen]")!;
    const lab = this.hosts.workspace.querySelector<HTMLElement>("[data-subject-lab-screen]")!;
    if (route.screen === "selection") {
      document.body.dataset.subjectScreen = "selection";
      selection.hidden = false;
      lab.hidden = true;
      return;
    }
    document.body.dataset.subjectScreen = "lab";
    selection.hidden = true;
    lab.hidden = false;
    this.activate(route.labId as LightSceneId);
    this.resize();
  }

  private renderGuide(): void {
    const guide = this.hosts.inspectorPanel.querySelector<HTMLElement>(".light-experience__guide")!;
    const graph = this.hosts.inspectorPanel.querySelector<HTMLElement>(".light-experience__graph")!;
    this.events.nextGuideSignal();
    const graphHeading = lightGraphHeading(this.model.activeScene);
    graph.querySelector("h3")!.textContent = graphHeading.title;
    graph.querySelector(".light-experience__axes")!.textContent = graphHeading.axes;
    if (this.model.activeScene === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        lightDefinition,
        ["위 도구에서 장치를 추가해요.", "Canvas에서 장치를 잡아 옮겨요.", "필요 없는 장치를 선택해 지워요."],
        "광원과 장치를 옮길 때 실제 광선 경로가 함께 이어지는지 확인하세요.",
      );
      return;
    }
    const lab = lightLab(this.model.activeScene as LightLabId);
    guide.innerHTML = subjectGuideMarkup(lab);
  }

  private renderPalette(): void {
    const palette = this.hosts.experimentPanel.querySelector<HTMLElement>(".light-experience__palette")!;
    const controlHost = this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-device-settings]")!;
    const settingsHeading = this.hosts.experimentPanel.querySelector<HTMLElement>(".subject-settings-header > div")!;
    const signal = this.events.nextPaletteSignal();
    palette.hidden = this.model.activeScene !== "sandbox";
    settingsHeading.hidden = lightUsesCanvasControl(this.model.activeScene);
    controlHost.replaceChildren();
    if (palette.hidden && !lightUsesCanvasControl(this.model.activeScene)) {
      const lab = lightLab(this.model.activeScene as LightLabId);
      const ratio = this.model.primaryControlRatio() ?? 0;
      const controlName = lab.controls[0].split(" · ")[0];
      const snapshot = this.model.snapshot();
      const outcome = lightPrimaryOutcome(snapshot);
      controlHost.innerHTML = subjectPrimaryControlMarkup({ label: controlName, ariaLabel: lab.controls[0], ratio, value: this.model.primaryControlValue(snapshot), low: "작게", high: "크게", attribute: "data-light-primary-range", presets: lightPresets[this.model.activeScene as LightLabId], result: outcome.text, resultTone: outcome.tone });
      controlHost.querySelector<HTMLInputElement>("[data-light-primary-range]")!.addEventListener("input", (event) => {
        this.model.setPrimaryControlRatio(Number((event.target as HTMLInputElement).value) / 100); this.paint();
      }, { signal });
      controlHost.querySelectorAll<HTMLButtonElement>("[data-subject-control-preset]").forEach((button) => button.addEventListener("click", () => { this.model.setPrimaryControlRatio(Number(button.dataset.subjectControlPreset) / 100); this.paint(); }, { signal }));
      return;
    }
    const kinds: readonly LightDeviceKind[] = ["source", "mirror", "boundary", "lens", "prism", "slit", "screen"];
    const labels: Record<LightDeviceKind, string> = { source: "광원", mirror: "거울", boundary: "경계면", lens: "렌즈", prism: "프리즘", slit: "슬릿", screen: "스크린" };
    palette.innerHTML = `<span class="palette-label">추가</span>${kinds.map((kind) => `<button type="button" data-add-light="${kind}">＋ ${labels[kind]}</button>`).join("")}<button class="danger-button" type="button" data-delete-light ${this.selectedSandboxDevice ? "" : "disabled"}>삭제</button>`;
    palette.querySelectorAll<HTMLElement>("[data-add-light]").forEach((button) => button.addEventListener("click", () => {
      this.model.addDevice(button.dataset.addLight as LightDeviceKind); this.paint();
    }, { signal }));
    palette.querySelector("[data-delete-light]")?.addEventListener("click", () => {
      if (this.selectedSandboxDevice) this.model.removeDevice(this.selectedSandboxDevice);
      this.selectedSandboxDevice = null; this.renderPalette(); this.paint();
    }, { signal });
  }

  private paint(): void {
    const snapshot = this.model.snapshot();
    this.renderer.draw(snapshot);
    const range = this.hosts.experimentPanel.querySelector<HTMLInputElement>("[data-light-primary-range]");
    const ratio = this.model.primaryControlRatio();
    if (range && ratio !== null) {
      range.value = String(Math.round(ratio * 100));
      const value = this.model.primaryControlValue(snapshot);
      range.setAttribute("aria-valuetext", value);
      const output = range.parentElement?.querySelector("[data-subject-control-value]");
      if (output) output.textContent = value;
      const outcome = lightPrimaryOutcome(snapshot);
      const result = range.parentElement?.querySelector<HTMLElement>(".subject-control-result");
      if (result) { result.dataset.tone = outcome.tone; const text = result.querySelector("[data-subject-control-result]"); if (text) text.textContent = outcome.text; }
    }
    this.hosts.workspace.querySelector<HTMLElement>(".light-experience__value")!.textContent = snapshot.graphValue;
    const run = this.hosts.workspace.querySelector<HTMLElement>(".run-indicator");
    if (run) { run.textContent = "멈춤"; run.dataset.running = "false"; }
  }
}

export const lightExperience: SubjectExperience = {
  definition: lightDefinition,
  mount(hosts: SubjectHosts): SubjectController { return new LightController(hosts); },
};

export { LightLabModel } from "./models";
