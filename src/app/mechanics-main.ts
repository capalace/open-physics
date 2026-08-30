import {
  PhysicsPlayground,
  type PlaygroundMaterial,
  type PlaygroundPreset,
  type PlaygroundForceDiagram,
  type PlaygroundSnapshot,
  type PlaygroundTrialComparison,
  type SandboxApparatusKind,
  type SandboxConnectionKind,
  type SandboxEnvironmentKind,
  type SandboxObjectKind,
} from "./physics-playground";
import {
  collisionPredictionSummary,
  horizontalMotionDirection,
  motionDirectionLabel,
  type CollisionPrediction,
  type MotionDirection,
} from "./experiment-learning";
import { formatGraphValue, renderLabGraph } from "./lab-graph";
import { subjectPickerMarkup, termGlossaryMarkup } from "./subjects/subject-ui";
import {
  MECHANICS_LABS,
  mechanicsInteractionTip,
  mechanicsLab,
  mechanicsSettingFeedback,
  shouldAutoPlayLab,
  type LabActivationSource,
  type LabControl,
  type MechanicsLab,
} from "./mechanics-labs";
import { SubjectRouteSession, type SubjectRoute, type SubjectRouteSource } from "./subjects/subject-experience";

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
const blockAngle = required<HTMLOutputElement>("#block-angle");
const materialSettings = required<HTMLElement>("#material-settings");
const materialTitle = required<HTMLElement>("#material-title");
const sandboxObservation = required<HTMLElement>("#sandbox-observation");
const objectLabel = required<HTMLInputElement>("#object-label");
const objectMass = required<HTMLInputElement>("#object-mass");
const objectColor = required<HTMLInputElement>("#object-color");
const lawTitle = required<HTMLElement>("#law-title");
const lawDescription = required<HTMLElement>("#law-description");
const lawEquation = required<HTMLElement>("#law-equation");
const labGuide = required<HTMLElement>("#lab-guide");
const labGraph = required<HTMLElement>("#lab-graph");
const labGraphCanvas = required<HTMLCanvasElement>("#lab-graph-canvas");
const labGraphLegend = required<HTMLElement>("#lab-graph-legend");
const objectEditor = required<HTMLElement>("#object-editor");
const inspectorHeading = required<HTMLElement>("#object-editor .inspector-header h2");
const inspectorEyebrow = required<HTMLElement>("#object-editor .eyebrow");
const experimentPanel = required<HTMLElement>("#experiment-panel");
const inspectorPanel = required<HTMLElement>("#inspector-panel");
const workspace = required<HTMLElement>(".workspace");
const EARTH_GRAVITY = 9.81;
let appMode: AppMode = "sandbox";
let activeLab = mechanicsLab("free-fall");
let feedbackTimer = 0;
let latestSnapshot: PlaygroundSnapshot | null = null;
let pinnedComparison: PlaygroundTrialComparison | null = null;
let collisionPrediction: CollisionPrediction = { a: null, b: null };
let collisionActual: { a: MotionDirection; b: MotionDirection } | null = null;
let collisionPauseTimer = 0;

const playground = new PhysicsPlayground(canvas, { onUpdate: renderSnapshot });
setupMechanicsScreens();
let routeSession: SubjectRouteSession;

