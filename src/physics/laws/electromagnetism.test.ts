import { describe, expect, it } from "vitest";
import {
  coulombForceMagnitude,
  pointChargeElectricField,
  electricForce,
  pointChargePotential,
  electricPotentialEnergy,
  voltageFromCurrent,
  currentFromVoltage,
  electricalPower,
  seriesResistance,
  parallelResistance,
  capacitance,
  capacitorEnergy,
  magneticForceMagnitude,
  currentWireMagneticForce,
  inducedEmf,
  magneticFlux,
  lorentzForce2D,
} from "./electromagnetism";

describe("electromagnetism", () => {
  it("calculates Coulomb force", () => {
    expect(coulombForceMagnitude(1, 1, 1, 1)).toBe(1);
  });

  it("calculates point-charge field and potential", () => {
    expect(pointChargeElectricField(2, 2, 1)).toBe(0.5);
    expect(pointChargePotential(2, 2, 1)).toBe(1);
  });

  it("calculates electric force and potential energy", () => {
    expect(electricForce(2, 3)).toBe(6);
    expect(electricPotentialEnergy(2, 3)).toBe(6);
  });

  it("implements Ohm's law and power", () => {
    expect(voltageFromCurrent(2, 5)).toBe(10);
    expect(currentFromVoltage(10, 5)).toBe(2);
    expect(electricalPower(10, 2)).toBe(20);
  });

  it("calculates series and parallel resistance", () => {
    expect(seriesResistance([2, 3])).toBe(5);
    expect(parallelResistance([2, 2])).toBe(1);
  });

  it("calculates capacitance and capacitor energy", () => {
    expect(capacitance(6, 3)).toBe(2);
    expect(capacitorEnergy(2, 3)).toBe(9);
  });

  it("calculates magnetic forces", () => {
    expect(magneticForceMagnitude(2, 3, 4, Math.PI / 2)).toBeCloseTo(24);
    expect(currentWireMagneticForce(2, 3, 4, Math.PI / 2)).toBeCloseTo(24);
  });

  it("calculates magnetic flux and Faraday emf", () => {
    expect(magneticFlux(2, 3, 0)).toBe(6);
    expect(inducedEmf(2, 3, 1)).toBe(-6);
  });

  it("calculates the 2D Lorentz force", () => {
    const force = lorentzForce2D(2, { x: 1, y: 3 }, { x: 4, y: 5 }, 2);
    expect(force.x).toEqual(22);
    expect(force.y).toEqual(-10);
  });

  it("rejects invalid physical parameters", () => {
    expect(() => coulombForceMagnitude(1, 1, 0, 1)).toThrow(RangeError);
    expect(() => currentFromVoltage(1, 0)).toThrow(RangeError);
    expect(() => parallelResistance([])).toThrow(RangeError);
    expect(() => capacitance(1, 0)).toThrow(RangeError);
  });
});
