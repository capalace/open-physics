import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const mechanicsEntry = readFileSync(new URL("./mechanics-main.ts", import.meta.url), "utf8");
const subjectEntries = Object.fromEntries(
  ["electromagnetism", "waves", "light", "thermal", "modern"].map((subject) => [
    subject,
    readFileSync(new URL(`./subjects/${subject}/experience.ts`, import.meta.url), "utf8"),
  ]),
);

describe("physics subject shell", () => {
  it("offers every subject at the same navigation level", () => {
    const subjectIds = [...markup.matchAll(/data-subject="([^"]+)"/g)].map((match) => match[1]);

    expect(subjectIds).toEqual([
      "mechanics",
      "electromagnetism",
      "waves",
      "light",
      "thermal",
      "modern",
    ]);
    expect(markup).not.toMatch(/data-subject="[^"]+"[^>]*disabled/);
  });

  it("loads a deep subject module for every non-mechanics navigation item", () => {
    for (const subject of ["electromagnetism", "waves", "light", "thermal", "modern"]) {
      expect(bootstrap).toContain(`subject === "${subject}"`);
      expect(bootstrap).toContain(`./subjects/${subject}`);
    }
    expect(bootstrap).toContain('await import("./mechanics-main")');
  });

  it("keeps navigation recoverable across home and browser history", () => {
    expect(markup).toContain('class="brand" href="./"');
    expect(bootstrap).toContain("if (event.persisted) return");
  });

  it("switches to the narrower layout before the three columns overflow", () => {
    expect(styles).toContain("@media (max-width: 1020px)");
    expect(styles).toContain("@media (min-width: 1021px) and (min-height: 700px)");
    expect(styles).toContain('body:not([data-subject="mechanics"]) .inspector-panel { display: block; }');
  });

  it("opens every subject on its empty laboratory", () => {
    expect(mechanicsEntry).toContain('activateSandbox();');
    expect(mechanicsEntry).not.toContain('activateLab("free-fall", "initial");');
    expect(subjectEntries.electromagnetism).toContain('this.activate("sandbox");');
    expect(subjectEntries.waves).toContain('private active: WavesLabId | "sandbox" = "sandbox";');
    expect(subjectEntries.waves).toContain('this.activate("sandbox");');
    expect(subjectEntries.light).toContain('new LightLabModel("sandbox")');
    expect(subjectEntries.light).toContain('this.activate("sandbox");');
    expect(subjectEntries.thermal).toContain('new ThermalWorld("sandbox")');
    expect(subjectEntries.modern).toContain('private active: ModernLabId | "sandbox" = "sandbox";');
    expect(subjectEntries.modern).toContain('this.activate("sandbox");');
  });
});