playButton.addEventListener("click", () => playground.toggle());
stepButton.addEventListener("click", () => playground.stepOnce());
required<HTMLButtonElement>("#reset").addEventListener("click", () => {
  if (appMode === "lab") {
    resetLearningState(activeLab.id);
    playground.setDirectManipulationAutoPlay(activeLab.id !== "collision");
    playground.loadPreset(activeLab.id, activeLab.id !== "collision");
  }
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

required<HTMLButtonElement>("[data-start-sandbox]").addEventListener("click", () => routeSession.openLab("sandbox"));
required<HTMLButtonElement>("[data-subject-back]").addEventListener("click", () => routeSession.returnToSelection());

bindToggle("#show-grid", "grid");
bindToggle("#show-trails", "trails");
bindToggle("#show-vectors", "vectors");

document.querySelectorAll<HTMLButtonElement>("[data-lab]").forEach((button) => {
  button.addEventListener("click", () => {
    routeSession.openLab(button.dataset.lab as PlaygroundPreset);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
  button.addEventListener("click", () => {
    const gravity = Number(button.dataset.gravity);
    playground.setGravity(gravity);
    pulseWorld(mechanicsSettingFeedback("gravity", gravityDescription(gravity)));
  });
});

objectLabel.addEventListener("change", () => playground.updateSelected({ label: objectLabel.value }));
objectMass.addEventListener("input", () => playground.updateSelected({ mass: Number(objectMass.value) }));
document.querySelectorAll<HTMLButtonElement>("[data-material]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.updateSelected({ material: button.dataset.material as PlaygroundMaterial });
    const label = button.querySelector("strong")?.textContent?.trim() || button.textContent?.trim() || "변경됨";
    pulseWorld(mechanicsSettingFeedback("material", label));
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-mass]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.updateSelected({ mass: Number(button.dataset.mass) });
    pulseWorld(mechanicsSettingFeedback("mass", button.textContent?.trim() || "변경됨"));
  });
});
objectColor.addEventListener("input", () => playground.updateSelected({ color: objectColor.value }));

routeSession = new SubjectRouteSession({
  definition: { id: "mechanics", labs: MECHANICS_LABS },
  onRoute: (route, source) => applyRoute(route, source),
});
routeSession.start();

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
  if (window.innerWidth > 700 && window.innerWidth <= 940 && appLayout.classList.contains("is-focus-mode")) setFocusMode(false);
});

function bindToggle(
  selector: string,
  option: "grid" | "trails" | "vectors",
): void {
  const input = required<HTMLInputElement>(selector);
  input.addEventListener("change", () => playground.setVisualization(option, input.checked));
}

function renderSnapshot(snapshot: PlaygroundSnapshot): void {
  latestSnapshot = snapshot;
  if (appMode === "lab" && activeLab.id === "collision" && snapshot.collision?.occurred && !collisionActual) {
    collisionActual = {
      a: horizontalMotionDirection(snapshot.collision.velocityA),
      b: horizontalMotionDirection(snapshot.collision.velocityB),
    };
    window.clearTimeout(collisionPauseTimer);
    collisionPauseTimer = window.setTimeout(() => {
      if (appMode === "lab" && activeLab.id === "collision") playground.paused = true;
    }, 260);
  }
  playButton.textContent = snapshot.paused ? "▶  실행" : "Ⅱ  일시정지";
  playButton.dataset.running = String(!snapshot.paused);
  playButton.disabled = appMode === "lab"
    && activeLab.id === "collision"
    && (!collisionPrediction.a || !collisionPrediction.b)
    && !collisionActual;
  stepButton.disabled = !snapshot.paused || (
    appMode === "lab"
    && activeLab.id === "collision"
    && (!collisionPrediction.a || !collisionPrediction.b)
    && !collisionActual
  );

  required<HTMLOutputElement>("#gravity-value").value = gravityDescription(snapshot.gravity);

  const status = required<HTMLElement>("#run-status");
  status.textContent = snapshot.paused ? "멈춤" : "실행 중";
  status.dataset.running = String(!snapshot.paused);

  labGraph.hidden = !snapshot.graph;
  if (snapshot.graph) {
    required<HTMLElement>("#lab-graph-title").textContent = snapshot.graph.title;
    required<HTMLElement>("#lab-graph-y-label").textContent = `세로축 · ${snapshot.graph.yLabel}`;
    renderLabGraph(labGraphCanvas, snapshot.graph);
    renderGraphLegend(snapshot.graph);
  }
  renderForceSummary(snapshot.forceDiagram);
  renderCollisionPrediction();
  renderTrialComparison(snapshot.comparison);

  document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
    setActive(button, Math.abs(Number(button.dataset.gravity) - snapshot.gravity) < 0.01);
  });
  const showingLab = document.body.dataset.subjectScreen === "lab";
  document.querySelectorAll<HTMLButtonElement>("[data-lab]").forEach((button) => {
    setActive(button, showingLab && appMode === "lab" && button.dataset.lab === activeLab.id);
  });
  setActive(required<HTMLButtonElement>("[data-start-sandbox]"), showingLab && appMode === "sandbox");
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
  blockAngle.value = `각도 ${Math.round(selected.angleDegrees)}°`;
  materialSettings.hidden = appMode === "lab"
    ? !activeLab.controls.includes("material")
    : Boolean(selected.anchor || selected.gravitySource);
  materialTitle.textContent = appMode === "sandbox" && selected.fixed ? "표면 재질" : "재질";
  required<HTMLElement>("#selection-name").textContent = selected.label;
  required<HTMLElement>("#selection-type").textContent = selected.guided
    ? "장치에 연결된 짐"
    : selected.gravitySource ? "주변을 끌어당기는 중력원"
      : selected.anchor ? "줄을 묶는 고정점"
      : selected.fixed
        ? selected.shape === "box" && Math.abs(selected.angleDegrees) > 0.1
          ? "빗면으로 쓰는 고정 블록"
          : "움직이지 않는 블록"
        : selected.shape === "circle" ? "움직이는 공" : "움직이는 상자";

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

