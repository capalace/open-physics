import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("playground typography", () => {
  it("keeps every interface label at least 12px tall", () => {
    const fontSizes = [...styles.matchAll(/font-size:\s*([0-9.]+)px/g)]
      .map((match) => Number(match[1]));

    expect(fontSizes.length).toBeGreaterThan(0);
    expect(fontSizes.filter((size) => size < 12)).toEqual([]);
  });
});

describe("quick start content", () => {
  it("uses ten distinct one-column experiences instead of one card per law", () => {
    const presets = [...markup.matchAll(/data-preset="([^"]+)"/g)].map((match) => match[1]);

    expect(presets).toHaveLength(10);
    expect(new Set(presets).size).toBe(10);
    expect(presets).not.toEqual(expect.arrayContaining(["momentum", "energy", "circular", "pendulum"]));
    expect(styles).toMatch(/\.quick-start-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  });
});
