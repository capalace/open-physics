import { describe, expect, it } from "vitest";
import { formatGraphValue } from "./lab-graph";

describe("lab graph labels", () => {
  it("keeps small values readable without noisy trailing zeroes", () => {
    expect(formatGraphValue(0)).toBe("0");
    expect(formatGraphValue(5.3)).toBe("5.3");
    expect(formatGraphValue(12.34)).toBe("12.3");
    expect(formatGraphValue(123.4)).toBe("123");
  });
});
