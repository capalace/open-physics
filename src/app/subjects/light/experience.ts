import { SubjectRouteSession, type SubjectController, type SubjectExperience, type SubjectHosts, type SubjectRoute } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup, subjectSelectionMarkup, subjectSettingsHeaderMarkup } from "../subject-ui";
import { lightDefinition, lightLab, type LightLabId } from "./catalog";
import { LightLabModel, type LightDeviceKind, type LightSceneId } from "./models";
import { LightRenderer } from "./renderer";
import { LightEventScopes } from "./lifecycle";
import "./style.css";

export const lightGraphHeading = (sceneId: LightSceneId): { title: string; axes: string } => {
  if (sceneId === "sandbox") return { title: "장치 순서에 따른 광선 경로", axes: "만난 장치 (번째) · 진행 방향 (°)" };
  const graph = lightLab(sceneId).graph;
  return { title: graph.title, axes: `${graph.xLabel} · ${graph.yLabel}` };
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
    hosts.workspace.innerHTML = `<div class="light-experience__shell subject-lab-screen" data-subject-lab-screen hidden><div class="light-experience__toolbar world-toolbar" aria-label="빛 실험 실행"><div class="transport-controls"><button class="icon-button text-button" type="button" data-light-toolbar-reset>↻ 처음으로</button></div><div class="toolbar-divider"></div><span class="run-indicator" data-running="false">멈춤</span></div><div class="light-experience__stage"><canvas aria-label="빛 실험 장면"></canvas><div class="light-experience__value" aria-live="polite"></div></div></div>`;
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
    this.hosts.experimentPanel.innerHTML = `${subjectSettingsHeaderMarkup()}<div class="light-experience__palette subject-settings-tools" data-subject-settings-tools hidden></div>`;
  }

  private bindPointer(): void {
    const point = (event: PointerEvent) => this.renderer.worldPoint(event);
    this.canvas.addEventListener("pointerdown", (event) => {
      const world = point(event);
      if (this.model.pointerDown(world)) {
        this.canvas.setPointerCapture(event.pointerId);
        if (this.model.activeScene === "sandbox") {
          const nearest = [...this.model.snapshot().devices].reverse().find((item) => Math.hypot(item.x - world.x, item.y - world.y) <= 30);
          this.selectedSandboxDevice = nearest?.id ?? null;
          this.renderPalette();
        }
      }
    }, { signal: this.events.lifetimeSignal });
    this.canvas.addEventListener("pointermove", (event) => { if (this.model.pointerMove(point(event))) this.paint(); }, { signal: this.events.lifetimeSignal });
    const release = () => this.model.pointerUp();
    this.canvas.addEventListener("pointerup", release, { signal: this.events.lifetimeSignal });
    this.canvas.addEventListener("pointercancel", release, { signal: this.events.lifetimeSignal });
  }

  private activate(sceneId: LightSceneId): void {
    this.model.load(sceneId);
    this.selectedSandboxDevice = null;
    this.hosts.workspace.querySelector(".world-toolbar")?.classList.toggle("is-sandbox", sceneId === "sandbox");
    this.hosts.experimentPanel.querySelector<HTMLElement>("[data-subject-settings-title]")!.textContent = sceneId === "sandbox" ? "실험실 도구" : "바꿔 볼 조건";
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
    const signal = this.events.nextPaletteSignal();
    palette.hidden = this.model.activeScene !== "sandbox";
    if (palette.hidden) return;
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
