import { describe, expect, it } from "vitest";
import { circularOrbitSpeed, circularOrbitPeriod, escapeSpeed, gravitationalPotentialEnergyOrbit, circularOrbitEnergy, keplerPeriod } from "./orbit";

describe("orbital mechanics", () => {
  const G = 1;
  const M = 4;
  const r = 4;

  it("computes circular orbit speed", () => {
    expect(circularOrbitSpeed(M, r, G)).toBe(1);
  });

  it("computes escape speed", () => {
    expect(escapeSpeed(M, r, G)).toBe(Math.sqrt(2));
  });

  it("computes circular orbit energy", () => {
    expect(gravitationalPotentialEnergyOrbit(4, 2, 4, G)).toBe(-2);
    expect(circularOrbitEnergy(4, 2, 4, G)).toBe(-1);
  });

  it("satisfies Kepler's third law", () => {
    expect(circularOrbitPeriod(4, 4, G)).toBeCloseTo(8 * Math.PI);
    expect(keplerPeriod(4, 4, 0, G)).toBeCloseTo(8 * Math.PI);
  });
});
