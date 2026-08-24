import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");

describe("playground typography", () => {
  it("keeps every interface label at least 12px tall", () => {
    const fontSizes = [...styles.matchAll(/font-size:\s*([0-9.]+)px/g)]
      .map((match) => Number(match[1]));

    expect(fontSizes.length).toBeGreaterThan(0);
    expect(fontSizes.filter((size) => size < 12)).toEqual([]);
  });
});
