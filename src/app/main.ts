import {
  PhysicsPlayground,
  type PlaygroundMaterial,
  type PlaygroundPreset,
  type PlaygroundSnapshot,
} from "./physics-playground";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element;
}

const canvas = required<HTMLCanvasElement>("#physics-canvas");
const playButton = required<HTMLButtonElement>("#play");
const stepButton = required<HTMLButtonElement>("#step");
const addObjectButton = required<HTMLButtonElement>("#add-object");
const deleteButton = required<HTMLButtonElement>("#delete-object");
const focusButton = required<HTMLButtonElement>("#focus-mode");
const appLayout = required<HTMLElement>(".app-layout");
const inspectorEmpty = required<HTMLElement>("#inspector-empty");
const inspectorForm = required<HTMLFormElement>("#inspector-form");
const objectLabel = required<HTMLInputElement>("#object-label");
const objectMass = required<HTMLInputElement>("#object-mass");
const objectColor = required<HTMLInputElement>("#object-color");
const lawTitle = required<HTMLElement>("#law-title");
const lawDescription = required<HTMLElement>("#law-description");
const lawEquation = required<HTMLElement>("#law-equation");
const EARTH_GRAVITY = 9.81;

const PRESET_GUIDES: Record<PlaygroundPreset, { title: string; description: string; equation: string }> = {
  "free-fall": {
    title: "중력과 가속도",
    description: "중력은 물체를 아래로 끌어 속도를 계속 바꿉니다.",
    equation: "F = mg",
  },
  projectile: {
    title: "던진 물체의 운동",
    description: "옆으로 가는 동안 중력이 아래쪽 속도를 더해 곡선으로 움직입니다.",
    equation: "x = x₀ + v₀t + ½at²",
  },
  collision: {
    title: "충돌·운동량·충격량",
    description: "부딪히는 순간 운동량이 전달되고, 짧게 작용한 힘이 움직임을 바꿉니다.",
    equation: "p = mv · J = Δp",
  },
  spring: {
    title: "용수철과 에너지",
    description: "용수철의 복원력이 저장된 에너지와 움직임 에너지를 서로 바꿉니다.",
    equation: "F = −kx · E = ½mv² + ½kx²",
  },
  friction: {
    title: "마찰력",
    description: "마찰력은 움직이는 반대 방향으로 작용해 물체를 천천히 멈춥니다.",
    equation: "F = μN",
  },
  rotation: {
    title: "회전과 토크",
    description: "회전축에서 떨어진 곳에 작용하는 힘이 막대를 돌립니다.",
    equation: "τ = Iα",
  },
  orbit: {
    title: "원운동·만유인력·궤도",
    description: "중력이 중심 가속도가 되어 작은 별의 속도 방향을 계속 바꿉니다.",
    equation: "a = v²/r · F = GMm/r²",
  },
  buoyancy: {
    title: "부력",
    description: "물에 잠긴 부피가 커질수록 위로 미는 힘이 커집니다.",
    equation: "Fᵦ = ρgV",
  },
  constraints: {
    title: "진자와 줄·막대",
    description: "길이가 고정된 연결 안에서 중력이 추를 왕복 운동하게 합니다.",
    equation: "|A − B| = L · T ≈ 2π√(L/g)",
  },
  pulley: {
    title: "도르래",
    description: "줄로 연결된 두 추는 같은 거리만큼 반대 방향으로 움직입니다.",
    equation: "a = g(m₂−m₁)/(m₁+m₂)",
  },
};

const playground = new PhysicsPlayground(canvas, { onUpdate: renderSnapshot });
playground.loadPreset("free-fall");

playButton.addEventListener("click", () => playground.toggle());
stepButton.addEventListener("click", () => playground.stepOnce());
required<HTMLButtonElement>("#reset").addEventListener("click", () => playground.reset(true));
addObjectButton.addEventListener("click", () => playground.addObject());
deleteButton.addEventListener("click", () => playground.removeSelected());
focusButton.addEventListener("click", () => setFocusMode(!appLayout.classList.contains("is-focus-mode")));

bindToggle("#show-grid", "grid");
bindToggle("#show-trails", "trails");
bindToggle("#show-vectors", "vectors");

document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.loadPreset(button.dataset.preset as PlaygroundPreset, true);
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
    playground.removeSelected();
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

  document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
    setActive(button, Math.abs(Number(button.dataset.gravity) - snapshot.gravity) < 0.01);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
    setActive(button, button.dataset.preset === snapshot.preset);
  });
  const guide = PRESET_GUIDES[snapshot.preset];
  lawTitle.textContent = guide.title;
  lawDescription.textContent = guide.description;
  lawEquation.textContent = guide.equation;

  inspectorEmpty.hidden = Boolean(snapshot.selected);
  inspectorForm.hidden = !snapshot.selected;
  deleteButton.disabled = !snapshot.selected;

  if (!snapshot.selected) {
    return;
  }

  const selected = snapshot.selected;
  required<HTMLElement>("#selection-name").textContent = selected.label;
  required<HTMLElement>("#selection-type").textContent =
    selected.shape === "circle" ? "동그란 공" : "네모난 상자";

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
