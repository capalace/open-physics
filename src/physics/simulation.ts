import type { BodyState, PhysicsContext, Solver, Vector2 } from "./core";
import { add, eulerSolver } from "./core";
import type { Force } from "./quantities";
import type { SpatialField } from "./fields";
import type { Body, CollisionEvent, DistanceConstraint, WorldForceLaw } from "./world";
import { MultiBodyWorld } from "./world";

export interface SimulatedBody extends Body { readonly charge?: number; }

export interface SimulationConfig {
  laws?: WorldForceLaw[];
  fields?: SpatialField[];
  constraints?: DistanceConstraint[];
  solver?: Solver;
}

/** Explicit simulation pipeline: forces -> integration -> constraints -> collisions -> time. */
export class PhysicsSimulation extends MultiBodyWorld {
  readonly fields: SpatialField[];

  constructor(config: SimulationConfig = {}) {
    super(config.laws ?? [], config.solver ?? eulerSolver, config.constraints ?? []);
    this.fields = config.fields ?? [];
  }

  addField(field: SpatialField): void { this.fields.push(field); }

  removeField(id: string): boolean {
    const index = this.fields.findIndex((field) => field.id === id);
    if (index < 0) return false;
    this.fields.splice(index, 1);
    return true;
  }

  step(dt: number): void {
    if (dt <= 0) throw new RangeError("Time step must be greater than zero.");
    const context: PhysicsContext = { time: this.currentTime, dt };

    // 1. Evaluate all active equations and fields, then integrate once.
    for (const body of this.allBodies as readonly SimulatedBody[]) {
      if (body.fixed) continue;
      const force = this.totalForce(body, context);
      body.state = this.solver.step(body.state, [singleForceLaw(force)], context);
    }

    // 2. Correct geometric constraints after integration.
    this.resolveConstraints();

    // 3. Resolve contacts/impulses after positions have been integrated.
    this.resolveCollisions();

    // 4. Advance simulation clock exactly once.
    this.time += dt;
  }

  private totalForce(body: SimulatedBody, context: PhysicsContext): Force {
    let vector: Vector2 = { x: 0, y: 0 };
    for (const law of this.laws) vector = add(vector, law.forceOnBody(body, this.allBodies, context).vector);
    for (const field of this.fields) vector = add(vector, field.forceAt(body.state as BodyState & { charge?: number }, context).vector);
    return { vector, source: "simulation-net" };
  }

  get collisionEvents(): readonly CollisionEvent[] { return this.collisions; }
}

const singleForceLaw = (force: Force): WorldForceLaw => ({
  id: "simulation-net-force",
  force: () => force,
  forceOnBody: () => force,
});

export const netFieldForce = (
  fields: readonly SpatialField[],
  state: BodyState & { charge?: number },
  context: PhysicsContext,
): Force => {
  let vector: Vector2 = { x: 0, y: 0 };
  for (const field of fields) vector = add(vector, field.forceAt(state, context).vector);
  return { vector, source: "fields-net" };
};
