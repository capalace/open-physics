import type { BodyState, Vector2, PhysicsContext } from "./core";
import type { Force } from "./quantities";
import { magnitude, scale } from "./core";

export interface SpatialField {
  readonly id: string;
  forceAt(state: BodyState, context: PhysicsContext): Force;
}

/** Uniform gravitational field: F = mg. */
export class UniformGravityField implements SpatialField {
  readonly id = "field.gravity.uniform";
  constructor(public readonly acceleration: Vector2 = { x: 0, y: -9.80665 }) {}

  forceAt(state: BodyState): Force {
    return { vector: scale(this.acceleration, state.mass), source: this.id };
  }
}

/** Point-source gravity field: F = GMm/r². */
export class PointGravityField implements SpatialField {
  readonly id = "field.gravity.point";
  constructor(public readonly sourcePosition: Vector2, public readonly sourceMass: number, public readonly G = 6.67430e-11) {
    if (sourceMass <= 0 || G <= 0) throw new RangeError("Source mass and G must be greater than zero.");
  }

  forceAt(state: BodyState): Force {
    const dx = this.sourcePosition.x - state.position.x;
    const dy = this.sourcePosition.y - state.position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared === 0) return { vector: { x: 0, y: 0 }, source: this.id };
    const distance = Math.sqrt(distanceSquared);
    const magnitudeValue = this.G * this.sourceMass * state.mass / distanceSquared;
    return { vector: { x: magnitudeValue * dx / distance, y: magnitudeValue * dy / distance }, source: this.id };
  }
}

/** Uniform electric field: F = qE. Charge is attached as an optional body property. */
export class UniformElectricField implements SpatialField {
  readonly id = "field.electric.uniform";
  constructor(public readonly field: Vector2) {}

  forceAt(state: BodyState & { charge?: number }): Force {
    return { vector: scale(this.field, state.charge ?? 0), source: this.id };
  }
}

/** Uniform magnetic field in the z direction: F = q(v × B). */
export class UniformMagneticField implements SpatialField {
  readonly id = "field.magnetic.uniform";
  constructor(public readonly fieldZ: number) {}

  forceAt(state: BodyState & { charge?: number }): Force {
    const q = state.charge ?? 0;
    return { vector: { x: q * state.velocity.y * this.fieldZ, y: -q * state.velocity.x * this.fieldZ }, source: this.id };
  }
}

/** Radial inverse-square field useful for simplified source-based simulations. */
export const radialField = (sourcePosition: Vector2, strength: number, position: Vector2): Vector2 => {
  const dx = sourcePosition.x - position.x;
  const dy = sourcePosition.y - position.y;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared === 0) return { x: 0, y: 0 };
  const distance = Math.sqrt(distanceSquared);
  return { x: strength * dx / (distanceSquared * distance), y: strength * dy / (distanceSquared * distance) };
};

export const fieldMagnitude = (field: Vector2): number => magnitude(field);
