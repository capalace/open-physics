import { describe, expect, it } from "vitest";
import {
  criticalAngle,
  doubleSlitBrightAngle,
  doubleSlitDarkAngle,
  doubleSlitIntensity,
  focalLengthFromRadius,
  imageDistance,
  lensImageDistance,
  lensMagnification,
  lightSpeedInMedium,
  photonEnergyFromFrequency,
  photonEnergyFromWavelength,
  polarizedIntensity,
  prismDeviation,
  reflectionAngle,
  reflectedAngle,
  refractiveIndex,
  refractionAngle,
  refractedAngle,
  singleSlitMinimumAngle,
  singleSlitIntensity,
  telescopeMagnification,
} from "./optics";

describe("optics laws", () => {
  it("preserves the foundational optics API", () => {
    expect(reflectionAngle(0.4)).toBe(0.4);
    expect(refractionAngle(1, 2, Math.asin(0.5))).toBeCloseTo(Math.asin(0.25));
    expect(() => refractionAngle(2, 1, Math.PI / 4)).toThrow(RangeError);
    expect(imageDistance(10, 20)).toBeCloseTo(20);
    expect(focalLengthFromRadius(20)).toBe(10);
    expect(refractiveIndex(300, 200)).toBe(1.5);
    expect(lightSpeedInMedium(300, 1.5)).toBe(200);
    expect(doubleSlitBrightAngle(2, 1, 1)).toBeCloseTo(Math.PI / 6);
    expect(doubleSlitDarkAngle(2, 1, 0)).toBeCloseTo(Math.asin(0.25));
    expect(singleSlitMinimumAngle(2, 1, 1)).toBeCloseTo(Math.PI / 6);
    expect(photonEnergyFromFrequency(3, 2)).toBe(6);
    expect(photonEnergyFromWavelength(2, 3, 1)).toBe(6);
  });

  it("reflects symmetrically around a surface normal", () => {
    expect(reflectedAngle(0, Math.PI / 4)).toBeCloseTo(3 * Math.PI / 2);
  });

  it("applies Snell's law and detects total internal reflection", () => {
    expect(refractedAngle(Math.PI / 6, 1, 1.5)).toBeCloseTo(Math.asin(1 / 3));
    expect(refractedAngle(Math.PI / 3, 1.5, 1)).toBeNull();
    expect(criticalAngle(1.5, 1)).toBeCloseTo(Math.asin(2 / 3));
  });

  it("calculates a real thin-lens image and magnification", () => {
    expect(lensImageDistance(10, 30)).toBeCloseTo(15);
    expect(lensMagnification(15, 30)).toBeCloseTo(-0.5);
    expect(lensImageDistance(10, 10)).toBe(Number.POSITIVE_INFINITY);
  });

  it("models prism deviation, diffraction, polarization, and a telescope", () => {
    expect(prismDeviation(1.5, Math.PI / 3)).toBeCloseTo(Math.PI / 6);
    expect(doubleSlitIntensity(0, 550e-9, 0.0003, 0.00005)).toBeCloseTo(1);
    expect(singleSlitIntensity(0, 550e-9, 0.00005)).toBeCloseTo(1);
    expect(polarizedIntensity(100, Math.PI / 3)).toBeCloseTo(25);
    expect(telescopeMagnification(0.8, 0.04)).toBe(-20);
  });

  it("rejects inputs outside the educational model", () => {
    expect(() => refractedAngle(0, 0, 1)).toThrow(RangeError);
    expect(() => criticalAngle(1, 1.5)).toThrow(RangeError);
    expect(() => lensImageDistance(0, 1)).toThrow(RangeError);
    expect(() => doubleSlitIntensity(0, -1, 1, 1)).toThrow(RangeError);
    expect(() => polarizedIntensity(-1, 0)).toThrow(RangeError);
  });
});
