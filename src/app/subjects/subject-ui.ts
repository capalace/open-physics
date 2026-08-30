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
    <span>물리 영역</span>
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
  const categories = [...new Set(definition.labs.map((lab) => lab.category))];
  const buttonClass = `${options.buttonClass} quick-start`;
  const sandboxClass = `${buttonClass}${options.sandboxClass ? ` ${options.sandboxClass}` : ""}`;

  return `
    <section class="subject-browser ${options.rootClass}">
      <div class="section-heading">
        <h2>실험 선택</h2>
        <span>${definition.labs.length + 1}개 선택</span>
      </div>
      <div class="quick-start-list${options.listClass ? ` ${options.listClass}` : ""}">
        <span class="topic-label">나만의 실험</span>
        <button class="${sandboxClass}" type="button" ${options.choiceAttribute}="sandbox">
          <span class="preset-icon purple">✦</span>
          <span><strong>${escapeHtml(definition.sandboxTitle)}</strong><small>${escapeHtml(definition.sandboxDescription)}</small></span>
        </button>
        ${categories.map((category) => `
          <span class="topic-label">${escapeHtml(category)}</span>
          ${definition.labs.filter((lab) => lab.category === category).map((lab) => `
            <button class="${buttonClass}" type="button" ${options.choiceAttribute}="${escapeHtml(lab.id)}">
              <span class="preset-icon blue">${escapeHtml(lab.icon)}</span>
              <span><strong>${escapeHtml(lab.selectionTitle ?? lab.title)}</strong><small>${escapeHtml(lab.selectionDescription ?? lab.question)}</small></span>
            </button>
          `).join("")}
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
