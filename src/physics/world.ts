import type { ForceLaw, Force } from "./quantities";
import type { BodyState, PhysicsContext, Solver, Vector2 } from "./core";
import { add, eulerSolver, magnitude, scale, sub } from "./core";

export interface Body {
  readonly id: string;
  state: BodyState;
  radius?: number;
  collider?: BodyCollider;
  restitution?: number;
  staticFriction?: number;
  kineticFriction?: number;
  readonly fixed?: boolean;
}

export type BodyCollider =
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "box"; readonly halfWidth: number; readonly halfHeight: number };

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

interface CollisionManifold {
  readonly normal: Vector2;
  readonly penetration: number;
}

const bodyCollider = (body: Body): BodyCollider | null =>
  body.collider ?? (body.radius ? { kind: "circle", radius: body.radius } : null);

const circleBoxManifold = (
  circleBody: Body,
  circle: Extract<BodyCollider, { kind: "circle" }>,
  boxBody: Body,
  box: Extract<BodyCollider, { kind: "box" }>,
): CollisionManifold | null => {
  const localX = circleBody.state.position.x - boxBody.state.position.x;
  const localY = circleBody.state.position.y - boxBody.state.position.y;
  const closestX = Math.max(-box.halfWidth, Math.min(box.halfWidth, localX));
  const closestY = Math.max(-box.halfHeight, Math.min(box.halfHeight, localY));
  const towardBox = { x: closestX - localX, y: closestY - localY };
  const distance = magnitude(towardBox);

  if (distance > 0) {
    if (distance >= circle.radius) return null;
    return { normal: scale(towardBox, 1 / distance), penetration: circle.radius - distance };
  }

  const distanceToVerticalEdge = box.halfWidth - Math.abs(localX);
  const distanceToHorizontalEdge = box.halfHeight - Math.abs(localY);
  if (distanceToVerticalEdge < distanceToHorizontalEdge) {
    const outward = localX >= 0 ? 1 : -1;
    return {
      normal: { x: -outward, y: 0 },
      penetration: circle.radius + distanceToVerticalEdge,
    };
  }
  const outward = localY >= 0 ? 1 : -1;
  return {
    normal: { x: 0, y: -outward },
    penetration: circle.radius + distanceToHorizontalEdge,
  };
};

