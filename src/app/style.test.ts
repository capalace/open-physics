import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const subjectStyles = ["electromagnetism", "waves", "light", "thermal", "modern"]
  .map((subject) => readFileSync(new URL(`./subjects/${subject}/style.css`, import.meta.url), "utf8"))
  .join("\n");
const subjectShellStyles = readFileSync(new URL("./subjects/style.css", import.meta.url), "utf8");
const lightStyles = readFileSync(new URL("./subjects/light/style.css", import.meta.url), "utf8");
const thermalStyles = readFileSync(new URL("./subjects/thermal/style.css", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const lightExperience = readFileSync(new URL("./subjects/light/experience.ts", import.meta.url), "utf8");
const subjectUi = readFileSync(new URL("./subjects/subject-ui.ts", import.meta.url), "utf8");
const subjectExperienceSources = [
  "electromagnetism/experience.ts",
  "waves/experience.ts",
  "light/experience.ts",
  "thermal/experience.ts",
  "modern/experience.ts",
].map((path) => readFileSync(new URL(`./subjects/${path}`, import.meta.url), "utf8"));
const thermalExperience = subjectExperienceSources[3];

describe("playground typography", () => {
  it("keeps every interface label at least 12px tall", () => {
    const fontSizes = [...`${styles}\n${subjectStyles}`.matchAll(/font-size:\s*([0-9.]+)px/g)]
      .map((match) => Number(match[1]));

    expect(fontSizes.length).toBeGreaterThan(0);
    expect(fontSizes.filter((size) => size < 12)).toEqual([]);
  });
});

describe("mechanics lab content", () => {
  it("offers ten distinct labs and one empty lab in the same one-column selector", () => {
    const labs = [...markup.matchAll(/data-lab="([^"]+)"/g)].map((match) => match[1]);
    const choices = [...markup.matchAll(/class="quick-start(?: [^"]*)?"/g)];

    expect(labs).toHaveLength(10);
    expect(new Set(labs).size).toBe(10);
    expect(choices).toHaveLength(11);
    expect(labs).not.toEqual(expect.arrayContaining(["momentum", "energy", "circular", "pendulum"]));
    expect(markup).toContain("data-start-sandbox");
    expect(markup).toContain("빈 실험실 만들기");
    expect(markup).not.toMatch(/<button[^>]+data-app-mode=/);
    expect(markup).not.toContain("mode-switch");
    expect(markup).toContain('id="lab-guide"');
    expect(markup).not.toContain('id="new-sandbox"');
    expect(styles).toMatch(/\.quick-start-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  });
});

describe("sandbox object palette", () => {
  it("offers distinct moving and fixed primitives", () => {
    const objectKinds = [...markup.matchAll(/data-object-kind="([^"]+)"/g)]
      .map((match) => match[1]);

    expect(objectKinds).toEqual(["ball", "box", "block", "anchor"]);
  });

  it("offers reusable mechanics apparatus in the sandbox", () => {
    const apparatusKinds = [...markup.matchAll(/data-apparatus-kind="([^"]+)"/g)]
      .map((match) => match[1]);

    expect(apparatusKinds).toEqual(["spring", "lever", "pulley"]);
    expect(markup).toContain('data-connection-kind="rope"');
    expect(markup).toContain('data-connection-kind="rod"');
    expect(markup).toContain('data-force-tool="constant"');
    expect(markup).toContain('data-environment-kind="gravity-source"');
    expect(markup).toContain('data-environment-kind="water"');
  });

  it("uses direct manipulation instead of size presets", () => {
    const sizes = [...markup.matchAll(/data-size="([^"]+)"/g)].map((match) => match[1]);

    expect(sizes).toEqual([]);
    expect(markup).toContain('id="block-resize-help"');
    expect(markup).toContain('id="block-angle"');
    expect(markup).toContain("위쪽 ↻ 손잡이");
  });
});

describe("mechanics lab graph", () => {
  it("reserves one accessible chart in the lab guide", () => {
    expect(markup).toContain('id="lab-graph"');
    expect(markup).toContain('id="lab-graph-canvas"');
    expect(markup).toContain('aria-label="실험 결과 그래프"');
  });
});

describe("subject visual shell", () => {
  it("keeps the initial lab blank until the selected subject is mounted", () => {
    expect(markup).toContain('data-app-ready="false"');
    expect(markup).not.toMatch(/class="is-active"[^>]+data-subject/);
    expect(markup).toContain('<link rel="stylesheet" href="/src/app/subjects/style.css" />');
    expect(styles).toMatch(/body\[data-app-ready="false"\]\s+\.app-layout\s*\{[^}]*visibility:\s*hidden/s);
    expect(bootstrap).toContain('document.body.dataset.appReady = "true"');
  });

  it("uses the mechanics surface contract for every subject selector and toolbar", () => {
    expect(subjectShellStyles).toContain("--subject-card-background: #fafbfd;");
    expect(subjectShellStyles).toContain("--subject-toolbar-background: #ffffff;");
    expect(subjectShellStyles.match(/--subject-accent:/g)).toHaveLength(1);
    expect(subjectUi).toContain('class="subject-browser ${options.rootClass}"');
    expect(subjectUi).toContain("quick-start-list");
    expect(subjectUi).toContain("preset-icon");

    for (const source of subjectExperienceSources) {
      expect(source).toContain("subjectBrowserMarkup");
      expect(source).toContain("world-toolbar");
    }

    for (const selector of [
      ".em-lab-button",
      ".waves-experience__lab",
      ".light-experience__list button",
      ".thermal-lab-list button",
      ".modern-experience__lab",
    ]) expect(subjectShellStyles).toContain(selector);

    for (const toolbar of [
      ".em-toolbar",
      ".waves-experience__toolbar",
      ".light-experience__toolbar",
      ".thermal-toolbar",
      ".modern-experience__toolbar",
    ]) expect(subjectShellStyles).toContain(toolbar);
  });

  it("gives the light lab the same visible workspace toolbar contract", () => {
    expect(lightExperience).toContain('class="light-experience__toolbar world-toolbar"');
    expect(lightExperience).toContain("data-light-toolbar-reset");
  });

  it("keeps subject content on the same panel coordinates as mechanics", () => {
    expect(styles).toMatch(/@media \(min-width: 1021px\)[\s\S]*body\s*\{[^}]*overflow:\s*hidden/);
    expect(styles).toMatch(/@media \(min-width: 701px\) and \(max-width: 1020px\)[\s\S]*grid-template-rows:\s*max\(520px, calc\(100dvh - 125px\)\)/);
    expect(subjectShellStyles).toMatch(/\.subject-browser \.quick-start-list\s*\{[^}]*gap:\s*6px/s);
    expect(subjectShellStyles).toMatch(/\.em-guide\s*\{[^}]*padding:\s*0/s);
    expect(subjectShellStyles).toMatch(/\.waves-experience__inspector article[^}]*padding:\s*0 0 24px/s);
    expect(subjectShellStyles).toMatch(/\.light-experience__inspector\s*\{[^}]*padding:\s*24px 20px/s);
    expect(thermalExperience).toContain("shell.clientWidth");
    expect(thermalExperience).toContain("shell.clientHeight - toolbar.offsetHeight");
  });

  it("keeps experiment card copy left-aligned in every subject", () => {
    expect(styles).toMatch(/\.quick-start > span:last-child\s*\{[^}]*text-align:\s*left/s);
    expect(subjectShellStyles).toMatch(/\.subject-browser \.quick-start > span:last-child\s*\{[^}]*text-align:\s*left/s);
    expect(lightStyles).not.toContain(".light-experience__list button > span");
    expect(lightStyles).toContain(".light-experience__list .preset-icon");
    expect(thermalStyles).not.toContain(".thermal-lab-list button span");
    expect(thermalStyles).toContain(".thermal-lab-list .preset-icon");
  });
});