function renderForceSummary(diagram: PlaygroundForceDiagram | null): void {
  const summary = required<HTMLElement>("#force-summary");
  summary.hidden = appMode !== "lab" || !diagram;
  if (!diagram) return;
  required<HTMLElement>("#force-object-name").textContent = `${diagram.objectLabel}에 작용하는 힘`;
  required<HTMLOutputElement>("#net-force-value").textContent = diagram.balanced
    ? "0 N · 평형"
    : `${diagram.net.magnitude.toFixed(1)} N · ${diagram.net.direction}`;
  required<HTMLElement>("#net-force-explanation").textContent = diagram.balanced
    ? "서로 반대인 힘이 균형을 이뤄 움직임이 바뀌지 않아요."
    : `모든 힘을 합치면 ${diagram.net.direction}으로 작용해요.`;
  const entries = diagram.forces.map((force) => {
    const item = document.createElement("li");
    const key = document.createElement("i");
    key.style.backgroundColor = force.color;
    const label = document.createElement("strong");
    label.textContent = force.label;
    const value = document.createElement("span");
    value.textContent = `${force.magnitude.toFixed(1)} N · ${force.direction}`;
    item.append(key, label, value);
    return item;
  });
  const list = required<HTMLElement>("#force-list");
  list.replaceChildren(...entries);
  list.hidden = entries.length === 0;
  required<HTMLElement>("#force-empty").hidden = entries.length > 0;
}

function activateLab(id: PlaygroundPreset, source: LabActivationSource = "selection"): void {
  appMode = "lab";
  activeLab = mechanicsLab(id);
  resetLearningState(id);
  playground.setDirectManipulationAutoPlay(id !== "collision");
  renderLabGuide(activeLab);
  applyModeUi();
  playground.loadPreset(id, id === "collision" ? false : shouldAutoPlayLab(source));
  hideMechanicsFeedback();
  pulseWorld();
}

function activateSandbox(): void {
  appMode = "sandbox";
  playground.setDirectManipulationAutoPlay(true);
  applyModeUi();
  playground.startSandbox();
  hideMechanicsFeedback();
  pulseWorld();
}

function applyRoute(route: SubjectRoute, source: SubjectRouteSource): void {
  const selection = required<HTMLElement>("[data-subject-selection-screen]");
  const labScreen = required<HTMLElement>("[data-subject-lab-screen]");
  if (route.screen === "selection") {
    playground.paused = true;
    document.body.dataset.subjectScreen = "selection";
    selection.hidden = false;
    labScreen.hidden = true;
    selection.querySelectorAll<HTMLButtonElement>(".quick-start").forEach((button) => setActive(button, false));
    return;
  }
  document.body.dataset.subjectScreen = "lab";
  selection.hidden = true;
  labScreen.hidden = false;
  if (route.labId === "sandbox") activateSandbox();
  else activateLab(route.labId as PlaygroundPreset, source === "navigation" ? "selection" : "initial");
  window.dispatchEvent(new Event("resize"));
}

