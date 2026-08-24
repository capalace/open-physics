import type { BodyState, Vector2 } from "../core";
import type { Force, ForceLaw, ForceLawContext } from "../quantities";
import { SI } from "../quantities";

/** Uniform near-surface gravity: F = mg. */
export class UniformGravity implements ForceLaw {
  readonly id = "gravity.uniform";

  constructor(
    public readonly field: Vector2 = { x: 0, y: -SI.gravitationalAcceleration },
  ) {}

  force(state: BodyState, _context: ForceLawContext): Force {
    return {
      vector: { x: state.mass * this.field.x, y: state.mass * this.field.y },
      source: this.id,
    };
  }
}

/** Newtonian point-mass gravity: F = G m₁m₂ / r². */
export class PointGravity implements ForceLaw {
  readonly id = "gravity.point";

  constructor(
    public readonly sourceMass: number,
    public readonly sourcePosition: Vector2,
    public readonly gravitationalConstant = SI.gravitationalConstant,
  ) {
    if (sourceMass < 0) throw new RangeError("Source mass must be non-negative.");
    if (gravitationalConstant < 0) throw new RangeError("Gravitational constant must be non-negative.");
  }

  force(state: BodyState, _context: ForceLawContext): Force {
    const dx = this.sourcePosition.x - state.position.x;
    const dy = this.sourcePosition.y - state.position.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared === 0) return { vector: { x: 0, y: 0 }, source: this.id };

    const distance = Math.sqrt(distanceSquared);
    const magnitude = this.gravitationalConstant * state.mass * this.sourceMass / distanceSquared;

    return {
      vector: { x: magnitude * dx / distance, y: magnitude * dy / distance },
      source: this.id,
    };
  }
}
