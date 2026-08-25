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

describe("mechanics lab content", () => {
  it("offers ten distinct one-column labs and a separate sandbox", () => {
    const labs = [...markup.matchAll(/data-lab="([^"]+)"/g)].map((match) => match[1]);

    expect(labs).toHaveLength(10);
    expect(new Set(labs).size).toBe(10);
    expect(labs).not.toEqual(expect.arrayContaining(["momentum", "energy", "circular", "pendulum"]));
    expect(markup).toContain('data-app-mode="lab"');
    expect(markup).toContain('data-app-mode="sandbox"');
    expect(markup).toContain('id="lab-guide"');
    expect(markup).toContain('id="new-sandbox"');
    expect(styles).toMatch(/\.quick-start-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  });
});

describe("sandbox object palette", () => {
  it("offers distinct moving and fixed primitives", () => {
    const objectKinds = [...markup.matchAll(/data-object-kind="([^"]+)"/g)]
      .map((match) => match[1]);

    expect(objectKinds).toEqual(["ball", "box", "platform", "wall"]);
  });
});
