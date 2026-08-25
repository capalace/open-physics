import {
  PhysicsPlayground,
  type PlaygroundMaterial,
  type PlaygroundPreset,
  type PlaygroundSnapshot,
  type SandboxApparatusKind,
  type SandboxConnectionKind,
  type SandboxEnvironmentKind,
  type SandboxObjectKind,
} from "./physics-playground";
import { formatGraphValue, renderLabGraph } from "./lab-graph";
import {
  mechanicsLab,
  shouldAutoPlayLab,
  type LabActivationSource,
  type LabControl,
  type MechanicsLab,
} from "./mechanics-labs";

type AppMode = "lab" | "sandbox";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element;
}

const canvas = required<HTMLCanvasElement>("#physics-canvas");
const playButton = required<HTMLButtonElement>("#play");
const stepButton = required<HTMLButtonElement>("#step");
const deleteButton = required<HTMLButtonElement>("#delete-object");
const focusButton = required<HTMLButtonElement>("#focus-mode");
const appLayout = required<HTMLElement>(".app-layout");
const inspectorEmpty = required<HTMLElement>("#inspector-empty");
const inspectorForm = required<HTMLFormElement>("#inspector-form");
const blockResizeHelp = required<HTMLElement>("#block-resize-help");
const materialSettings = required<HTMLElement>("#material-settings");
const materialTitle = required<HTMLElement>("#material-title");
const sandboxObservation = required<HTMLElement>("#sandbox-observation");
const objectLabel = required<HTMLInputElement>("#object-label");
const objectMass = required<HTMLInputElement>("#object-mass");
const objectColor = required<HTMLInputElement>("#object-color");
const lawTitle = required<HTMLElement>("#law-title");
const lawDescription = required<HTMLElement>("#law-description");
const lawEquation = required<HTMLElement>("#law-equation");
const labBrowser = required<HTMLElement>("#lab-browser");
const sandboxBrowser = required<HTMLElement>("#sandbox-browser");
const labGuide = required<HTMLElement>("#lab-guide");
const labGraph = required<HTMLElement>("#lab-graph");
const labGraphCanvas = required<HTMLCanvasElement>("#lab-graph-canvas");
const labGraphLegend = required<HTMLElement>("#lab-graph-legend");
const objectEditor = required<HTMLElement>("#object-editor");
const inspectorHeading = required<HTMLElement>("#object-editor .inspector-header h2");
const inspectorEyebrow = required<HTMLElement>("#object-editor .eyebrow");
const EARTH_GRAVITY = 9.81;
let appMode: AppMode = "lab";
let activeLab = mechanicsLab("free-fall");

const playground = new PhysicsPlayground(canvas, { onUpdate: renderSnapshot });
activateLab("free-fall", "initial");

playButton.addEventListener("click", () => playground.toggle());
stepButton.addEventListener("click", () => playground.stepOnce());
required<HTMLButtonElement>("#reset").addEventListener("click", () => {
  if (appMode === "lab") playground.loadPreset(activeLab.id, true);
  else playground.startSandbox();
});
document.querySelectorAll<HTMLButtonElement>("[data-object-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appMode === "sandbox") playground.addSandboxObject(button.dataset.objectKind as SandboxObjectKind);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-apparatus-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appMode === "sandbox") {
      playground.addSandboxApparatus(button.dataset.apparatusKind as SandboxApparatusKind);
      pulseWorld();
    }
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-connection-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appMode === "sandbox") {
      playground.startConnection(button.dataset.connectionKind as SandboxConnectionKind);
      pulseWorld();
    }
  });
});
document.querySelector<HTMLButtonElement>("[data-force-tool]")?.addEventListener("click", () => {
  if (appMode === "sandbox") {
    playground.toggleForceForSelected();
    pulseWorld();
  }
});
document.querySelectorAll<HTMLButtonElement>("[data-environment-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appMode === "sandbox") {
      playground.toggleSandboxEnvironment(button.dataset.environmentKind as SandboxEnvironmentKind);
      pulseWorld();
    }
  });
});
deleteButton.addEventListener("click", () => {
  if (appMode === "sandbox") playground.removeSelected();
});
focusButton.addEventListener("click", () => setFocusMode(!appLayout.classList.contains("is-focus-mode")));

