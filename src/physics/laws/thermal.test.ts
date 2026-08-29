import { describe, expect, it } from "vitest";
import { sensibleHeat, latentHeat, linearExpansion, idealGasPressure, idealGasVolume, idealGasPressureFromParticles, internalEnergyChange, thermalEfficiency, conductionHeatRate, meanParticleKineticEnergy, rmsMolecularSpeed, carnotEfficiency, entropyChangeForHeating, entropyCreatedByMixing } from "./thermal";

describe("thermal physics", () => {
  it("calculates sensible heat", () => expect(sensibleHeat(2, 3, 4)).toBe(24));
  it("calculates latent heat", () => expect(latentHeat(2, 5)).toBe(10));
  it("calculates linear expansion", () => expect(linearExpansion(10, 2, 3)).toBe(60));
  it("calculates ideal gas pressure and volume", () => {
    expect(idealGasPressure(1, 2, 4, 8)).toBe(4);
    expect(idealGasVolume(1, 2, 4, 8)).toBe(4);
  });
  it("calculates microscopic ideal gas pressure", () => expect(idealGasPressureFromParticles(2, 3, 4, 5)).toBe(7.5));
  it("applies the first law sign convention", () => expect(internalEnergyChange(10, 4)).toBe(6));
  it("calculates thermal efficiency", () => expect(thermalEfficiency(40, 100)).toBe(0.4));
  it("calculates conductive heat rate", () => expect(conductionHeatRate(2, 3, 4, 2)).toBe(12));
  it("calculates mean molecular kinetic energy", () => expect(meanParticleKineticEnergy(4, 2)).toBe(12));
  it("calculates rms molecular speed", () => expect(rmsMolecularSpeed(8, 3, 2)).toBeCloseTo(Math.sqrt(36)));
  it("calculates the Carnot upper-bound efficiency", () => {
    expect(carnotEfficiency(600, 300)).toBeCloseTo(0.5);
    expect(() => carnotEfficiency(300, 600)).toThrow(RangeError);
  });
  it("calculates entropy changes from heating and thermal mixing", () => {
    expect(entropyChangeForHeating(10, 300, 600)).toBeCloseTo(10 * Math.log(2));
    expect(entropyCreatedByMixing(10, 200, 400)).toBeGreaterThan(0);
    expect(entropyCreatedByMixing(10, 300, 300)).toBeCloseTo(0);
  });
  it("rejects invalid thermodynamic state parameters", () => {
    expect(() => idealGasPressure(0, 1, 1, 1)).toThrow(RangeError);
    expect(() => idealGasPressure(1, 1, 0, 1)).toThrow(RangeError);
    expect(() => thermalEfficiency(1, 0)).toThrow(RangeError);
  });
});
