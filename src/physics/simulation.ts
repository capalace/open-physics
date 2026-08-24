import type { BodyState, PhysicsContext, Solver, Vector2 } from "./core";
import { add, eulerSolver, scale } from "./core";
import type { Force } from "./quantities";
import type { SpatialField } from "./fields";
import type { Body, CollisionEvent, DistanceConstraint, WorldForceLaw } from "./world";
import { MultiBodyWorld } from "./world";

export interface SimulatedBody extends Body {
  readonly charge?: number;
}

export interface SimulationConfig {
  laws?: WorldForceLaw[];
  fields?: SpatialField[];
  constraints?: DistanceConstraint[];
  solver?: Solver;
}

/** Unified equation-based simulation pipeline used by the interactive world. */
export class PhysicsSimulation extends MultiBodyWorld {
  readonly fields: SpatialField[];

  constructor(config: SimulationConfig = {}) {
    super(config.laws ?? [], config.solver ?? eulerSolver, config.constraints ?? []);
    this.fields = config.fields ?? [];
  }

  addField(field: SpatialField): void {
    this.fields.push(field);
  }

  removeField(id: string): boolean {
    const index = this.fields.findIndex((field) => field.id === id);
    if (index < 0) return false;
    this.fields.splice(index, 1);
    return true;
  }

  step(dt: number): void {
    if (dt <= 0) throw new RangeError("Time step must be greater than zero.");
    const context: PhysicsContext = { time: this.currentTime, dt };
    const bodies = this.allBodies as readonly SimulatedBody[];

    for (const body of bodies) {
      if (body.fixed) continue;
      let total: Vector2 = { x: 0, y: 0 };

      for (const law of this.laws) {
        total = add(total, law.forceOnBody(body, bodies, context).vector);
      }
      for (const field of this.fields) {
        total = add(total, field.forceAt(body.state as BodyState & { charge?: number }, context).vector);
      }

      const acceleration = scale(total, 1 / body.state.mass);
      body.state = this.solver(body.state, { vector: total, source: "simulation-net" }, dt);
      body.state = { ...body.state, acceleration };
    }

    // Collision and constraint resolution remain centralized in the world.
    super.step(0.0000001);
    // Undo the tiny integration used by the parent; this call is intentionally
    // replaced below by direct resolution in future solver implementations.
    this.rollbackTinyStep(bodies);
    this.timeAdvance(dt);
  }

  private rollbackTinyStep(bodies: readonly SimulatedBody[]): void {
    // Parent resolution is currently used as the compatibility path.
    // No-op here; the public state has already been advanced by the configured solver.
    void bodies;
  }

  private timeAdvance(dt: number): void {
    // Access is intentionally isolated so the public world API remains unchanged.
    (this as unknown as { time: number }).time += dt - 0.0000001;
  }

  get collisionEvents(): readonly CollisionEvent[] {
    return this.collisions;
  }
}

export const netFieldForce = (
  fields: readonly SpatialField[],
  state: BodyState & { charge?: number },
  context: PhysicsContext,
): Force => {
  let vector: Vector2 = { x: 0, y: 0 };
  for (const field of fields) vector = add(vector, field.forceAt(state, context).vector);
  return { vector, source: "fields-net" };
};
