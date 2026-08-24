import "./style.css";
import {
  MATERIALS,
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
const deleteButton = required<HTMLButtonElement>("#delete-object");
const inspectorEmpty = required<HTMLElement>("#inspector-empty");
const inspectorForm = required<HTMLFormElement>("#inspector-form");
const objectLabel = required<HTMLInputElement>("#object-label");
const objectMass = required<HTMLInputElement>("#object-mass");
const velocityX = required<HTMLInputElement>("#velocity-x");
const velocityY = required<HTMLInputElement>("#velocity-y");
const objectColor = required<HTMLInputElement>("#object-color");
const EARTH_GRAVITY = 9.81;

const playground = new PhysicsPlayground(canvas, { onUpdate: renderSnapshot });
playground.loadPreset("free-fall");

playButton.addEventListener("click", () => playground.toggle());
stepButton.addEventListener("click", () => playground.stepOnce());
required<HTMLButtonElement>("#reset").addEventListener("click", () => playground.reset());
required<HTMLButtonElement>("#add-circle").addEventListener("click", () => {
  playground.addCircle(420 + Math.random() * 120, 100);
});
required<HTMLButtonElement>("#add-box").addEventListener("click", () => {
  playground.addBox(420 + Math.random() * 120, 100);
});
deleteButton.addEventListener("click", () => playground.removeSelected());

bindToggle("#show-grid", "grid");
bindToggle("#show-trails", "trails");
bindToggle("#show-vectors", "vectors");

document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.loadPreset(button.dataset.preset as PlaygroundPreset);
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
velocityX.addEventListener("change", () => {
  playground.paused = true;
  playground.updateSelected({ velocityX: Number(velocityX.value) });
  pulseWorld();
});
velocityY.addEventListener("change", () => {
  playground.paused = true;
  playground.updateSelected({ velocityY: Number(velocityY.value) });
  pulseWorld();
});
objectColor.addEventListener("input", () => playground.updateSelected({ color: objectColor.value }));

window.addEventListener("keydown", (event) => {
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

  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
    setActive(button, button.dataset.preset === snapshot.preset);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-gravity]").forEach((button) => {
    setActive(button, Math.abs(Number(button.dataset.gravity) - snapshot.gravity) < 0.01);
  });

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
  required<HTMLElement>("#material-description").textContent = MATERIALS[selected.material].description;
  document.querySelectorAll<HTMLButtonElement>("[data-material]").forEach((button) => {
    setActive(button, button.dataset.material === selected.material);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-mass]").forEach((button) => {
    setActive(button, Number(button.dataset.mass) === selected.mass);
  });
  syncInput(velocityX, selected.velocity.x.toFixed(2));
  syncInput(velocityY, selected.velocity.y.toFixed(2));
  if (document.activeElement !== objectColor) objectColor.value = selected.color;
}

function setActive(button: HTMLButtonElement, active: boolean): void {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
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
