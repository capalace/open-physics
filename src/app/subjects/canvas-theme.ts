export const LAB_CANVAS = {
  backgroundTop: "#fbfdff",
  backgroundBottom: "#eef3f8",
  grid: "rgba(83, 96, 120, .075)",
  ink: "#34405a",
  muted: "#66758a",
  panel: "rgba(255, 255, 255, .9)",
  panelBorder: "#d7e0eb",
  shadow: "rgba(34, 48, 74, .14)",
} as const;

/** Draws the same bright laboratory surface used by the mechanics playground. */
export function drawLabBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize = 50,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  if (gradient && typeof gradient.addColorStop === "function") {
    gradient.addColorStop(0, LAB_CANVAS.backgroundTop);
    gradient.addColorStop(1, LAB_CANVAS.backgroundBottom);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = LAB_CANVAS.backgroundTop;
  }
  context.fillRect(0, 0, width, height);
  context.save();
  context.strokeStyle = LAB_CANVAS.grid;
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += gridSize) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();
}

export function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 12,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

export function drawCanvasCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 14,
): void {
  context.save();
  context.shadowColor = LAB_CANVAS.shadow;
  context.shadowBlur = 18;
  context.shadowOffsetY = 7;
  context.fillStyle = LAB_CANVAS.panel;
  roundedRectPath(context, x, y, width, height, radius);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = LAB_CANVAS.panelBorder;
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

export type CanvasInteractionAffordance =
  | { readonly kind: "object"; readonly radius?: number; readonly labelPlacement?: InteractionLabelPlacement }
  | { readonly kind: "handle"; readonly axis: "x" | "y" | "both"; readonly labelPlacement?: InteractionLabelPlacement };

export type InteractionLabelPlacement = "above" | "below" | "left" | "right";

interface ScreenProjection {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly densityX: number;
  readonly densityY: number;
  readonly width: number;
  readonly height: number;
}

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Projects the current world-space point into stable CSS pixels. */
function screenProjection(
  context: CanvasRenderingContext2D,
  point: { readonly x: number; readonly y: number },
): ScreenProjection {
  let transform: Pick<DOMMatrix, "a" | "b" | "c" | "d" | "e" | "f"> = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  try {
    const current = context.getTransform?.();
    if (current && typeof current.a === "number") transform = current;
  } catch {
    // Lightweight test contexts do not need to implement DOMMatrix.
  }
  const canvas = context.canvas;
  let cssWidth = finiteOr(canvas?.width, Number.POSITIVE_INFINITY);
  let cssHeight = finiteOr(canvas?.height, Number.POSITIVE_INFINITY);
  let densityX = 1;
  let densityY = 1;
  if (canvas && typeof canvas.getBoundingClientRect === "function") {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      cssWidth = bounds.width;
      cssHeight = bounds.height;
      densityX = Math.max(1, finiteOr(canvas.width, bounds.width) / bounds.width);
      densityY = Math.max(1, finiteOr(canvas.height, bounds.height) / bounds.height);
    }
  }
  const deviceX = transform.a * point.x + transform.c * point.y + transform.e;
  const deviceY = transform.b * point.x + transform.d * point.y + transform.f;
  const scaleX = Math.hypot(transform.a, transform.b) / densityX;
  const scaleY = Math.hypot(transform.c, transform.d) / densityY;
  return {
    x: deviceX / densityX,
    y: deviceY / densityY,
    scale: Math.max(0.001, (scaleX + scaleY) / 2),
    densityX,
    densityY,
    width: cssWidth,
    height: cssHeight,
  };
}

/** Keeps a pointer target at least finger-sized even when its world is scaled down. */
export function interactionHitRadius(
  canvas: HTMLCanvasElement,
  worldWidth: number,
  worldHeight: number,
  minimumWorldRadius = 18,
  minimumCssRadius = 24,
): number {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return minimumWorldRadius;
  return Math.max(
    minimumWorldRadius,
    minimumCssRadius * worldWidth / bounds.width,
    minimumCssRadius * worldHeight / bounds.height,
  );
}

