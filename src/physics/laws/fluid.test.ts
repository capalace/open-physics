import { describe, expect, it } from "vitest";
import { fluidDensity, fluidPressure, hydrostaticPressure, buoyantForce, buoyancyNetForce, floatingSubmergedFraction, dynamicPressure, continuityVelocity, bernoulliPressure } from "./fluid";

describe("fluid mechanics", () => {
  it("computes density and pressure", () => {
    expect(fluidDensity(10, 2)).toBe(5);
    expect(fluidPressure(20, 4)).toBe(5);
  });

  it("computes hydrostatic pressure and buoyancy", () => {
    expect(hydrostaticPressure(1000, 10, 2)).toBe(20000);
    expect(buoyantForce(1000, 10, 0.2)).toBe(2000);
    expect(buoyancyNetForce(1000, 500, 10, 0.2)).toBe(1000);
  });

  it("computes floating fraction", () => {
    expect(floatingSubmergedFraction(500, 1000)).toBe(0.5);
  });

  it("computes dynamic pressure and continuity", () => {
    expect(dynamicPressure(1000, 2)).toBe(2000);
    expect(continuityVelocity(4, 2, 1)).toBe(8);
  });

  it("computes Bernoulli pressure relation", () => {
    expect(bernoulliPressure(100000, 1000, 2, 4, 0, 0, 10)).toBe(94000);
  });
});
