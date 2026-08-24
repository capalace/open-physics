/**
 * Foundational equation-based physics core.
 *
 * This layer intentionally knows nothing about rendering or UI.
 * Physics laws and numerical integration are kept separate so that
 * models can evolve independently from the solver implementation.
 */

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

/** A physical law computes an acceleration contribution from the current state. */
export interface PhysicsLaw {
  readonly id: string;
  acceleration(state: BodyState, context: PhysicsContext): Vector2;
}

export interface Solver {
  readonly id: string;
  step(
    state: BodyState,
    laws: readonly PhysicsLaw[],
    context: PhysicsContext,
  ): BodyState;
}

/** Sum all acceleration contributions from active laws. */
export function evaluateAcceleration(
  state: BodyState,
  laws: readonly PhysicsLaw[],
  context: PhysicsContext,
): Vector2 {
  return laws.reduce(
    (total, law) => add(total, law.acceleration(state, context)),
    zero(),
  );
}

/** Basic explicit Euler integrator. */
export const eulerSolver: Solver = {
  id: "euler",

  step(state, laws, context) {
    const acceleration = evaluateAcceleration(state, laws, context);

    return {
      ...state,
      position: add(state.position, scale(state.velocity, context.dt)),
      velocity: add(state.velocity, scale(acceleration, context.dt)),
      acceleration,
    };
  },
};

/** Constant/uniform acceleration due to gravity. */
export class UniformGravity implements PhysicsLaw {
  readonly id = "uniform-gravity";

  constructor(public readonly gravity: Vector2 = vec2(0, -9.80665)) {}

  acceleration(): Vector2 {
    return this.gravity;
  }
}

/** Hook for combining multiple physical laws into one simulation. */
export class PhysicsWorld {
  constructor(
    public state: BodyState,
    public readonly laws: PhysicsLaw[] = [],
    public solver: Solver = eulerSolver,
  ) {}

  step(dt: number): void {
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
