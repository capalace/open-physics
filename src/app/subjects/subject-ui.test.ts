import { describe, expect, it } from "vitest";
import { wavesDefinition } from "./waves/catalog";
import { subjectBrowserMarkup, subjectGuideMarkup, subjectSandboxGuideMarkup } from "./subject-ui";

describe("shared subject UI", () => {
  it("renders every experiment browser in the mechanics order and class contract", () => {
    const markup = subjectBrowserMarkup(wavesDefinition, {
      rootClass: "waves-browser",
      buttonClass: "waves-lab",
      choiceAttribute: "data-lab-id",
    });

    expect(markup).toContain('class="subject-browser waves-browser"');
    expect(markup).toContain(`${wavesDefinition.labs.length + 1}개 선택`);
    expect(markup).toContain('class="waves-lab quick-start"');
    expect(markup).toContain('class="preset-icon purple"');
    expect(markup).toContain('class="preset-icon blue"');
    expect(markup.indexOf('data-lab-id="sandbox"')).toBeLessThan(markup.indexOf('data-lab-id="source"'));
    expect(markup).toContain('<span class="topic-label">파동의 시작</span>');
  });

  it("renders guided and sandbox instructions with the mechanics hierarchy", () => {
    const guided = subjectGuideMarkup(wavesDefinition.labs[0]);
    const sandbox = subjectSandboxGuideMarkup(
      wavesDefinition,
      ["장치를 하나 추가해요.", "장치를 원하는 곳으로 옮겨요.", "관찰값의 변화를 비교해요."],
      "장치와 파형이 같은 조건을 나타내는지 보세요.",
    );

    for (const markup of [guided, sandbox]) {
      expect(markup).toContain('class="subject-guide lab-guide"');
      expect(markup).toContain('class="lab-question"');
      expect(markup).toContain('class="lab-steps"');
      expect(markup).toContain('class="lab-observation"');
    }
    expect(guided).toContain('class="lab-law"');
    expect(sandbox).not.toContain('class="lab-law"');
  });
});