function setupMechanicsScreens(): void {
  const browser = required<HTMLElement>("#lab-browser");
  browser.classList.add("subject-browser", "mechanics-browser");
  const selection = document.createElement("div");
  selection.className = "subject-selection-screen mechanics-selection-screen";
  selection.dataset.subjectSelectionScreen = "";
  selection.innerHTML = `<div class="subject-selection-intro"><span class="eyebrow">역학</span><h1>어떤 실험을 해볼까요?</h1><p>실험을 고르면 조작 화면으로 이동합니다. 브라우저 뒤로가기로 이 화면에 돌아올 수 있어요.</p></div>${subjectPickerMarkup("mechanics")}`;
  selection.append(browser);

  const labScreen = document.createElement("div");
  labScreen.className = "subject-lab-screen mechanics-lab-screen";
  labScreen.dataset.subjectLabScreen = "";
  labScreen.hidden = true;
  labScreen.append(...workspace.childNodes);
  workspace.replaceChildren(selection, labScreen);

  const canvasFrame = canvas.closest<HTMLElement>(".canvas-frame");
  if (!canvasFrame) throw new Error(".canvas-frame not found");
  const interactionTip = document.createElement("div");
  interactionTip.className = "mechanics-interaction-tip";
  interactionTip.dataset.mechanicsInteractionTip = "";
  interactionTip.setAttribute("role", "note");
  const settingFeedback = document.createElement("div");
  settingFeedback.className = "mechanics-setting-feedback";
  settingFeedback.dataset.mechanicsFeedback = "";
  settingFeedback.setAttribute("role", "status");
  settingFeedback.setAttribute("aria-live", "polite");
  settingFeedback.hidden = true;
  canvasFrame.append(interactionTip, settingFeedback);

  const settingsHeader = document.createElement("div");
  settingsHeader.className = "subject-settings-header";
  settingsHeader.innerHTML = `<button class="subject-back-button" type="button" data-subject-back>← 실험 선택</button><div><span class="eyebrow">실험 설정</span><h2 data-subject-settings-title>바꿔 볼 조건</h2></div>`;
  const creationControls = required<HTMLElement>(".creation-controls");
  creationControls.classList.add("subject-settings-tools");
  const mobileTools = document.createElement("details");
  mobileTools.className = "mobile-tools-drawer";
  mobileTools.dataset.sandboxOnly = "";
  mobileTools.innerHTML = "<summary>도구 추가</summary>";
  mobileTools.append(creationControls);
  const mobileSettings = document.createElement("details");
  mobileSettings.className = "mobile-settings-drawer";
  mobileSettings.innerHTML = "<summary>물체·환경 세부 설정</summary>";
  mobileSettings.append(
    objectEditor,
    required<HTMLElement>(".environment-section"),
    required<HTMLElement>(".visualization-section"),
  );
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  mobileTools.open = !mobileQuery.matches;
  mobileSettings.open = !mobileQuery.matches;
  mobileQuery.addEventListener("change", (event) => { mobileTools.open = !event.matches; mobileSettings.open = !event.matches; });
  experimentPanel.replaceChildren(settingsHeader, mobileTools, mobileSettings);
  inspectorPanel.setAttribute("aria-label", "실험 설명과 관찰 결과");
  const termGlossary = document.createElement("div");
  termGlossary.id = "lab-term-glossary";
  const lawSection = lawTitle.closest<HTMLElement>(".lab-law");
  if (!lawSection) throw new Error(".lab-law not found");
  const forceSummary = document.createElement("section");
  forceSummary.id = "force-summary";
  forceSummary.className = "force-summary";
  forceSummary.innerHTML = `
    <div><span>힘 살펴보기</span><output id="net-force-value"></output></div>
    <h3 id="force-object-name"></h3>
    <p id="net-force-explanation"></p>
    <ul id="force-list"></ul>
    <p id="force-empty" class="force-empty">지금은 계속 작용하는 힘이 없어요. 충돌 순간에는 짧은 충돌력이 생겨요.</p>`;
  const collisionPredictionPanel = document.createElement("section");
  collisionPredictionPanel.id = "collision-prediction";
  collisionPredictionPanel.className = "collision-prediction";
  collisionPredictionPanel.hidden = true;
  collisionPredictionPanel.innerHTML = `
    <span>먼저 예상해 보기</span>
    <h3>충돌 뒤 어느 쪽으로 움직일까요?</h3>
    <div class="collision-prediction-row" data-prediction-object="a"><strong>물체 A</strong><div role="group" aria-label="물체 A의 예상 방향"><button type="button" data-collision-object="a" data-collision-prediction="left">← 왼쪽</button><button type="button" data-collision-object="a" data-collision-prediction="stop">멈춤</button><button type="button" data-collision-object="a" data-collision-prediction="right">오른쪽 →</button></div></div>
    <div class="collision-prediction-row" data-prediction-object="b"><strong>물체 B</strong><div role="group" aria-label="물체 B의 예상 방향"><button type="button" data-collision-object="b" data-collision-prediction="left">← 왼쪽</button><button type="button" data-collision-object="b" data-collision-prediction="stop">멈춤</button><button type="button" data-collision-object="b" data-collision-prediction="right">오른쪽 →</button></div></div>
    <p data-collision-prediction-status></p>
    <div class="collision-prediction-result" data-collision-prediction-result hidden></div>`;
  collisionPredictionPanel.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-collision-prediction]");
    if (!button || collisionActual) return;
    const object = button.dataset.collisionObject as "a" | "b";
    collisionPrediction = { ...collisionPrediction, [object]: button.dataset.collisionPrediction as MotionDirection };
    renderCollisionPrediction();
    if (collisionPrediction.a && collisionPrediction.b && playground.paused) {
      playground.setDirectManipulationAutoPlay(true);
      pulseWorld("✓ 예측을 저장했어요 — 충돌을 시작합니다.");
      playground.paused = false;
    }
  });
  const comparisonPanel = document.createElement("section");
  comparisonPanel.id = "trial-comparison";
  comparisonPanel.className = "trial-comparison";
  comparisonPanel.hidden = true;
  comparisonPanel.innerHTML = `
    <div><span>두 조건 비교하기</span><button type="button" data-pin-comparison>현재 결과 고정</button></div>
    <p>결과를 고정한 뒤 조건을 바꾸면 차이가 바로 보여요.</p>
    <div class="trial-comparison-grid"><article data-pinned-trial></article><article data-current-trial></article></div>`;
  comparisonPanel.querySelector<HTMLButtonElement>("[data-pin-comparison]")?.addEventListener("click", () => {
    if (!latestSnapshot?.comparison) return;
    pinnedComparison = cloneComparison(latestSnapshot.comparison);
    renderTrialComparison(latestSnapshot.comparison);
    pulseWorld("✓ 첫 번째 결과를 고정했어요 — 이제 조건을 바꿔 보세요.");
  });
  labGuide.insertBefore(collisionPredictionPanel, lawSection);
  labGuide.insertBefore(forceSummary, lawSection);
  labGuide.insertBefore(comparisonPanel, lawSection);
  labGuide.insertBefore(termGlossary, lawSection);
}

