import type { BodyState, PhysicsContext, Solver, Vector2 } from "./core";
import { add, eulerSolver } from "./core";
import type { Force } from "./quantities";
import type { SpatialField } from "./fields";
import type { Body, CollisionEvent, DistanceConstraint, WorldForceLaw } from "./world";
import { MultiBodyWorld } from "./world";

export interface SimulatedBody extends Body { readonly charge?: number; }

export interface NetForceModifier {
  readonly id: string;
  modifyForce(
    body: SimulatedBody,
    bodies: readonly SimulatedBody[],
    force: Force,
    context: PhysicsContext,
  ): Force;
}

export interface SimulationConfig {
  laws?: WorldForceLaw[];
  fields?: SpatialField[];
  constraints?: DistanceConstraint[];
  forceModifiers?: NetForceModifier[];
  solver?: Solver;
  restitutionVelocityThreshold?: number;
}

/** Explicit simulation pipeline: forces -> integration -> constraints -> collisions -> time. */
export class PhysicsSimulation extends MultiBodyWorld {
  readonly fields: SpatialField[];
  readonly forceModifiers: NetForceModifier[];

  constructor(config: SimulationConfig = {}) {
    super(
      config.laws ?? [],
      config.solver ?? eulerSolver,
      config.constraints ?? [],
      config.restitutionVelocityThreshold ?? 0,
    );
    this.fields = config.fields ?? [];
    this.forceModifiers = config.forceModifiers ?? [];
  }

  addField(field: SpatialField): void { this.fields.push(field); }

  removeField(id: string): boolean {
    const index = this.fields.findIndex((field) => field.id === id);
    if (index < 0) return false;
    this.fields.splice(index, 1);
    return true;
  }

  refreshAccelerations(): void {
    const context: PhysicsContext = { time: this.currentTime, dt: 1 / 60 };
    for (const body of this.allBodies as readonly SimulatedBody[]) {
      if (body.fixed) continue;
      const force = this.totalForce(body, context);
      body.state.acceleration = {
        x: force.vector.x / body.state.mass,
        y: force.vector.y / body.state.mass,
      };
    }
  }

  /** Returns the same force components used by the integrator, including modifier deltas. */
  forceBreakdown(bodyId: string, dt = 1 / 60): readonly Force[] {
    const body = this.getBody(bodyId) as SimulatedBody | undefined;
    if (!body) return [];
    const context: PhysicsContext = { time: this.currentTime, dt };
    let vector: Vector2 = { x: 0, y: 0 };
    const components: Force[] = [];
    for (const law of this.laws) {
      const force = law.forceOnBody(body, this.allBodies, context);
      components.push({ vector: { ...force.vector }, source: force.source ?? law.id });
      vector = add(vector, force.vector);
    }
    for (const field of this.fields) {
      const force = field.forceAt(body.state as BodyState & { charge?: number }, context);
      components.push({ vector: { ...force.vector }, source: force.source ?? field.id });
      vector = add(vector, force.vector);
    }
    let combined: Force = { vector, source: "simulation-net" };
    for (const modifier of this.forceModifiers) {
      const next = modifier.modifyForce(body, this.allBodies as readonly SimulatedBody[], combined, context);
      components.push({
        vector: {
          x: next.vector.x - combined.vector.x,
          y: next.vector.y - combined.vector.y,
        },
        source: modifier.id,
      });
      combined = next;
    }
    return components;
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
    const components = this.forceBreakdown(body.id, context.dt);
    return {
      vector: components.reduce(
        (sum, force) => add(sum, force.vector),
        { x: 0, y: 0 },
      ),
      source: "simulation-net",
    };
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
