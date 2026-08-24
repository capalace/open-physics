/** Physical quantities used by the equation-based physics core. */

import type { BodyState, Vector2 } from "./core";

export type Scalar = number;

export interface Force {
  /** Force vector in newtons. */
  vector: Vector2;
  /** Optional identifier for visualization/debugging. */
  readonly source?: string;
}

export interface PhysicalConstants {
  readonly gravitationalAcceleration: number;
  readonly gravitationalConstant: number;
  readonly coulombConstant: number;
  readonly springConstantDefault: number;
  readonly frictionCoefficientDefault: number;
}

/** SI constants and defaults used by the simplified models. */
export const SI: PhysicalConstants = Object.freeze({
  gravitationalAcceleration: 9.80665,
  gravitationalConstant: 6.67430e-11,
  coulombConstant: 8.9875517923e9,
  springConstantDefault: 10,
  frictionCoefficientDefault: 0.2,
});

export interface ForceLawContext {
  time: number;
  dt: number;
}

/** A law produces force; F = ma is applied by the state integrator. */
export interface ForceLaw<TState = BodyState> {
  readonly id: string;
  force(state: TState, context: ForceLawContext): Force;
}

export function netForce(
  state: BodyState,
  laws: readonly ForceLaw[],
  context: ForceLawContext,
): Force {
  let x = 0;
  let y = 0;

  for (const law of laws) {
    const force = law.force(state, context).vector;
    x += force.x;
    y += force.y;
  }

  return { vector: { x, y }, source: "net-force" };
}

/** Weight: F = mg. Positive gravity points in the supplied direction. */
export class Weight implements ForceLaw {
  readonly id = "gravity.uniform";

  constructor(
    public readonly gravity: Vector2 = {
      x: 0,
      y: -SI.gravitationalAcceleration,
    },
  ) {}

  force(state: BodyState): Force {
    return {
      vector: {
        x: state.mass * this.gravity.x,
        y: state.mass * this.gravity.y,
      },
      source: this.id,
    };
  }
}

export interface MultiBodyForceLaw<TState = BodyState> extends ForceLaw<TState> {
  forceOn(state: TState, other: TState, context: ForceLawContext): Force;
}
