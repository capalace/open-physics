import type { PlaygroundGraph } from "./physics-playground";

const GRAPH_PADDING = { top: 14, right: 12, bottom: 28, left: 42 };

export function renderLabGraph(canvas: HTMLCanvasElement, graph: PlaygroundGraph): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(220, Math.round(rect.width || 270));
  const height = Math.max(130, Math.round(rect.height || 150));
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const plotLeft = GRAPH_PADDING.left;
  const plotTop = GRAPH_PADDING.top;
  const plotWidth = width - GRAPH_PADDING.left - GRAPH_PADDING.right;
  const plotHeight = height - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
  const values = graph.samples.flatMap((sample) => sample.values).filter(Number.isFinite);
  const hasNegativeValue = values.some((value) => value < 0);
  let minimum = hasNegativeValue ? Math.min(...values) : 0;
  let maximum = Math.max(0, ...values);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    minimum = 0;
    maximum = 1;
  }
  if (maximum - minimum < 0.001) maximum = minimum + 1;
  const padding = (maximum - minimum) * 0.08;
  if (hasNegativeValue) minimum -= padding;
  maximum += padding;
  const firstTime = graph.samples[0]?.time ?? 0;
  const lastTime = Math.max(firstTime + 1, graph.samples.at(-1)?.time ?? 1);
  const pointX = (time: number) => plotLeft + (time - firstTime) / (lastTime - firstTime) * plotWidth;
  const pointY = (value: number) => plotTop + (maximum - value) / (maximum - minimum) * plotHeight;

  context.save();
  context.font = "600 12px Inter, system-ui, sans-serif";
  context.fillStyle = "#7d899b";
  context.strokeStyle = "#e2e8f1";
  context.lineWidth = 1;
  for (let line = 0; line <= 2; line += 1) {
    const y = plotTop + plotHeight * line / 2;
    const value = maximum - (maximum - minimum) * line / 2;
    context.beginPath();
    context.moveTo(plotLeft, y);
    context.lineTo(plotLeft + plotWidth, y);
    context.stroke();
    context.textAlign = "right";
    context.fillText(formatGraphValue(value), plotLeft - 7, y + 4);
  }
  context.fillText(`${formatGraphValue(firstTime)}초`, plotLeft + 22, height - 7);
  context.textAlign = "right";
  context.fillText(`${formatGraphValue(lastTime)}초`, width - GRAPH_PADDING.right, height - 7);

  graph.series.forEach((series, seriesIndex) => {
    const points = graph.samples
      .map((sample) => ({ time: sample.time, value: sample.values[seriesIndex] }))
      .filter((point) => Number.isFinite(point.value));
    if (points.length === 0) return;
    context.strokeStyle = series.color;
    context.fillStyle = series.color;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    points.forEach((point, index) => {
      const x = pointX(point.time);
      const y = pointY(point.value);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
    const latest = points.at(-1)!;
    context.beginPath();
    context.arc(pointX(latest.time), pointY(latest.value), 3.5, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

export function formatGraphValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(1);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
