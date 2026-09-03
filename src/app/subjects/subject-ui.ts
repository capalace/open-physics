import type { PhysicsTermDefinition, SubjectDefinition, SubjectLabDefinition } from "./subject-experience";

const subjectChoices = [
  ["mechanics", "역학"],
  ["electromagnetism", "전자기학"],
  ["waves", "파동"],
  ["light", "빛"],
  ["thermal", "열"],
  ["modern", "현대물리"],
] as const;

export function subjectPickerMarkup(activeSubject: SubjectDefinition["id"]): string {
  return `<nav class="subject-picker" aria-label="물리 영역 선택">
    <div>${subjectChoices.map(([id, label]) => {
      const href = id === "mechanics" ? "?view=selection" : `?subject=${id}&amp;view=selection`;
      const current = id === activeSubject ? ' class="is-active" aria-current="page"' : "";
      return `<a href="${href}" data-subject="${id}"${current}>${label}</a>`;
    }).join("")}</div>
  </nav>`;
}

export function subjectSelectionMarkup(definition: SubjectDefinition, browserMarkup: string): string {
  return `<div class="subject-selection-screen" data-subject-selection-screen>
    <div class="subject-selection-intro">
      <span class="eyebrow">${definition.eyebrow}</span>
      <h1>어떤 실험을 해볼까요?</h1>
      <p>실험을 고르면 조작 화면으로 이동합니다. 브라우저 뒤로가기로 이 화면에 돌아올 수 있어요.</p>
    </div>
    ${subjectPickerMarkup(definition.id)}
    ${browserMarkup}
  </div>`;
}

export function subjectSettingsHeaderMarkup(): string {
  return `<div class="subject-settings-header">
    <button class="subject-back-button" type="button" data-subject-back>← 실험 선택</button>
    <div><span class="eyebrow">실험 설정</span><h2 data-subject-settings-title>바꿔 볼 조건</h2></div>
  </div>`;
}

export function subjectCanvasPromptMarkup(): string {
  return `<div class="subject-action-prompt" data-subject-action-prompt role="note">
    <span>바로 해보기</span>
    <strong>주황 표시를 직접 끌어 보세요.</strong>
  </div>`;
}

export interface SubjectPrimaryControlOptions {
  readonly label: string;
  readonly ariaLabel: string;
  readonly ratio: number;
  readonly value: string;
  readonly low: string;
  readonly high: string;
  readonly attribute: `data-${string}`;
  readonly result?: string;
  readonly resultTone?: "neutral" | "success" | "warning";
  readonly presets?: readonly { readonly label: string; readonly ratio: number }[];
}

/** Renders a guided control with a real physical value instead of an arbitrary percentage. */
export function subjectPrimaryControlMarkup(options: SubjectPrimaryControlOptions): string {
  const percent = Math.round(Math.max(0, Math.min(1, options.ratio)) * 100);
  return `<section class="subject-direct-control">
    <span>${escapeHtml(options.label)}</span>
    <output class="subject-direct-control__value" data-subject-control-value>${escapeHtml(options.value)}</output>
    <input type="range" min="0" max="100" step="1" value="${percent}" ${options.attribute} aria-label="${escapeHtml(options.ariaLabel)}" aria-valuetext="${escapeHtml(options.value)}">
    <div><small>${escapeHtml(options.low)}</small><small>${escapeHtml(options.high)}</small></div>
    ${options.presets?.length ? `<div class="subject-control-presets" aria-label="빠른 조건 선택">${options.presets.map((preset) => `<button type="button" data-subject-control-preset="${Math.round(Math.max(0, Math.min(1, preset.ratio)) * 100)}">${escapeHtml(preset.label)}</button>`).join("")}</div>` : ""}
    ${options.result ? `<span class="subject-control-result" data-tone="${options.resultTone ?? "neutral"}"><small>지금 결과</small><strong data-subject-control-result>${escapeHtml(options.result)}</strong></span>` : ""}
  </section>`;
}

