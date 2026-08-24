import type { Vector2 } from "../core";

export const angularDisplacement = (initial: number, angularVelocity: number, dt: number): number =>
  initial + angularVelocity * dt;

export const angularVelocityFromAcceleration = (
  initial: number,
  angularAcceleration: number,
  dt: number,
): number => initial + angularAcceleration * dt;

export const angularDisplacementConstantAcceleration = (
  initial: number,
  angularVelocity: number,
  angularAcceleration: number,
  dt: number,
): number => initial + angularVelocity * dt + 0.5 * angularAcceleration * dt ** 2;

/** τ = r × F in 2D; positive is counter-clockwise. */
export const torque = (leverArm: Vector2, force: Vector2): number =>
  leverArm.x * force.y - leverArm.y * force.x;

/** α = τ/I. */
export const angularAccelerationFromTorque = (torqueValue: number, momentOfInertia: number): number => {
  if (momentOfInertia <= 0) throw new RangeError("Moment of inertia must be greater than zero.");
  return torqueValue / momentOfInertia;
};

/** L = Iω for a rigid body about a fixed axis. */
export const rotationalAngularMomentum = (momentOfInertia: number, angularVelocity: number): number =>
  momentOfInertia * angularVelocity;

/** K = ½Iω². */
export const rotationalEnergy = (momentOfInertia: number, angularVelocity: number): number =>
  0.5 * momentOfInertia * angularVelocity ** 2;

/** τ = Iα. */
export const torqueFromAngularAcceleration = (momentOfInertia: number, angularAcceleration: number): number =>
  momentOfInertia * angularAcceleration;

/** Rolling without slipping: v = rω. */
export const rollingSpeed = (radius: number, angularVelocity: number): number =>
  radius * angularVelocity;

/** Common moment of inertia: point mass I = mr². */
export const pointMassMomentOfInertia = (mass: number, radius: number): number => mass * radius ** 2;

/** Solid disk about its center: I = ½mr². */
export const solidDiskMomentOfInertia = (mass: number, radius: number): number =>
  0.5 * mass * radius ** 2;

/** Thin hoop about its center: I = mr². */
export const hoopMomentOfInertia = (mass: number, radius: number): number => mass * radius ** 2;

/** Rod about its center: I = 1/12 mL². */
export const rodCenterMomentOfInertia = (mass: number, length: number): number =>
  (mass * length ** 2) / 12;

/** Rod about one end: I = 1/3 mL². */
export const rodEndMomentOfInertia = (mass: number, length: number): number =>
  (mass * length ** 2) / 3;
