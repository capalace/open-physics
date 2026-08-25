import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

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
});