document.querySelectorAll<HTMLButtonElement>("[data-app-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.appMode as AppMode;
    if (mode === appMode) return;
    if (mode === "lab") activateLab(activeLab.id);
    else activateSandbox();
  });
});
required<HTMLButtonElement>("#new-sandbox").addEventListener("click", () => {
  playground.startSandbox();
  pulseWorld();
});

bindToggle("#show-grid", "grid");
bindToggle("#show-trails", "trails");
bindToggle("#show-vectors", "vectors");

document.querySelectorAll<HTMLButtonElement>("[data-lab]").forEach((button) => {
  button.addEventListener("click", () => {
    activateLab(button.dataset.lab as PlaygroundPreset);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.setGravity(Number(button.dataset.gravity));
    pulseWorld();
  });
});

objectLabel.addEventListener("change", () => playground.updateSelected({ label: objectLabel.value }));
objectMass.addEventListener("input", () => playground.updateSelected({ mass: Number(objectMass.value) }));
document.querySelectorAll<HTMLButtonElement>("[data-material]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.updateSelected({ material: button.dataset.material as PlaygroundMaterial });
    pulseWorld();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-mass]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.updateSelected({ mass: Number(button.dataset.mass) });
    pulseWorld();
  });
});
objectColor.addEventListener("input", () => playground.updateSelected({ color: objectColor.value }));

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && playground.cancelRopeConnection()) return;
  if (event.code === "Escape" && appLayout.classList.contains("is-focus-mode")) {
    setFocusMode(false);
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.matches("input, textarea, select")) return;
  if (event.code === "Space") {
    event.preventDefault();
    playground.toggle();
  } else if (event.code === "Delete" || event.code === "Backspace") {
    if (appMode === "sandbox") playground.removeSelected();
  } else if (event.code === "ArrowRight" && playground.paused) {
    playground.stepOnce();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth <= 940 && appLayout.classList.contains("is-focus-mode")) setFocusMode(false);
});

function bindToggle(
  selector: string,
  option: "grid" | "trails" | "vectors",
): void {
  const input = required<HTMLInputElement>(selector);
  input.addEventListener("change", () => playground.setVisualization(option, input.checked));
}

