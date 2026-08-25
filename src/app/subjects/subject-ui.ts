import type { SubjectDefinition, SubjectLabDefinition } from "./subject-experience";

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
              <span><strong>${escapeHtml(lab.title)}</strong><small>${escapeHtml(lab.question)}</small></span>
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
