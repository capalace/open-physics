import type { Vector2 } from "../core";

export const speed = (velocity: Vector2): number => Math.hypot(velocity.x, velocity.y);
export const momentum = (mass: number, velocity: Vector2): Vector2 => ({ x: mass * velocity.x, y: mass * velocity.y });
export const kineticEnergy = (mass: number, velocity: Vector2): number => 0.5 * mass * speed(velocity) ** 2;
export const gravitationalPotentialEnergy = (mass: number, gravityMagnitude: number, height: number): number => mass * gravityMagnitude * height;
export const springPotentialEnergy = (stiffness: number, displacement: number): number => 0.5 * stiffness * displacement ** 2;
export const work = (force: Vector2, displacement: Vector2): number => force.x * displacement.x + force.y * displacement.y;
export const power = (force: Vector2, velocity: Vector2): number => force.x * velocity.x + force.y * velocity.y;
export const impulse = (force: Vector2, dt: number): Vector2 => ({ x: force.x * dt, y: force.y * dt });
export const averageForceFromImpulse = (impulseVector: Vector2, dt: number): Vector2 => ({ x: impulseVector.x / dt, y: impulseVector.y / dt });
export const accelerationFromChangeInVelocity = (initial: Vector2, final: Vector2, dt: number): Vector2 => ({ x: (final.x - initial.x) / dt, y: (final.y - initial.y) / dt });

export const constantAccelerationVelocity = (initialVelocity: Vector2, acceleration: Vector2, dt: number): Vector2 => ({ x: initialVelocity.x + acceleration.x * dt, y: initialVelocity.y + acceleration.y * dt });
export const constantAccelerationDisplacement = (initialVelocity: Vector2, acceleration: Vector2, dt: number): Vector2 => ({ x: initialVelocity.x * dt + 0.5 * acceleration.x * dt ** 2, y: initialVelocity.y * dt + 0.5 * acceleration.y * dt ** 2 });

export const centripetalAcceleration = (speedValue: number, radius: number): number => speedValue ** 2 / radius;
export const centripetalForce = (mass: number, speedValue: number, radius: number): number => mass * centripetalAcceleration(speedValue, radius);
export const angularSpeed = (angle: number, dt: number): number => angle / dt;
export const tangentialSpeed = (radius: number, angularVelocity: number): number => radius * angularVelocity;
export const tangentialAcceleration = (radius: number, angularAcceleration: number): number => radius * angularAcceleration;

export const torqueMagnitude = (leverArm: Vector2, force: Vector2): number => leverArm.x * force.y - leverArm.y * force.x;
export const rotationalKineticEnergy = (momentOfInertia: number, angularVelocity: number): number => 0.5 * momentOfInertia * angularVelocity ** 2;
export const angularMomentum = (momentOfInertia: number, angularVelocity: number): number => momentOfInertia * angularVelocity;

export const density = (mass: number, volume: number): number => mass / volume;
export const pressure = (forceMagnitude: number, area: number): number => forceMagnitude / area;
export const hydrostaticPressure = (densityValue: number, gravityMagnitude: number, depth: number): number => densityValue * gravityMagnitude * depth;
export const buoyantForce = (fluidDensity: number, gravityMagnitude: number, displacedVolume: number): number => fluidDensity * gravityMagnitude * displacedVolume;

export const momentumConservationFinalVelocity = (m1: number, v1: number, m2: number, v2: number): number => (m1 * v1 + m2 * v2) / (m1 + m2);
export const coefficientOfRestitution = (relativeSeparationSpeed: number, relativeApproachSpeed: number): number => relativeSeparationSpeed / relativeApproachSpeed;
export const postCollisionVelocity1D = (m1: number, u1: number, m2: number, u2: number, restitution: number): number => ((m1 - restitution * m2) * u1 + (1 + restitution) * m2 * u2) / (m1 + m2);
export const postCollisionVelocity1DSecond = (m1: number, u1: number, m2: number, u2: number, restitution: number): number => ((m2 - restitution * m1) * u2 + (1 + restitution) * m1 * u1) / (m1 + m2);

export function validatePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}
