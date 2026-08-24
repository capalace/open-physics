import { ForceLaw, ForceLawContext, Force } from "../quantities";
import { BodyState, Vector2 } from "../core";
import { SI } from "../quantities";

/**
 * Uniform gravitational field model.
 *
 * F = mg
 *
 * This is the simplified near-surface model. The gravitational field is
 * constant throughout the simulated world and is supplied as an acceleration
 * vector, so changing its direction is also supported.
 */
export class UniformGravity implements ForceLaw {
  readonly id = "gravity.uniform";

  constructor(
    public readonly field: Vector2 = {
      x: 0,
      y: -SI.gravitationalAcceleration,
    },
  ) {}

  force(state: BodyState, _context: ForceLawContext): Force {
    return {
      vector: {
        x: state.mass * this.field.x,
        y: state.mass * this.field.y,
      },
      source: this.id,
    };
  }
}
