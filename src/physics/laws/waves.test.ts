import { describe, expect, it } from "vitest";
import {
  waveSpeed,
  frequencyFromPeriod,
  waveNumber,
  angularFrequencyFromFrequency,
  travelingWave,
  relativeIntensity,
  constructivePathDifference,
  destructivePathDifference,
  nodeSpacing,
  fixedStringHarmonicFrequency,
  closedPipeHarmonicFrequency,
  soundIntensityLevel,
  dopplerFrequency,
} from "./waves";

describe("waves", () => {
  it("calculates wave speed", () => expect(waveSpeed(2, 3)).toBe(6));
  it("calculates frequency, wave number and angular frequency", () => {
    expect(frequencyFromPeriod(2)).toBe(0.5);
    expect(waveNumber(2 * Math.PI)).toBeCloseTo(1);
    expect(angularFrequencyFromFrequency(2)).toBeCloseTo(4 * Math.PI);
  });
  it("evaluates a traveling wave", () => {
    expect(travelingWave(2, 1, 1, 0, 0)).toBe(0);
    expect(travelingWave(2, 1, 1, Math.PI / 2, 0)).toBeCloseTo(2 * Math.sin(1.57079632679));
  });
  it("uses amplitude squared for relative intensity", () => expect(relativeIntensity(3)).toBe(9));
  it("calculates interference path conditions", () => {
    expect(constructivePathDifference(2, 3)).toBe(6);
    expect(destructivePathDifference(2, 3)).toBe(7.5);
  });
  it("calculates standing-wave node spacing", () => expect(nodeSpacing(4)).toBe(2));
  it("calculates string and pipe harmonics", () => {
    expect(fixedStringHarmonicFrequency(1, 340, 1)).toBe(170);
    expect(closedPipeHarmonicFrequency(1, 340, 1)).toBe(85);
    expect(closedPipeHarmonicFrequency(2, 340, 1)).toBe(255);
  });
  it("calculates sound level", () => expect(soundIntensityLevel(1e-6)).toBe(60));
  it("calculates the classical Doppler shift", () => {
    expect(dopplerFrequency(1000, 340, 34, 0)).toBe(1100);
  });
  it("rejects invalid parameters", () => {
    expect(() => waveSpeed(0, 1)).toThrow(RangeError);
    expect(() => frequencyFromPeriod(0)).toThrow(RangeError);
    expect(() => soundIntensityLevel(0)).toThrow(RangeError);
  });
});
