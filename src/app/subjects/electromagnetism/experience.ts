import type { Vector2 } from "../../../physics/core";
import type { SubjectController, SubjectExperience, SubjectHosts } from "../subject-experience";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup } from "../subject-ui";
import {
  ELECTROMAGNETISM_SUBJECT,
  electromagnetismLab,
  type ElectromagnetismLabId,
} from "./catalog";
import {
  ElectromagnetismModel,
  type ElectromagnetismSandboxKind,
  type ElectromagnetismSnapshot,
} from "./models";
import { ElectromagnetismRenderer } from "./renderer";
import "./style.css";

const sandboxKinds: readonly [ElectromagnetismSandboxKind, string, string][] = [
  ["charge", "⊕", "전하"],
  ["battery", "▯", "전지"],
  ["resistor", "▰", "저항"],
  ["magnet", "N", "자석"],
  ["coil", "⌁", "코일"],
  ["probe", "✦", "탐침"],
];

type ElectromagnetismLegendKind = "field" | "force" | "velocity" | "voltage" | "potential" | "current" | "connection" | "flux";
export interface ElectromagnetismLegendItem { readonly kind: ElectromagnetismLegendKind; readonly label: string }

export function electromagnetismLegend(mode: ElectromagnetismLabId | "sandbox"): readonly ElectromagnetismLegendItem[] {
  switch (mode) {
    case "sandbox": return [
      { kind: "field", label: "작은 화살표 = 전기장" },
      { kind: "connection", label: "점선 = 자동 연결" },
    ];
    case "charge": return [{ kind: "force", label: "화살표 = 전기력" }];
    case "electric-field": return [{ kind: "field", label: "작은 화살표 = 전기장" }];
    case "potential": return [{ kind: "potential", label: "보라색 선 = 전위가 같은 곳" }];
    case "circuits": return [{ kind: "current", label: "움직이는 점 = 전류" }];
    case "capacitors": return [{ kind: "field", label: "판 사이 화살표 = 전기장" }];
    case "magnetic-field": return [{ kind: "field", label: "원형 화살표 = 자기장" }];
    case "electromagnetic-force": return [
      { kind: "velocity", label: "보라 화살표 = 속도" },
      { kind: "force", label: "주황 화살표 = 자기력" },
    ];
    case "induction": return [
      { kind: "flux", label: "파란 점선 = 자석의 자기장" },
      { kind: "voltage", label: "화살표 = 유도 전압" },
    ];
  }
}

class ElectromagnetismController implements SubjectController {
  private readonly previousHtml: [string, string, string];
  private readonly model = new ElectromagnetismModel("sandbox");
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: ElectromagnetismRenderer;
  private frame = 0;
  private previousFrameTime = 0;
  private visualTime = 0;
  private dragging = false;
  private draggedSandboxId: string | null = null;
  private selectedSandboxId: string | null = null;
  private previousPointerTime = 0;
  private activeMode: ElectromagnetismLabId | "sandbox" = "sandbox";
  private readonly eventScope = new AbortController();

  constructor(private readonly hosts: SubjectHosts) {
    this.previousHtml = [hosts.experimentPanel.innerHTML, hosts.workspace.innerHTML, hosts.inspectorPanel.innerHTML];
    hosts.experimentPanel.classList.add("subject-electromagnetism");
    hosts.workspace.classList.add("subject-electromagnetism");
    hosts.inspectorPanel.classList.add("subject-electromagnetism");
    this.renderShell();
    this.canvas = this.require<HTMLCanvasElement>(hosts.workspace, "[data-em-canvas]");
    this.renderer = new ElectromagnetismRenderer(this.canvas);
    this.bindEvents();
    this.activate("sandbox");
    window.addEventListener("resize", this.resize);
    this.frame = requestAnimationFrame(this.animate);
  }

  resize = (): void => {
    this.renderer.resize();
    this.render();
  };

  unmount(): void {
    cancelAnimationFrame(this.frame);
    this.eventScope.abort();
    window.removeEventListener("resize", this.resize);
    this.hosts.experimentPanel.innerHTML = this.previousHtml[0];
    this.hosts.workspace.innerHTML = this.previousHtml[1];
    this.hosts.inspectorPanel.innerHTML = this.previousHtml[2];
    this.hosts.experimentPanel.classList.remove("subject-electromagnetism");
    this.hosts.workspace.classList.remove("subject-electromagnetism");
    this.hosts.inspectorPanel.classList.remove("subject-electromagnetism");
  }

