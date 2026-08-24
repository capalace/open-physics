import type { ForceLaw, Force } from "./quantities";
import type { BodyState, PhysicsContext, Solver, Vector2 } from "./core";
import { add, eulerSolver, magnitude, scale, sub } from "./core";

export interface Body {
  readonly id: string;
  state: BodyState;
  readonly radius?: number;
  readonly restitution?: number;
  readonly fixed?: boolean;
}

export interface WorldForceLaw extends ForceLaw {
  forceOnBody(body: Body, bodies: readonly Body[], context: PhysicsContext): Force;
}

export interface DistanceConstraint {
  readonly id: string;
  readonly bodyA: string;
  readonly bodyB: string;
  readonly distance: number;
  readonly stiffness?: number;
}

export interface CollisionEvent {
  readonly bodyA: string;
  readonly bodyB: string;
  readonly normal: Vector2;
  readonly impulse: number;
}

const normalize = (v: Vector2): Vector2 => {
  const length = magnitude(v);
  return length === 0 ? { x: 1, y: 0 } : scale(v, 1 / length);
};

/** A 2D multi-body world for educational, equation-based simulation. */
export class MultiBodyWorld {
  protected time = 0;
  private readonly bodies = new Map<string, Body>();
  readonly collisions: CollisionEvent[] = [];

  constructor(
    public readonly laws: WorldForceLaw[] = [],
    public solver: Solver = eulerSolver,
    public readonly constraints: DistanceConstraint[] = [],
  ) {}

  addBody(body: Body): void {
    if (body.state.mass <= 0) throw new RangeError("Mass must be greater than zero.");
    if (this.bodies.has(body.id)) throw new Error(`Body already exists: ${body.id}`);
    this.bodies.set(body.id, body);
  }

  removeBody(id: string): boolean { return this.bodies.delete(id); }
  getBody(id: string): Body | undefined { return this.bodies.get(id); }
  get allBodies(): readonly Body[] { return [...this.bodies.values()]; }
  get currentTime(): number { return this.time; }

  step(dt: number): void {
    if (dt <= 0) throw new RangeError("Time step must be greater than zero.");
    const context: PhysicsContext = { time: this.time, dt };
    this.integrateBodies(dt, context);
    this.resolveConstraints();
    this.resolveCollisions();
    this.time += dt;
  }

  /** Advances body states using the configured numerical solver. */
  protected integrateBodies(dt: number, context: PhysicsContext): void {
    for (const body of this.allBodies) {
      if (body.fixed) continue;
      body.state = this.solver.step(body.state, this.laws, context);
      void dt;
    }
  }

  protected resolveConstraints(): void {
    for (const constraint of this.constraints) {
      const a = this.bodies.get(constraint.bodyA);
      const b = this.bodies.get(constraint.bodyB);
      if (!a || !b) continue;
      const delta = sub(b.state.position, a.state.position);
      const distance = magnitude(delta);
      if (distance === 0) continue;
      const error = distance - constraint.distance;
      const normal = normalize(delta);
      const correction = scale(normal, error * (constraint.stiffness ?? 1) * 0.5);
      if (!a.fixed) a.state.position = add(a.state.position, correction);
      if (!b.fixed) b.state.position = sub(b.state.position, correction);
    }
  }

  protected resolveCollisions(): void {
    this.collisions.length = 0;
    const bodies = this.allBodies;
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.fixed && b.fixed) continue;
        const radius = (a.radius ?? 0) + (b.radius ?? 0);
        if (radius <= 0) continue;
        const delta = sub(b.state.position, a.state.position);
        const distance = magnitude(delta);
        if (distance >= radius) continue;
        const normal = normalize(delta);
        const relativeVelocity = sub(b.state.velocity, a.state.velocity);
        const normalVelocity = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
        const restitution = Math.min(a.restitution ?? 1, b.restitution ?? 1);
        if (normalVelocity < 0) {
          const inverseMassA = a.fixed ? 0 : 1 / a.state.mass;
          const inverseMassB = b.fixed ? 0 : 1 / b.state.mass;
          const impulse = -(1 + restitution) * normalVelocity / (inverseMassA + inverseMassB);
          if (!a.fixed) a.state.velocity = sub(a.state.velocity, scale(normal, impulse * inverseMassA));
          if (!b.fixed) b.state.velocity = add(b.state.velocity, scale(normal, impulse * inverseMassB));
          this.collisions.push({ bodyA: a.id, bodyB: b.id, normal, impulse });
        }
      }
    }
  }
}
