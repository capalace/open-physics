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
const gravityInput = required<HTMLInputElement>("#gravity");
const inspectorEmpty = required<HTMLElement>("#inspector-empty");
const inspectorForm = required<HTMLFormElement>("#inspector-form");
const objectLabel = required<HTMLInputElement>("#object-label");
const objectMass = required<HTMLInputElement>("#object-mass");
const objectMaterial = required<HTMLSelectElement>("#object-material");
const velocityX = required<HTMLInputElement>("#velocity-x");
const velocityY = required<HTMLInputElement>("#velocity-y");
const objectColor = required<HTMLInputElement>("#object-color");

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

gravityInput.addEventListener("input", () => playground.setGravity(Number(gravityInput.value)));
bindToggle("#show-grid", "grid");
bindToggle("#show-trails", "trails");
bindToggle("#show-vectors", "vectors");

document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    playground.loadPreset(button.dataset.preset as PlaygroundPreset);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-time-scale]").forEach((button) => {
  button.addEventListener("click", () => playground.setTimeScale(Number(button.dataset.timeScale)));
});

objectLabel.addEventListener("change", () => playground.updateSelected({ label: objectLabel.value }));
objectMass.addEventListener("input", () => playground.updateSelected({ mass: Number(objectMass.value) }));
objectMaterial.addEventListener("change", () => {
  playground.updateSelected({ material: objectMaterial.value as PlaygroundMaterial });
});
velocityX.addEventListener("change", () => {
  playground.updateSelected({ velocityX: Number(velocityX.value) });
});
velocityY.addEventListener("change", () => {
  playground.updateSelected({ velocityY: Number(velocityY.value) });
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

  required<HTMLOutputElement>("#gravity-value").value = `${snapshot.gravity.toFixed(2)} m/s²`;
  syncInput(gravityInput, snapshot.gravity.toFixed(2));

  const status = required<HTMLElement>("#run-status");
  status.textContent = snapshot.paused ? "멈춤" : "실행 중";
  status.dataset.running = String(!snapshot.paused);
  required<HTMLElement>("#metric-time").textContent = `${snapshot.time.toFixed(2)} s`;
  required<HTMLElement>("#metric-objects").textContent = String(snapshot.objectCount);
  required<HTMLElement>("#metric-collisions").textContent = String(snapshot.collisionCount);

  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
    setActive(button, button.dataset.preset === snapshot.preset);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-time-scale]").forEach((button) => {
    setActive(button, Number(button.dataset.timeScale) === snapshot.timeScale);
  });

  inspectorEmpty.hidden = Boolean(snapshot.selected);
  inspectorForm.hidden = !snapshot.selected;
  deleteButton.disabled = !snapshot.selected;

  if (!snapshot.selected) {
    required<HTMLElement>("#metric-speed").textContent = "—";
    return;
  }

  const selected = snapshot.selected;
  required<HTMLElement>("#selection-name").textContent = selected.label;
  required<HTMLElement>("#selection-type").textContent =
    selected.shape === "circle" ? "원형 물체" : "상자 물체";
  required<HTMLElement>("#metric-speed").textContent = `${selected.speed.toFixed(2)} m/s`;
  required<HTMLElement>("#selected-energy").textContent = `${selected.kineticEnergy.toFixed(2)} J`;
  required<HTMLElement>("#selected-height").textContent = `${selected.height.toFixed(2)} m`;

  syncInput(objectLabel, selected.label);
  syncInput(objectMass, selected.mass.toFixed(1));
  objectMaterial.value = selected.material;
  required<HTMLElement>("#material-description").textContent = MATERIALS[selected.material].description;
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
