import { describe, expect, it } from "vitest";
import { reflectionAngle, refractionAngle, criticalAngle, imageDistance, lensMagnification, focalLengthFromRadius, refractiveIndex, lightSpeedInMedium, doubleSlitBrightAngle, doubleSlitDarkAngle, singleSlitMinimumAngle, photonEnergyFromFrequency, photonEnergyFromWavelength } from "./optics";

describe("optics", () => {
  it("reflects at the same angle", () => expect(reflectionAngle(0.4)).toBe(0.4));
  it("applies Snell's law", () => expect(refractionAngle(1, 2, Math.asin(0.5))).toBeCloseTo(Math.asin(0.25)));
  it("calculates the critical angle", () => expect(criticalAngle(2, 1)).toBeCloseTo(Math.PI / 6));
  it("detects total internal reflection", () => expect(() => refractionAngle(2, 1, Math.PI / 4)).toThrow(RangeError));
  it("uses the thin-lens equation", () => expect(imageDistance(10, 20)).toBeCloseTo(20));
  it("calculates lens magnification", () => expect(lensMagnification(20, 20)).toBe(-1));
  it("calculates mirror focal length", () => expect(focalLengthFromRadius(20)).toBe(10));
  it("calculates refractive index and medium speed", () => {
    expect(refractiveIndex(300, 200)).toBe(1.5);
    expect(lightSpeedInMedium(300, 1.5)).toBe(200);
  });
  it("calculates double-slit maxima and minima", () => {
    expect(doubleSlitBrightAngle(2, 1, 1)).toBeCloseTo(Math.PI / 6);
    expect(doubleSlitDarkAngle(2, 1, 0)).toBeCloseTo(Math.asin(0.25));
  });
  it("calculates single-slit minima", () => expect(singleSlitMinimumAngle(2, 1, 1)).toBeCloseTo(Math.PI / 6));
  it("calculates photon energy", () => {
    expect(photonEnergyFromFrequency(3, 2)).toBe(6);
    expect(photonEnergyFromWavelength(2, 3, 1)).toBe(6);
  });
  it("rejects invalid optical parameters", () => {
    expect(() => criticalAngle(1, 2)).toThrow(RangeError);
    expect(() => imageDistance(0, 1)).toThrow(RangeError);
  });
});