function applyModeUi(): void {
  document.body.dataset.appMode = appMode;
  required<HTMLElement>("[data-subject-settings-title]").textContent = appMode === "sandbox" ? "실험실 도구" : "바꿔 볼 조건";
  labGuide.hidden = appMode !== "lab";
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
  inspectorEyebrow.textContent = appMode === "lab" ? "조건 바꾸기" : "선택한 물체";
  const interactionTip = required<HTMLElement>("[data-mechanics-interaction-tip]");
  interactionTip.hidden = appMode !== "lab";
  if (appMode === "lab") interactionTip.textContent = `☝ ${mechanicsInteractionTip(activeLab.id)}`;
}

function renderLabGuide(lab: MechanicsLab): void {
  required<HTMLElement>("#lab-guide-title").textContent = lab.title;
  required<HTMLElement>("#lab-guide-question").textContent = lab.question;
  required<HTMLElement>("#lab-step-1").textContent = lab.steps[0];
  required<HTMLElement>("#lab-step-2").textContent = lab.steps[1];
  required<HTMLElement>("#lab-step-3").textContent = lab.steps[2];
  required<HTMLElement>("#lab-observe").textContent = lab.observe;
  required<HTMLElement>("#lab-term-glossary").innerHTML = termGlossaryMarkup(lab.terms);
  lawTitle.textContent = lab.law.title;
  lawDescription.textContent = lab.law.description;
  lawEquation.textContent = lab.law.equation;
}

