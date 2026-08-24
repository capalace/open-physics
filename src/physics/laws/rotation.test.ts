import { describe, expect, it } from "vitest";
import {
  torque,
  angularAccelerationFromTorque,
  rotationalEnergy,
  rollingSpeed,
  pointMassMomentOfInertia,
  solidDiskMomentOfInertia,
  rodCenterMomentOfInertia,
  rodEndMomentOfInertia,
} from "./rotation";

describe("rotational mechanics", () => {
  it("computes torque and angular acceleration", () => {
    expect(torque({ x: 2, y: 0 }, { x: 0, y: 5 })).toBe(10);
    expect(angularAccelerationFromTorque(10, 2)).toBe(5);
  });

  it("computes rotational energy and rolling speed", () => {
    expect(rotationalEnergy(4, 3)).toBe(18);
    expect(rollingSpeed(2, 3)).toBe(6);
  });

  it("computes common moments of inertia", () => {
    expect(pointMassMomentOfInertia(2, 3)).toBe(18);
    expect(solidDiskMomentOfInertia(2, 3)).toBe(9);
    expect(rodCenterMomentOfInertia(2, 3)).toBe(1.5);
    expect(rodEndMomentOfInertia(2, 3)).toBe(6);
  });
});