const collisionManifold = (a: Body, b: Body): CollisionManifold | null => {
  const colliderA = bodyCollider(a);
  const colliderB = bodyCollider(b);
  if (!colliderA || !colliderB) return null;

  if (colliderA.kind === "circle" && colliderB.kind === "circle") {
    const delta = sub(b.state.position, a.state.position);
    const distance = magnitude(delta);
    const radius = colliderA.radius + colliderB.radius;
    if (distance >= radius) return null;
    return { normal: normalize(delta), penetration: radius - distance };
  }

  if (colliderA.kind === "box" && colliderB.kind === "box") {
    const delta = sub(b.state.position, a.state.position);
    const overlapX = colliderA.halfWidth + colliderB.halfWidth - Math.abs(delta.x);
    const overlapY = colliderA.halfHeight + colliderB.halfHeight - Math.abs(delta.y);
    if (overlapX <= 0 || overlapY <= 0) return null;
    return overlapX < overlapY
      ? { normal: { x: delta.x >= 0 ? 1 : -1, y: 0 }, penetration: overlapX }
      : { normal: { x: 0, y: delta.y >= 0 ? 1 : -1 }, penetration: overlapY };
  }

  if (colliderA.kind === "circle" && colliderB.kind === "box") {
    return circleBoxManifold(a, colliderA, b, colliderB);
  }

  const manifold = circleBoxManifold(
    b,
    colliderB as Extract<BodyCollider, { kind: "circle" }>,
    a,
    colliderA as Extract<BodyCollider, { kind: "box" }>,
  );
  return manifold && {
    normal: scale(manifold.normal, -1),
    penetration: manifold.penetration,
  };
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

  addLaw(law: WorldForceLaw): void {
    if (this.laws.some((activeLaw) => activeLaw.id === law.id)) {
      throw new Error(`Force law already exists: ${law.id}`);
    }
    this.laws.push(law);
  }

  removeLaw(id: string): boolean {
    const index = this.laws.findIndex((law) => law.id === id);
    if (index < 0) return false;
    this.laws.splice(index, 1);
    return true;
  }

  addConstraint(constraint: DistanceConstraint): void {
    if (this.constraints.some((active) => active.id === constraint.id)) {
      throw new Error(`Distance constraint already exists: ${constraint.id}`);
    }
    if (constraint.bodyA === constraint.bodyB) {
      throw new Error("Distance constraint endpoints must be different bodies.");
    }
    if (!this.bodies.has(constraint.bodyA) || !this.bodies.has(constraint.bodyB)) {
      throw new Error("Distance constraint bodies must exist in the world.");
    }
    if (!Number.isFinite(constraint.distance) || constraint.distance <= 0) {
      throw new RangeError("Distance constraint length must be greater than zero.");
    }
    this.constraints.push(constraint);
  }

  removeConstraint(id: string): boolean {
    const index = this.constraints.findIndex((constraint) => constraint.id === id);
    if (index < 0) return false;
    this.constraints.splice(index, 1);
    return true;
  }

  removeBody(id: string): boolean {
    const removed = this.bodies.delete(id);
    if (!removed) return false;
    for (let index = this.constraints.length - 1; index >= 0; index -= 1) {
      const constraint = this.constraints[index];
      if (constraint.bodyA === id || constraint.bodyB === id) this.constraints.splice(index, 1);
    }
    return true;
  }
  getBody(id: string): Body | undefined { return this.bodies.get(id); }
  get allBodies(): readonly Body[] { return [...this.bodies.values()]; }
  get currentTime(): number { return this.time; }

  clear(): void {
    this.bodies.clear();
    this.constraints.length = 0;
    this.collisions.length = 0;
    this.time = 0;
  }

  step(dt: number): void {
    if (dt <= 0) throw new RangeError("Time step must be greater than zero.");
    const context: PhysicsContext = { time: this.time, dt };
    this.integrateBodies(dt, context);
    this.resolveConstraints();
    this.resolveCollisions();
    this.time += dt;
  }

  /** Re-applies geometric links after direct manipulation without advancing time. */
  satisfyConstraints(): void {
    this.resolveConstraints();
  }

  /** Advances body states using forces evaluated for each body in this world. */
  protected integrateBodies(_dt: number, context: PhysicsContext): void {
    for (const body of this.allBodies) {
      if (body.fixed) continue;
      const bodyLaws: ForceLaw[] = this.laws.map((law) => ({
        id: law.id,
        force: () => law.forceOnBody(body, this.allBodies, context),
      }));
      body.state = this.solver.step(body.state, bodyLaws, context);
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
      const inverseMassA = a.fixed ? 0 : 1 / a.state.mass;
      const inverseMassB = b.fixed ? 0 : 1 / b.state.mass;
      const totalInverseMass = inverseMassA + inverseMassB;
      if (totalInverseMass === 0) continue;
      const correction = error * (constraint.stiffness ?? 1) / totalInverseMass;
      if (!a.fixed) {
        a.state.position = add(a.state.position, scale(normal, correction * inverseMassA));
      }
      if (!b.fixed) {
        b.state.position = sub(b.state.position, scale(normal, correction * inverseMassB));
      }

      const relativeNormalSpeed = (
        (b.state.velocity.x - a.state.velocity.x) * normal.x
        + (b.state.velocity.y - a.state.velocity.y) * normal.y
      );
      const velocityCorrection = relativeNormalSpeed / totalInverseMass;
      if (!a.fixed) {
        a.state.velocity = add(a.state.velocity, scale(normal, velocityCorrection * inverseMassA));
      }
      if (!b.fixed) {
        b.state.velocity = sub(b.state.velocity, scale(normal, velocityCorrection * inverseMassB));
      }
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
        const manifold = collisionManifold(a, b);
        if (!manifold) continue;
        const { normal, penetration } = manifold;
        const relativeVelocity = sub(b.state.velocity, a.state.velocity);
        const normalVelocity = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
        const restitution = Math.min(a.restitution ?? 1, b.restitution ?? 1);
        const inverseMassA = a.fixed ? 0 : 1 / a.state.mass;
        const inverseMassB = b.fixed ? 0 : 1 / b.state.mass;
        const totalInverseMass = inverseMassA + inverseMassB;

        // Keep resting or slowly moving contacts from remaining interpenetrated.
        if (totalInverseMass > 0) {
          const correction = scale(normal, penetration / totalInverseMass);
          if (!a.fixed) a.state.position = sub(a.state.position, scale(correction, inverseMassA));
          if (!b.fixed) b.state.position = add(b.state.position, scale(correction, inverseMassB));
        }

        if (normalVelocity < 0) {
          const impulse = -(1 + restitution) * normalVelocity / (inverseMassA + inverseMassB);
          if (!a.fixed) a.state.velocity = sub(a.state.velocity, scale(normal, impulse * inverseMassA));
          if (!b.fixed) b.state.velocity = add(b.state.velocity, scale(normal, impulse * inverseMassB));
          this.collisions.push({ bodyA: a.id, bodyB: b.id, normal, impulse });
        }
      }
    }
  }
}