function renderSnapshot(snapshot: PlaygroundSnapshot): void {
  playButton.textContent = snapshot.paused ? "▶  실행" : "Ⅱ  일시정지";
  playButton.dataset.running = String(!snapshot.paused);
  stepButton.disabled = !snapshot.paused;

  required<HTMLOutputElement>("#gravity-value").value = gravityDescription(snapshot.gravity);

  const status = required<HTMLElement>("#run-status");
  status.textContent = snapshot.paused ? "대기" : "실행 중";
  status.dataset.running = String(!snapshot.paused);

  labGraph.hidden = !snapshot.graph;
  if (snapshot.graph) {
    required<HTMLElement>("#lab-graph-title").textContent = snapshot.graph.title;
    required<HTMLElement>("#lab-graph-y-label").textContent = `세로축 · ${snapshot.graph.yLabel}`;
    renderLabGraph(labGraphCanvas, snapshot.graph);
    renderGraphLegend(snapshot.graph);
  }

  document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
    setActive(button, Math.abs(Number(button.dataset.gravity) - snapshot.gravity) < 0.01);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-lab]").forEach((button) => {
    setActive(button, appMode === "lab" && button.dataset.lab === activeLab.id);
  });
  const editorAvailable = !objectEditor.hidden;
  inspectorEmpty.hidden = !editorAvailable || Boolean(snapshot.selected);
  inspectorForm.hidden = !editorAvailable || !snapshot.selected;
  blockResizeHelp.hidden = appMode !== "sandbox"
    || !snapshot.selected?.fixed
    || snapshot.selected.guided
    || snapshot.selected.shape !== "box";
  deleteButton.disabled = appMode === "lab" || !snapshot.selected;
  document.querySelectorAll<HTMLButtonElement>("[data-connection-kind]").forEach((button) => {
    const kind = button.dataset.connectionKind as SandboxConnectionKind;
    const active = snapshot.ropeConnection?.kind === kind;
    setActive(button, active);
    button.disabled = appMode === "lab"
      || (!snapshot.ropeConnection && (!snapshot.selected || snapshot.selected.guided));
    button.querySelector("span")!.textContent = active
      ? "두 번째 물체 선택"
      : kind === "rod" ? "막대" : "줄";
  });
  const forceButton = required<HTMLButtonElement>("[data-force-tool]");
  const forceActive = Boolean(snapshot.selected && snapshot.appliedForceIds.includes(snapshot.selected.id));
  setActive(forceButton, forceActive);
  forceButton.disabled = appMode === "lab" || !snapshot.selected || snapshot.selected.fixed || snapshot.selected.guided;
  document.querySelectorAll<HTMLButtonElement>("[data-environment-kind]").forEach((button) => {
    const active = button.dataset.environmentKind === "water" && snapshot.environment.water;
    setActive(button, active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-movable-only]").forEach((element) => {
    element.hidden = appMode === "sandbox"
      ? Boolean(snapshot.selected?.fixed && !snapshot.selected.guided)
      : element.hasAttribute("data-sandbox-only") || !activeLab.controls.includes("mass");
  });
  sandboxObservation.hidden = appMode !== "sandbox" || !snapshot.observation;
  if (snapshot.observation) {
    required<HTMLOutputElement>("#observe-speed").value = `${snapshot.observation.speed.toFixed(2)} m/s`;
    required<HTMLOutputElement>("#observe-acceleration").value = `${snapshot.observation.acceleration.toFixed(2)} m/s²`;
    required<HTMLOutputElement>("#observe-momentum").value = `${snapshot.observation.momentum.toFixed(2)} kg·m/s`;
    required<HTMLOutputElement>("#observe-kinetic").value = `${snapshot.observation.kineticEnergy.toFixed(2)} J`;
    required<HTMLOutputElement>("#observe-potential").value = `${snapshot.observation.potentialEnergy.toFixed(2)} J`;
    required<HTMLOutputElement>("#observe-spring").value = `${snapshot.observation.springEnergy.toFixed(2)} J`;
    required<HTMLOutputElement>("#observe-force").value = `${snapshot.observation.appliedForce.toFixed(2)} N`;
  }

  if (!snapshot.selected) {
    return;
  }

  const selected = snapshot.selected;
  materialSettings.hidden = appMode === "lab"
    ? !activeLab.controls.includes("material")
    : Boolean(selected.anchor || selected.gravitySource);
  materialTitle.textContent = appMode === "sandbox" && selected.fixed ? "표면 재질" : "재질";
  required<HTMLElement>("#selection-name").textContent = selected.label;
  required<HTMLElement>("#selection-type").textContent = selected.guided
    ? "장치에 연결된 짐"
    : selected.gravitySource ? "주변을 끌어당기는 중력원"
      : selected.anchor ? "줄을 묶는 고정점"
      : selected.fixed ? "움직이지 않는 블록" : selected.shape === "circle" ? "움직이는 공" : "움직이는 상자";

  syncInput(objectLabel, selected.label);
  syncInput(objectMass, selected.mass.toFixed(1));
  document.querySelectorAll<HTMLButtonElement>("[data-material]").forEach((button) => {
    setActive(button, button.dataset.material === selected.material);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-mass]").forEach((button) => {
    setActive(button, Number(button.dataset.mass) === selected.mass);
  });
  if (document.activeElement !== objectColor) objectColor.value = selected.color;
}

