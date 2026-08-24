import { describe, expect, it } from "vitest";
import { vec2 } from "../core";
import { accelerationFromChangeInVelocity, angularMomentum, buoyantForce, centripetalAcceleration, centripetalForce, coefficientOfRestitution, constantAccelerationDisplacement, constantAccelerationVelocity, density, gravitationalPotentialEnergy, impulse, kineticEnergy, momentum, momentumConservationFinalVelocity, postCollisionVelocity1D, postCollisionVelocity1DSecond, power, pressure, rotationalKineticEnergy, speed, springPotentialEnergy, tangentialAcceleration, tangentialSpeed, torqueMagnitude, work } from "./mechanics";

describe("mechanics equations", () => {
  it("computes kinematics", () => {
    expect(constantAccelerationVelocity(vec2(2, 0), vec2(3, 0), 4).x).toBe(14);
    expect(constantAccelerationDisplacement(vec2(2, 0), vec2(3, 0), 4).x).toBe(32);
    expect(accelerationFromChangeInVelocity(vec2(2, 0), vec2(8, 0), 3).x).toBe(2);
  });

  it("computes momentum and energy", () => {
    expect(momentum(2, vec2(3, 4))).toEqual(vec2(6, 8));
    expect(speed(vec2(3, 4))).toBe(5);
    expect(kineticEnergy(2, vec2(3, 4))).toBe(25);
    expect(gravitationalPotentialEnergy(2, 10, 5)).toBe(100);
    expect(springPotentialEnergy(10, 2)).toBe(20);
  });

  it("computes work, power, and impulse", () => {
    expect(work(vec2(10, 0), vec2(3, 0))).toBe(30);
    expect(power(vec2(10, 0), vec2(3, 0))).toBe(30);
    expect(impulse(vec2(10, -4), 2)).toEqual(vec2(20, -8));
  });

  it("computes circular motion", () => {
    expect(centripetalAcceleration(10, 5)).toBe(20);
    expect(centripetalForce(2, 10, 5)).toBe(40);
    expect(tangentialSpeed(2, 3)).toBe(6);
    expect(tangentialAcceleration(2, 3)).toBe(6);
  });

  it("computes rotational quantities", () => {
    expect(torqueMagnitude(vec2(2, 0), vec2(0, 5))).toBe(10);
    expect(rotationalKineticEnergy(4, 3)).toBe(18);
    expect(angularMomentum(4, 3)).toBe(12);
  });

  it("computes pressure, density, and buoyancy", () => {
    expect(density(10, 2)).toBe(5);
    expect(pressure(20, 4)).toBe(5);
    expect(buoyantForce(1000, 10, 0.2)).toBe(2000);
  });

  it("computes hydrostatic pressure", () => {
    expect(pressure(100, 5)).toBe(20);
  });

  it("computes collision quantities", () => {
    expect(momentumConservationFinalVelocity(1, 4, 1, 0)).toBe(2);
    expect(coefficientOfRestitution(3, 6)).toBe(0.5);
    expect(postCollisionVelocity1D(1, 4, 1, 0, 1)).toBe(0);
    expect(postCollisionVelocity1DSecond(1, 4, 1, 0, 1)).toBe(4);
  });
});
