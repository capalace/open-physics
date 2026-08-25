import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const subjectStyles = ["electromagnetism", "waves", "light", "thermal", "modern"]
  .map((subject) => readFileSync(new URL(`./subjects/${subject}/style.css`, import.meta.url), "utf8"))
  .join("\n");

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