export interface SubjectBrowserOptions {
  readonly rootClass: string;
  readonly listClass?: string;
  readonly buttonClass: string;
  readonly sandboxClass?: string;
  readonly choiceAttribute: `data-${string}`;
}

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function termGlossaryMarkup(terms: readonly PhysicsTermDefinition[]): string {
  if (terms.length === 0) return "";
  return `<details class="term-glossary">
    <summary><span>용어 알아보기</span><small>${terms.length}개</small></summary>
    <dl>${terms.map((term) => `<div><dt>${escapeHtml(term.name)}</dt><dd>${escapeHtml(term.description)}</dd></div>`).join("")}</dl>
  </details>`;
}

/** Keeps every guided lab self-explanatory even when its catalog has not supplied a custom glossary yet. */
export function learningTermsFor(lab: SubjectLabDefinition): readonly PhysicsTermDefinition[] {
  if (lab.terms?.length) return lab.terms;
  const controlName = lab.controls[0]?.split(" · ")[0] ?? "실험 조건";
  return [
    { name: lab.law.title, description: lab.law.description },
    { name: controlName, description: "이 실험에서 직접 바꾸며 결과와의 관계를 비교하는 조건이에요." },
    { name: lab.graph.yLabel, description: "조건을 바꾼 뒤 그래프의 세로축에서 비교하는 관찰값이에요." },
  ];
}

/** Builds the single experiment-browser layout shared by every subject. */
export function subjectBrowserMarkup(
  definition: SubjectDefinition,
  options: SubjectBrowserOptions,
): string {
  const buttonClass = `${options.buttonClass} quick-start`;
  const sandboxClass = `${buttonClass}${options.sandboxClass ? ` ${options.sandboxClass}` : ""}`;

  return `
    <section class="subject-browser ${options.rootClass}">
      <div class="section-heading">
        <h2>실험 선택</h2>
        <span>${definition.labs.length + 1}개 선택</span>
      </div>
      <div class="quick-start-list${options.listClass ? ` ${options.listClass}` : ""}">
        <button class="${sandboxClass}" type="button" ${options.choiceAttribute}="sandbox">
          <span class="preset-icon purple">✦</span>
          <span><strong>${escapeHtml(definition.sandboxTitle)}</strong><small>${escapeHtml(definition.sandboxDescription)}</small></span>
        </button>
        ${definition.labs.map((lab) => `
          <button class="${buttonClass}" type="button" ${options.choiceAttribute}="${escapeHtml(lab.id)}">
            <span class="preset-icon blue">${escapeHtml(lab.icon)}</span>
            <span><strong>${escapeHtml(lab.selectionTitle ?? lab.title)}</strong><small>${escapeHtml(lab.selectionDescription ?? lab.question)}</small></span>
          </button>
        `).join("")}
      </div>
    </section>`;
}

/** Builds the same question/steps/observation/law hierarchy used by mechanics. */
export function subjectGuideMarkup(lab: SubjectLabDefinition): string {
  return `
    <section class="subject-guide lab-guide">
      <span class="eyebrow">${escapeHtml(lab.category)}</span>
      <h2>${escapeHtml(lab.title)}</h2>
      <p class="lab-question">${escapeHtml(lab.question)}</p>
      <div class="lab-steps">
        <h3>이렇게 해보세요</h3>
        <ol>${lab.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </div>
      <div class="lab-observation"><strong>눈여겨볼 것</strong><p>${escapeHtml(lab.observe)}</p></div>
      ${termGlossaryMarkup(learningTermsFor(lab))}
      <div class="lab-law">
        <span>연결되는 법칙</span>
        <strong>${escapeHtml(lab.law.title)}</strong>
        <p>${escapeHtml(lab.law.description)}</p>
        <code>${escapeHtml(lab.law.equation)}</code>
      </div>
    </section>`;
}

export function subjectSandboxGuideMarkup(
  definition: SubjectDefinition,
  steps: readonly [string, string, string],
  observation: string,
): string {
  return `
    <section class="subject-guide lab-guide">
      <span class="eyebrow">자유 구성</span>
      <h2>${escapeHtml(definition.sandboxTitle)}</h2>
      <p class="lab-question">${escapeHtml(definition.sandboxDescription)}</p>
      <div class="lab-steps">
        <h3>이렇게 해보세요</h3>
        <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </div>
      <div class="lab-observation"><strong>눈여겨볼 것</strong><p>${escapeHtml(observation)}</p></div>
    </section>`;
}
