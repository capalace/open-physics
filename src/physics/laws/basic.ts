import type { BodyState, Vector2 } from "../core";
import type { Force, ForceLaw, ForceLawContext } from "../quantities";

/** Constant force: F = constant. */
export class ConstantForce implements ForceLaw {
  readonly id = "force.constant";

  constructor(public readonly vector: Vector2, public readonly source = this.id) {}

  force(_state: BodyState, _context: ForceLawContext): Force {
    return { vector: { ...this.vector }, source: this.source };
  }
}

/** Hooke's law for a one-dimensional spring along an arbitrary axis: F = -kx. */
export class SpringForce implements ForceLaw {
  readonly id = "spring.hooke";

  constructor(
    public readonly anchor: Vector2,
    public readonly stiffness: number,
    public readonly restLength = 0,
  ) {
    if (stiffness < 0) throw new RangeError("Spring stiffness must be non-negative.");
    if (restLength < 0) throw new RangeError("Spring rest length must be non-negative.");
  }

  force(state: BodyState, _context: ForceLawContext): Force {
    const dx = state.position.x - this.anchor.x;
    const dy = state.position.y - this.anchor.y;
    const length = Math.hypot(dx, dy);

    if (length === 0) return { vector: { x: 0, y: 0 }, source: this.id };

    const extension = length - this.restLength;
    const magnitude = -this.stiffness * extension;
    const nx = dx / length;
    const ny = dy / length;

    return {
      vector: { x: magnitude * nx, y: magnitude * ny },
      source: this.id,
    };
  }
}

/** Kinetic friction opposite the direction of motion: F = μN. */
export class KineticFriction implements ForceLaw {
  readonly id = "friction.kinetic";

  constructor(
    public readonly normalForce: number,
    public readonly coefficient: number,
  ) {
    if (normalForce < 0) throw new RangeError("Normal force must be non-negative.");
    if (coefficient < 0) throw new RangeError("Friction coefficient must be non-negative.");
  }

  force(state: BodyState, _context: ForceLawContext): Force {
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed === 0) return { vector: { x: 0, y: 0 }, source: this.id };

    const magnitude = this.coefficient * this.normalForce;
    return {
      vector: {
        x: -magnitude * state.velocity.x / speed,
        y: -magnitude * state.velocity.y / speed,
      },
      source: this.id,
    };
  }
}