function renderGraphLegend(graph: NonNullable<PlaygroundSnapshot["graph"]>): void {
  const latest = graph.samples.at(-1)?.values ?? [];
  const entries = graph.series.map((series, index) => {
    const entry = document.createElement("span");
    const key = document.createElement("i");
    key.style.backgroundColor = series.color;
    const label = document.createElement("strong");
    label.textContent = series.label;
    const value = document.createElement("output");
    value.textContent = formatGraphValue(latest[index] ?? 0);
    entry.append(key, label, value);
    return entry;
  });
  labGraphLegend.replaceChildren(...entries);
}

function activateLab(id: PlaygroundPreset, source: LabActivationSource = "selection"): void {
  appMode = "lab";
  activeLab = mechanicsLab(id);
  renderLabGuide(activeLab);
  applyModeUi();
  playground.loadPreset(id, shouldAutoPlayLab(source));
  pulseWorld();
}

function activateSandbox(): void {
  appMode = "sandbox";
  applyModeUi();
  playground.startSandbox();
  pulseWorld();
}

function applyModeUi(): void {
  document.body.dataset.appMode = appMode;
  labBrowser.hidden = appMode !== "lab";
  sandboxBrowser.hidden = appMode !== "sandbox";
  labGuide.hidden = appMode !== "lab";

  document.querySelectorAll<HTMLButtonElement>("[data-app-mode]").forEach((button) => {
    const active = button.dataset.appMode === appMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-sandbox-only]").forEach((element) => {
    element.hidden = appMode !== "sandbox";
  });
  document.querySelectorAll<HTMLElement>("[data-lab-control]").forEach((element) => {
    const control = element.dataset.labControl;
    element.hidden = appMode === "lab" && !activeLab.controls.includes(control as LabControl);
  });

  const hasObjectControl = activeLab.controls.includes("mass") || activeLab.controls.includes("material");
  objectEditor.hidden = appMode === "lab" && !hasObjectControl;
  inspectorHeading.textContent = appMode === "lab" ? "바꿔 볼 조건" : "물체 설정";
  inspectorEyebrow.textContent = appMode === "lab" ? "CHANGE A CONDITION" : "SELECTED OBJECT";
}

function renderLabGuide(lab: MechanicsLab): void {
  required<HTMLElement>("#lab-guide-title").textContent = lab.title;
  required<HTMLElement>("#lab-guide-question").textContent = lab.question;
  required<HTMLElement>("#lab-step-1").textContent = lab.steps[0];
  required<HTMLElement>("#lab-step-2").textContent = lab.steps[1];
  required<HTMLElement>("#lab-step-3").textContent = lab.steps[2];
  required<HTMLElement>("#lab-observe").textContent = lab.observe;
  lawTitle.textContent = lab.law.title;
  lawDescription.textContent = lab.law.description;
  lawEquation.textContent = lab.law.equation;
}

function setActive(button: HTMLButtonElement, active: boolean): void {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
}

function setFocusMode(enabled: boolean): void {
  appLayout.classList.toggle("is-focus-mode", enabled);
  focusButton.setAttribute("aria-pressed", String(enabled));
  focusButton.textContent = enabled ? "▦ 설정 보기" : "⛶ 크게 보기";
  focusButton.title = enabled ? "설정 패널 다시 열기 (Esc)" : "설정 패널을 접고 실험 공간 크게 보기";
}

function syncInput(input: HTMLInputElement, value: string): void {
  if (document.activeElement !== input) input.value = value;
}

function gravityDescription(gravity: number): string {
  if (gravity === 0) return "무중력 · 0×";
  if (Math.abs(gravity - 1.62) < 0.01) return "달 · 0.17×";
  if (Math.abs(gravity - EARTH_GRAVITY) < 0.01) return "지구 · 1×";
  if (Math.abs(gravity - 24.79) < 0.01) return "목성 · 2.53×";
  return `${(gravity / EARTH_GRAVITY).toFixed(2)}× 지구`;
}

function pulseWorld(): void {
  const frame = canvas.closest<HTMLElement>(".canvas-frame");
  if (!frame) return;
  frame.classList.remove("setting-changed");
  requestAnimationFrame(() => frame.classList.add("setting-changed"));
  window.setTimeout(() => frame.classList.remove("setting-changed"), 420);
}