  private renderShell(): void {
    this.hosts.experimentPanel.innerHTML = subjectBrowserMarkup(ELECTROMAGNETISM_SUBJECT, {
      rootClass: "em-browser",
      buttonClass: "em-lab-button",
      sandboxClass: "em-sandbox-button",
      choiceAttribute: "data-em-mode",
    });
    this.hosts.workspace.innerHTML = `
      <div class="em-toolbar world-toolbar">
        <div class="em-transport transport-controls">
          <button class="primary-button" type="button" data-em-action="play">▶ 실행</button>
          <button class="icon-button text-button" type="button" data-em-action="step">한 단계</button>
          <button class="icon-button text-button" type="button" data-em-action="reset">↻ 처음으로</button>
        </div>
        <div class="em-palette creation-controls" data-em-sandbox-tools hidden>
          ${sandboxKinds.map(([kind, icon, label]) => `<button type="button" data-em-add="${kind}"><b>${icon}</b>${label}</button>`).join("")}
          <button type="button" data-em-action="delete">삭제</button>
        </div>
        <span class="em-run-state" data-em-run-state>멈춤</span>
      </div>
      <div class="em-canvas-frame"><canvas data-em-canvas width="960" height="600" aria-label="전자기학 2D 실험 공간"></canvas><div class="canvas-legend em-canvas-legend" data-em-canvas-legend></div></div>`;
    this.hosts.inspectorPanel.innerHTML = `
      <section class="em-guide" data-em-guide></section>
      <section class="em-readout">
        <h3>지금 관찰값</h3>
        <div><span data-em-measure-label></span><output data-em-measure-value></output></div>
        <div data-em-secondary-row><span data-em-secondary-label></span><output data-em-secondary-value></output></div>
      </section>
      <section class="em-controls" data-em-controls></section>
      <section class="em-graph">
        <div><span>실험 그래프</span><strong data-em-graph-title></strong></div>
        <span class="em-graph-legend" data-em-graph-legend></span>
        <canvas data-em-graph-canvas width="280" height="160"></canvas>
        <p><span data-em-graph-x></span><span data-em-graph-y></span></p>
      </section>`;
  }

