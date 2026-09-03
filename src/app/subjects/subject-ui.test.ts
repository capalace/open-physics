import { describe, expect, it } from "vitest";
import { wavesDefinition } from "./waves/catalog";
import { learningTermsFor, subjectBrowserMarkup, subjectCanvasPromptMarkup, subjectGuideMarkup, subjectPickerMarkup, subjectPrimaryControlMarkup, subjectSandboxGuideMarkup, termGlossaryMarkup } from "./subject-ui";

describe("shared subject UI", () => {
  it("keeps subject navigation inside the experiment selection screen", () => {
    const markup = subjectPickerMarkup("waves");
    expect(markup.match(/data-subject=/g)).toHaveLength(6);
    expect(markup).toContain('href="?view=selection" data-subject="mechanics"');
    expect(markup).toContain('href="?subject=light&amp;view=selection"');
    expect(markup).toContain('data-subject="waves" class="is-active" aria-current="page"');
    expect(markup).toContain('aria-label="물리 영역 선택"');
    expect(markup).not.toContain("<span>물리 영역</span>");
  });

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
    expect(markup).not.toContain('class="topic-label"');
    expect(markup).not.toContain("파동의 시작");
  });

  it("uses concise browser copy without shortening the dedicated guide", () => {
    const definition = {
      ...wavesDefinition,
      labs: wavesDefinition.labs.map((lab, index) => index === 0
        ? { ...lab, selectionTitle: "짧은 이름", selectionDescription: "짧은 질문" }
        : lab),
    };
    const markup = subjectBrowserMarkup(definition, {
      rootClass: "waves-browser",
      buttonClass: "waves-lab",
      choiceAttribute: "data-lab-id",
    });
    expect(markup).toContain("<strong>짧은 이름</strong><small>짧은 질문</small>");
    expect(subjectGuideMarkup(definition.labs[0])).toContain(definition.labs[0].title);
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

  it("puts the first direct action beside the Canvas", () => {
    const markup = subjectCanvasPromptMarkup();
    expect(markup).toContain("바로 해보기");
    expect(markup).toContain("주황 표시를 직접 끌어 보세요");
    expect(markup).toContain('role="note"');
  });

  it("renders a compact, accessible glossary for the active experiment", () => {
    const markup = termGlossaryMarkup([
      { name: "전압", description: "전하를 움직이게 하는 전기적인 차이예요." },
      { name: "전류", description: "전하가 한쪽 방향으로 흐르는 양이에요." },
    ]);
    expect(markup).toContain('class="term-glossary"');
    expect(markup).toContain("<summary><span>용어 알아보기</span><small>2개</small></summary>");
    expect(markup).toContain("<dt>전압</dt><dd>전하를 움직이게 하는 전기적인 차이예요.</dd>");
    expect(termGlossaryMarkup([])).toBe("");
  });

  it("derives three useful terms for a legacy guided catalog without a custom glossary", () => {
    const source = wavesDefinition.labs.find((item) => item.id === "resonance")!;
    const lab = { ...source, terms: undefined };
    const terms = learningTermsFor(lab);
    expect(terms).toHaveLength(3);
    expect(terms.map((term) => term.name)).toEqual([lab.law.title, "구동 주파수", lab.graph.yLabel]);
    expect(subjectGuideMarkup(lab)).toContain("용어 알아보기");
  });

  it("shows a real physical value, quick conditions, and the immediate result", () => {
    const markup = subjectPrimaryControlMarkup({
      label: "구동 주파수", ariaLabel: "구동 주파수 (Hz)", ratio: .5, value: "5.0 Hz",
      low: "느리게", high: "빠르게", attribute: "data-test-range",
      presets: [{ label: "3 Hz", ratio: .25 }, { label: "공명 5 Hz", ratio: .5 }, { label: "7 Hz", ratio: .75 }],
      result: "공명! 진폭 8.3배", resultTone: "success",
    });
    expect(markup).toContain("5.0 Hz");
    expect(markup).toContain('aria-valuetext="5.0 Hz"');
    expect(markup).toContain('data-subject-control-preset="50"');
    expect(markup).toContain("공명! 진폭 8.3배");
    expect(markup).not.toContain(">50%</output>");
  });
});
