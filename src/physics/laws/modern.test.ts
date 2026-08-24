import { describe, expect, it } from "vitest";
import { massEnergy, lorentzFactor, relativisticMomentum, relativisticKineticEnergy, deBroglieWavelength, photonEnergy, photoelectronMaximumKineticEnergy, photoelectricThresholdFrequency, hydrogenBohrEnergyLevel, energyTransition, remainingParticles, radioactiveActivity, decayConstantFromHalfLife, massDefectEnergy } from "./modern";

describe("modern physics", () => {
  it("calculates mass-energy equivalence", () => expect(massEnergy(2, 3)).toBe(18));
  it("calculates relativistic quantities", () => {
    expect(lorentzFactor(0, 10)).toBe(1);
    expect(relativisticMomentum(2, 0, 10)).toBe(0);
    expect(relativisticKineticEnergy(2, 0, 10)).toBe(0);
  });
  it("calculates de Broglie wavelength", () => expect(deBroglieWavelength(6, 2)).toBe(3));
  it("calculates photon energy", () => expect(photonEnergy(2, 3)).toBe(6));
  it("calculates photoelectric effect", () => {
    expect(photoelectronMaximumKineticEnergy(2, 5, 3)).toBe(7);
    expect(photoelectricThresholdFrequency(3, 2)).toBe(1.5);
  });
  it("calculates hydrogen energy levels and transitions", () => {
    expect(hydrogenBohrEnergyLevel(2, -13.6)).toBeCloseTo(-3.4);
    expect(energyTransition(-13.6, -3.4)).toBeCloseTo(10.2);
  });
  it("calculates radioactive decay", () => {
    expect(remainingParticles(100, 10, 10)).toBe(50);
    expect(decayConstantFromHalfLife(10)).toBeCloseTo(Math.LN2 / 10);
    expect(radioactiveActivity(0.1, 50)).toBe(5);
  });
  it("calculates mass-defect energy", () => expect(massDefectEnergy(2, 3)).toBe(18));
  it("rejects superluminal velocity", () => {
    expect(() => lorentzFactor(10, 10)).toThrow(RangeError);
    expect(() => relativisticMomentum(1, 11, 10)).toThrow(RangeError);
  });
});