  private bindEvents(): void {
    this.hosts.experimentPanel.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-em-mode]");
      if (button) this.activate(button.dataset.emMode as ElectromagnetismLabId | "sandbox");
    }, { signal: this.eventScope.signal });
    this.hosts.workspace.addEventListener("click", (event) => {
      const addButton = (event.target as Element).closest<HTMLButtonElement>("[data-em-add]");
      if (addButton && this.activeMode === "sandbox") {
        const object = this.model.addSandboxObject(addButton.dataset.emAdd as ElectromagnetismSandboxKind);
        this.selectedSandboxId = object.id;
        this.render();
        return;
      }
      const action = (event.target as Element).closest<HTMLButtonElement>("[data-em-action]")?.dataset.emAction;
      if (action === "play") this.model.toggle();
      else if (action === "step") { this.model.setRunning(true); this.model.step(1 / 60); this.model.setRunning(false); }
      else if (action === "reset") { this.model.reset(); this.selectedSandboxId = null; }
      else if (action === "delete" && this.selectedSandboxId) {
        this.model.removeSandboxObject(this.selectedSandboxId); this.selectedSandboxId = null;
      }
      this.render();
    }, { signal: this.eventScope.signal });
    this.hosts.inspectorPanel.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-em-control]");
      if (!button) return;
      const control = button.dataset.emControl;
      if (control === "level") this.model.setLevel(Number(button.dataset.value));
      else if (control === "sign") this.model.toggleSign();
      else if (control === "direction") this.model.toggleDirection();
      else if (control === "turns") this.model.setCoilTurns(Number(button.dataset.value));
      this.render();
    }, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.canvas.setPointerCapture(event.pointerId);
      const point = this.pointer(event);
      this.previousPointerTime = event.timeStamp;
      if (this.activeMode === "sandbox") {
        const object = this.model.hitSandboxObject(point);
        this.draggedSandboxId = object?.id ?? null;
        this.selectedSandboxId = object?.id ?? null;
      } else {
        this.model.drag(point, 0);
      }
      this.render();
    }, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const point = this.pointer(event);
      const dt = Math.max(1 / 240, (event.timeStamp - this.previousPointerTime) / 1000);
      this.previousPointerTime = event.timeStamp;
      if (this.activeMode === "sandbox" && this.draggedSandboxId) this.model.moveSandboxObject(this.draggedSandboxId, point, dt);
      else if (this.activeMode !== "sandbox") this.model.drag(point, dt);
      this.render();
    }, { signal: this.eventScope.signal });
    const endDrag = () => {
      this.dragging = false;
      this.draggedSandboxId = null;
      if (this.activeMode === "electromagnetic-force" || this.activeMode === "induction") this.model.setRunning(true);
      this.render();
    };
    this.canvas.addEventListener("pointerup", endDrag, { signal: this.eventScope.signal });
    this.canvas.addEventListener("pointercancel", endDrag, { signal: this.eventScope.signal });
  }

  private activate(mode: ElectromagnetismLabId | "sandbox"): void {
    this.activeMode = mode;
    this.model.activate(mode);
    this.selectedSandboxId = null;
    this.hosts.experimentPanel.querySelectorAll<HTMLElement>("[data-em-mode]").forEach((button) => {
      const active = button.dataset.emMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.require<HTMLElement>(this.hosts.workspace, ".em-toolbar").classList.toggle("is-sandbox", mode === "sandbox");
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-sandbox-tools]").hidden = mode !== "sandbox";
    this.renderCanvasLegend();
    this.renderGuide();
    this.renderControls();
    this.render();
  }

  private renderCanvasLegend(): void {
    const legend = this.require<HTMLElement>(this.hosts.workspace, "[data-em-canvas-legend]");
    const items = electromagnetismLegend(this.activeMode);
    legend.setAttribute("aria-label", items.map((item) => item.label).join(", "));
    legend.innerHTML = items.map((item) => `<span><i class="em-legend-mark em-legend-mark--${item.kind}" aria-hidden="true"></i>${item.label}</span>`).join("");
  }

  private renderGuide(): void {
    const guide = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-guide]");
    if (this.activeMode === "sandbox") {
      guide.innerHTML = subjectSandboxGuideMarkup(
        ELECTROMAGNETISM_SUBJECT,
        ["위 팔레트에서 장치를 추가해요.", "Canvas에서 장치를 잡아 옮겨요.", "탐침과 그래프로 변화를 비교해요."],
        "장치를 옮길 때 전기장·자기장과 측정값이 함께 달라지는지 보세요.",
      );
      return;
    }
    const lab = electromagnetismLab(this.activeMode);
    guide.innerHTML = subjectGuideMarkup(lab);
  }

  private renderControls(): void {
    const controls = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-controls]");
    if (this.activeMode === "sandbox") {
      controls.innerHTML = `<h3>빈 실험실 조작</h3><p>장치를 눌러 선택하고 끌어서 옮기세요. 선택한 장치는 위의 삭제 버튼으로 지울 수 있어요.</p>`;
      return;
    }
    const lab = electromagnetismLab(this.activeMode);
    const needsSign = lab.controls.some((control) => control.includes("sign") || control === "source-charge" || control === "test-charge");
    const needsDirection = lab.controls.some((control) => control.includes("direction") || control === "current");
    const needsTurns = lab.controls.includes("coil-turns");
    const levelLabels: Partial<Record<ElectromagnetismLabId, string>> = {
      charge: "전하량", "electric-field": "원천 전하량", potential: "시험 전하량",
      circuits: "전압", capacitors: "전압", "magnetic-field": "전류",
    };
    const levelLabel = levelLabels[this.activeMode];
    controls.innerHTML = `
      <h3>바꿔 볼 조건</h3>
      ${levelLabel ? `<div class="em-choice"><span>${levelLabel}</span><button data-em-control="level" data-value="0.5">약하게</button><button data-em-control="level" data-value="1">보통</button><button data-em-control="level" data-value="1.5">강하게</button></div>` : ""}
      ${needsSign ? `<button class="em-wide-control" data-em-control="sign">전하 부호 뒤집기 (+/−)</button>` : ""}
      ${needsDirection ? `<button class="em-wide-control" data-em-control="direction">전류·자기장 방향 뒤집기</button>` : ""}
      ${needsTurns ? `<div class="em-choice"><span>코일 감은 수</span><button data-em-control="turns" data-value="40">40회</button><button data-em-control="turns" data-value="80">80회</button><button data-em-control="turns" data-value="140">140회</button></div>` : ""}`;
  }

  private render(): void {
    const snapshot = this.model.snapshot();
    this.renderer.render(snapshot, this.visualTime);
    const play = this.require<HTMLButtonElement>(this.hosts.workspace, '[data-em-action="play"]');
    play.textContent = snapshot.running ? "Ⅱ 일시정지" : "▶ 실행";
    this.require<HTMLElement>(this.hosts.workspace, "[data-em-run-state]").textContent = snapshot.running ? "실행 중" : "멈춤";
    this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-measure-label]").textContent = snapshot.measurement.label;
    this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-measure-value]").textContent = `${this.format(snapshot.measurement.value)} ${snapshot.measurement.unit}`;
    const secondaryRow = this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-secondary-row]");
    secondaryRow.hidden = !snapshot.secondaryMeasurement;
    if (snapshot.secondaryMeasurement) {
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-secondary-label]").textContent = snapshot.secondaryMeasurement.label;
      this.require<HTMLOutputElement>(this.hosts.inspectorPanel, "[data-em-secondary-value]").textContent = `${this.format(snapshot.secondaryMeasurement.value)} ${snapshot.secondaryMeasurement.unit}`;
    }
    if (snapshot.mode === "sandbox") {
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-title]").textContent = snapshot.sandboxGraph.title;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-x]").textContent = `가로축 · ${snapshot.sandboxGraph.xLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-y]").textContent = `세로축 · ${snapshot.sandboxGraph.yLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").textContent = "● 현재 구성";
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").style.color = snapshot.sandboxGraph.color;
    } else {
      const lab = electromagnetismLab(snapshot.mode);
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-title]").textContent = lab.graph.title;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-x]").textContent = `가로축 · ${lab.graph.xLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-y]").textContent = `세로축 · ${lab.graph.yLabel}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").textContent = `● ${lab.graph.series[0].label}`;
      this.require<HTMLElement>(this.hosts.inspectorPanel, "[data-em-graph-legend]").style.color = lab.graph.series[0].color;
    }
    this.renderGraph(snapshot);
  }

  private renderGraph(snapshot: ElectromagnetismSnapshot): void {
    const canvas = this.require<HTMLCanvasElement>(this.hosts.inspectorPanel, "[data-em-graph-canvas]");
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const width = canvas.width; const height = canvas.height; const pad = { l: 44, r: 12, t: 14, b: 30 };
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    const finite = snapshot.graph.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (finite.length === 0) return;
    const marker = snapshot.graphMarker && Number.isFinite(snapshot.graphMarker.x) && Number.isFinite(snapshot.graphMarker.y) ? snapshot.graphMarker : null;
    const minX = Math.min(...finite.map((point) => point.x), marker?.x ?? Infinity); const maxX = Math.max(...finite.map((point) => point.x), marker?.x ?? -Infinity);
    let minY = Math.min(0, ...finite.map((point) => point.y), marker?.y ?? Infinity); let maxY = Math.max(0, ...finite.map((point) => point.y), marker?.y ?? -Infinity);
    if (maxY - minY < 1e-9) maxY = minY + 1;
    const px = (x: number) => pad.l + (x - minX) / Math.max(1e-9, maxX - minX) * (width - pad.l - pad.r);
    const py = (y: number) => pad.t + (maxY - y) / (maxY - minY) * (height - pad.t - pad.b);
    ctx.strokeStyle = "#e2e8f1"; ctx.lineWidth = 1;
    for (let line = 0; line <= 2; line += 1) { const y = pad.t + (height - pad.t - pad.b) * line / 2; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); }
    const color = snapshot.mode === "sandbox" ? snapshot.sandboxGraph.color : electromagnetismLab(snapshot.mode).graph.series[0].color;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); finite.forEach((point, index) => { if (index === 0) ctx.moveTo(px(point.x), py(point.y)); else ctx.lineTo(px(point.x), py(point.y)); }); ctx.stroke();
    if (marker) { ctx.fillStyle = "#fff"; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px(marker.x), py(marker.y), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = "#718096"; ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText(this.format(minX), pad.l, height - 8); ctx.textAlign = "right"; ctx.fillText(this.format(maxX), width - pad.r, height - 8);
    ctx.textAlign = "right"; ctx.fillText(this.format(maxY), pad.l - 5, pad.t + 4); ctx.fillText(this.format(minY), pad.l - 5, height - pad.b);
  }

  private pointer(event: PointerEvent): Vector2 {
    return this.renderer.pointerToModel(event.clientX, event.clientY);
  }

  private animate = (time: number): void => {
    this.visualTime = time / 1000;
    const dt = this.previousFrameTime === 0 ? 1 / 60 : Math.min(1 / 30, (time - this.previousFrameTime) / 1000);
    this.previousFrameTime = time;
    const wasRunning = this.model.snapshot().running;
    this.model.step(dt);
    if (wasRunning) this.render();
    else this.renderer.render(this.model.snapshot(), this.visualTime);
    this.frame = requestAnimationFrame(this.animate);
  };

  private require<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`${selector} not found in electromagnetism experience`);
    return element;
  }

  private format(value: number): string {
    const absolute = Math.abs(value);
    if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) return value.toExponential(2);
    if (absolute >= 100) return value.toFixed(0);
    if (absolute >= 10) return value.toFixed(1);
    return value.toFixed(2).replace(/\.00$/, "");
  }
}

export const electromagnetismExperience: SubjectExperience = {
  definition: ELECTROMAGNETISM_SUBJECT,
  mount: (hosts) => new ElectromagnetismController(hosts),
};
