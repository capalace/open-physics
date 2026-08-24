import { PhysicsPlayground } from "./physics-playground";

const canvas = document.querySelector<HTMLCanvasElement>("#physics-canvas");
if (!canvas) throw new Error("#physics-canvas not found");

const playground = new PhysicsPlayground(canvas);
playground.reset();

const playButton = document.querySelector<HTMLButtonElement>("#play");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const gravityInput = document.querySelector<HTMLInputElement>("#gravity");
const addCircleButton = document.querySelector<HTMLButtonElement>("#add-circle");
const addBoxButton = document.querySelector<HTMLButtonElement>("#add-box");

playButton?.addEventListener("click", () => {
  playground.paused = !playground.paused;
  playButton.textContent = playground.paused ? "▶ 실행" : "⏸ 일시정지";
});
resetButton?.addEventListener("click", () => playground.reset());
gravityInput?.addEventListener("input", () => playground.setGravity(Number(gravityInput.value)));
addCircleButton?.addEventListener("click", () => playground.addCircle(160 + Math.random() * 160, 80));
addBoxButton?.addEventListener("click", () => playground.addBox(160 + Math.random() * 160, 80));
