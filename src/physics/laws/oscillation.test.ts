import {
  angularFrequency,
  periodFromAngularFrequency,
  frequencyFromAngularFrequency,
  harmonicDisplacement,
  harmonicVelocity,
  harmonicAcceleration,
  maximumSpeed,
  maximumAcceleration,
  harmonicEnergy,
  pendulumPeriod,
  pendulumAngularFrequency,
} from "./oscillation";

describe("simple harmonic motion", () => {
  it("calculates mass-spring angular frequency", () => {
    expect(angularFrequency(4, 1)).toBe(2);
  });

  it("calculates period and frequency", () => {
    expect(periodFromAngularFrequency(2)).toBeCloseTo(Math.PI);
    expect(frequencyFromAngularFrequency(2)).toBeCloseTo(1 / Math.PI);
  });

  it("evaluates displacement at phase landmarks", () => {
    expect(harmonicDisplacement(2, 3, 0)).toBeCloseTo(2);
    expect(harmonicDisplacement(2, 3, Math.PI / 6)).toBeCloseTo(0);
  });

  it("evaluates velocity at phase landmarks", () => {
    expect(harmonicVelocity(2, 3, 0)).toBeCloseTo(0);
    expect(harmonicVelocity(2, 3, Math.PI / 6)).toBeCloseTo(-6);
  });

  it("uses a = -ω²x", () => {
    expect(harmonicAcceleration(2, 3)).toBe(-18);
  });

  it("calculates maximum speed and acceleration", () => {
    expect(maximumSpeed(2, 3)).toBe(6);
    expect(maximumAcceleration(2, 3)).toBe(18);
  });

  it("calculates total oscillator energy", () => {
    expect(harmonicEnergy(4, 2)).toBe(8);
  });

  it("calculates the small-angle pendulum period", () => {
    const length = 1;
    const g = 9.80665;
    expect(pendulumPeriod(length, g)).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / g));
    expect(pendulumAngularFrequency(length, g)).toBeCloseTo(Math.sqrt(g));
  });

  it("rejects invalid physical parameters", () => {
    expect(() => angularFrequency(0, 1)).toThrow(RangeError);
    expect(() => angularFrequency(1, 0)).toThrow(RangeError);
    expect(() => periodFromAngularFrequency(0)).toThrow(RangeError);
    expect(() => pendulumPeriod(0, 9.8)).toThrow(RangeError);
  });
});
