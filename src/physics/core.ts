/**
 * Foundational equation-based physics core.
 *
 * This layer intentionally knows nothing about rendering or UI.
 * Physics laws produce physical quantities and numerical integration
 * advances the resulting state.
 */

import { Force, ForceLaw, netForce } from "./quantities";

export interface Vector2 {
  x: number;
  y: number;
}

export const vec2 = (x = 0, y = 0): Vector2 => ({ x, y });

export const add = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

export const sub = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const scale = (v: Vector2, scalar: number): Vector2 => ({
  x: v.x * scalar,
  y: v.y * scalar,
});

export const magnitude = (v: Vector2): number => Math.hypot(v.x, v.y);

export const zero = (): Vector2 => vec2();

/** Mutable simulation state for one point-mass-like body. */
export interface BodyState {
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
}

export interface PhysicsContext {
  time: number;
  dt: number;
}

export interface Solver {
  readonly id: string;
  step(
    state: BodyState,
    laws: readonly ForceLaw[],
    context: PhysicsContext,
  ): BodyState;
}

/** Newton's second law: a = F_net / m. */
export function accelerationFromForce(
  force: Force,
  mass: number,
): Vector2 {
  if (mass <= 0) {
    throw new RangeError("Mass must be greater than zero.");
  }

  return scale(force.vector, 1 / mass);
}

/** Basic explicit Euler integrator. */
export const eulerSolver: Solver = {
  id: "euler",

  step(state, laws, context) {
    const force = netForce(state, laws, context);
    const acceleration = accelerationFromForce(force, state.mass);

    return {
      ...state,
      position: add(state.position, scale(state.velocity, context.dt)),
      velocity: add(state.velocity, scale(acceleration, context.dt)),
      acceleration,
    };
  },
};

/** A world contains state, active force laws, and a numerical solver. */
export class PhysicsWorld {
  constructor(
    public state: BodyState,
    public readonly laws: ForceLaw[] = [],
    public solver: Solver = eulerSolver,
  ) {}

  step(dt: number): void {
    if (dt <= 0) {
      throw new RangeError("Time step must be greater than zero.");
    }

    const context: PhysicsContext = {
      time: this.time,
      dt,
    };

    this.state = this.solver.step(this.state, this.laws, context);
    this.time += dt;
  }

  private time = 0;

  get currentTime(): number {
    return this.time;
  }
}