export const drawInteractionLabel = (
  context: CanvasRenderingContext2D,
  point: { readonly x: number; readonly y: number },
  text: string,
  offset: number,
  placement: InteractionLabelPlacement = "above",
): void => {
  const projected = screenProjection(context, point);
  const width = Math.max(108, Math.min(168, text.length * 14 + 26));
  const height = 28;
  const projectedOffset = Math.max(24, offset * projected.scale);
  let centerX = projected.x;
  let centerY = projected.y - projectedOffset - height / 2 - 6;
  if (placement === "below") centerY = projected.y + projectedOffset + height / 2 + 6;
  else if (placement === "left") {
    centerX = projected.x - projectedOffset - width / 2 - 7;
    centerY = projected.y;
  } else if (placement === "right") {
    centerX = projected.x + projectedOffset + width / 2 + 7;
    centerY = projected.y;
  }
  if (placement === "above" && centerY - height / 2 < 8) centerY = projected.y + projectedOffset + height / 2 + 6;
  if (placement === "below" && centerY + height / 2 > projected.height - 8) centerY = projected.y - projectedOffset - height / 2 - 6;
  centerX = Math.max(width / 2 + 8, Math.min(projected.width - width / 2 - 8, centerX));
  centerY = Math.max(height / 2 + 8, Math.min(projected.height - height / 2 - 8, centerY));
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  context.save();
  context.setTransform(projected.densityX, 0, 0, projected.densityY, 0, 0);
  context.shadowColor = "rgba(34, 48, 74, .18)";
  context.shadowBlur = 10;
  context.fillStyle = "rgba(255, 255, 255, .96)";
  roundedRectPath(context, x, y, width, height, 14);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(224, 92, 63, .68)";
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = "#9f3f2b";
  context.font = "800 14px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, centerX, centerY);
  context.restore();
};

/** Visually separates dragging a real apparatus from using a dedicated value handle. */
export function drawInteractionAffordance(
  context: CanvasRenderingContext2D,
  point: { readonly x: number; readonly y: number } | null,
  affordance: CanvasInteractionAffordance,
): void {
  if (!point) return;
  const projected = screenProjection(context, point);
  if (affordance.kind === "object") {
    const worldRadius = affordance.radius ?? 32;
    const radius = Math.max(26, Math.min(110, worldRadius * projected.scale));
    context.save();
    context.setTransform(projected.densityX, 0, 0, projected.densityY, 0, 0);
    context.strokeStyle = "rgba(224, 92, 63, .92)";
    context.lineWidth = 4;
    context.setLineDash([9, 7]);
    context.shadowColor = "rgba(244, 132, 89, .9)";
    context.shadowBlur = 20;
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    drawInteractionLabel(context, point, "직접 끌기", worldRadius, affordance.labelPlacement);
    return;
  }

  const label = affordance.axis === "x" ? "좌우 조절" : affordance.axis === "y" ? "위아래 조절" : "방향 조절";
  context.save();
  context.setTransform(projected.densityX, 0, 0, projected.densityY, 0, 0);
  context.shadowColor = "rgba(224, 92, 63, .75)";
  context.shadowBlur = 18;
  context.fillStyle = "#e05c3f";
  context.beginPath();
  context.arc(projected.x, projected.y, 22, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, .95)";
  context.fillStyle = "rgba(255, 255, 255, .95)";
  context.lineWidth = 2.5;
  const horizontal = affordance.axis !== "y";
  const vertical = affordance.axis !== "x";
  if (horizontal) {
    context.beginPath(); context.moveTo(projected.x - 11, projected.y); context.lineTo(projected.x + 11, projected.y); context.stroke();
    context.beginPath(); context.moveTo(projected.x - 14, projected.y); context.lineTo(projected.x - 7, projected.y - 5); context.lineTo(projected.x - 7, projected.y + 5); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(projected.x + 14, projected.y); context.lineTo(projected.x + 7, projected.y - 5); context.lineTo(projected.x + 7, projected.y + 5); context.closePath(); context.fill();
  }
  if (vertical) {
    context.beginPath(); context.moveTo(projected.x, projected.y - 11); context.lineTo(projected.x, projected.y + 11); context.stroke();
    context.beginPath(); context.moveTo(projected.x, projected.y - 14); context.lineTo(projected.x - 5, projected.y - 7); context.lineTo(projected.x + 5, projected.y - 7); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(projected.x, projected.y + 14); context.lineTo(projected.x - 5, projected.y + 7); context.lineTo(projected.x + 5, projected.y + 7); context.closePath(); context.fill();
  }
  context.restore();
  drawInteractionLabel(context, point, label, 22, affordance.labelPlacement);
}