function resetLearningState(id: PlaygroundPreset): void {
  pinnedComparison = null;
  collisionPrediction = { a: null, b: null };
  collisionActual = null;
  window.clearTimeout(collisionPauseTimer);
  const predictionPanel = document.querySelector<HTMLElement>("#collision-prediction");
  if (predictionPanel) predictionPanel.hidden = id !== "collision";
  const comparisonPanel = document.querySelector<HTMLElement>("#trial-comparison");
  if (comparisonPanel) comparisonPanel.hidden = id !== "friction" && id !== "pulley";
}

function renderCollisionPrediction(): void {
  const panel = document.querySelector<HTMLElement>("#collision-prediction");
  if (!panel || panel.hidden) return;
  panel.querySelectorAll<HTMLButtonElement>("[data-collision-prediction]").forEach((button) => {
    const object = button.dataset.collisionObject as "a" | "b";
    const selected = collisionPrediction[object] === button.dataset.collisionPrediction;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = Boolean(collisionActual);
  });
  const status = panel.querySelector<HTMLElement>("[data-collision-prediction-status]");
  if (status) status.textContent = collisionPredictionSummary(collisionPrediction, collisionActual);
  const result = panel.querySelector<HTMLElement>("[data-collision-prediction-result]");
  if (!result) return;
  result.hidden = !collisionActual;
  if (collisionActual) {
    result.innerHTML = `
      <div><strong>물체 A</strong><span>예상 ${motionDirectionLabel(collisionPrediction.a ?? "stop")}</span><b>실제 ${motionDirectionLabel(collisionActual.a)}</b></div>
      <div><strong>물체 B</strong><span>예상 ${motionDirectionLabel(collisionPrediction.b ?? "stop")}</span><b>실제 ${motionDirectionLabel(collisionActual.b)}</b></div>`;
  }
}

function cloneComparison(comparison: PlaygroundTrialComparison): PlaygroundTrialComparison {
  return {
    condition: comparison.condition,
    values: comparison.values.map((value) => ({ ...value })),
  };
}

function trialMarkup(label: string, comparison: PlaygroundTrialComparison | null): string {
  if (!comparison) return `<span>${label}</span><p>아직 고정한 결과가 없어요.</p>`;
  return `<span>${label}</span><strong>${comparison.condition}</strong><dl>${comparison.values.map((value) => `<div><dt>${value.label}</dt><dd>${value.value.toFixed(value.value < 10 ? 1 : 0)} ${value.unit}</dd></div>`).join("")}</dl>`;
}

function renderTrialComparison(current: PlaygroundTrialComparison | null): void {
  const panel = document.querySelector<HTMLElement>("#trial-comparison");
  if (!panel || panel.hidden) return;
  const pinned = panel.querySelector<HTMLElement>("[data-pinned-trial]");
  const currentTrial = panel.querySelector<HTMLElement>("[data-current-trial]");
  if (pinned) pinned.innerHTML = trialMarkup("고정한 결과", pinnedComparison);
  if (currentTrial) currentTrial.innerHTML = trialMarkup("현재 결과", current);
  const button = panel.querySelector<HTMLButtonElement>("[data-pin-comparison]");
  if (button) button.textContent = pinnedComparison ? "고정 결과 바꾸기" : "현재 결과 고정";
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

function pulseWorld(message?: string): void {
  const frame = canvas.closest<HTMLElement>(".canvas-frame");
  if (!frame) return;
  frame.classList.remove("setting-changed");
  requestAnimationFrame(() => frame.classList.add("setting-changed"));
  window.setTimeout(() => frame.classList.remove("setting-changed"), 420);
  if (!message) return;
  const feedback = required<HTMLElement>("[data-mechanics-feedback]");
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.classList.remove("is-visible");
  requestAnimationFrame(() => feedback.classList.add("is-visible"));
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(hideMechanicsFeedback, 2600);
}

function hideMechanicsFeedback(): void {
  window.clearTimeout(feedbackTimer);
  const feedback = document.querySelector<HTMLElement>("[data-mechanics-feedback]");
  if (!feedback) return;
  feedback.classList.remove("is-visible");
  feedback.hidden = true;
}
