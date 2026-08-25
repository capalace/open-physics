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
  | { readonly kind: "box"; readonly halfWidth: number; readonly halfHeight: number; readonly angle?: number };

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

export interface CollisionContact {
  readonly normal: Vector2;
  readonly penetration: number;
}

const bodyCollider = (body: Body): BodyCollider | null =>
  body.collider ?? (body.radius ? { kind: "circle", radius: body.radius } : null);

const rotate = (vector: Vector2, angle: number): Vector2 => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});

const boxAxes = (box: Extract<BodyCollider, { kind: "box" }>): [Vector2, Vector2] => {
  const angle = box.angle ?? 0;
  return [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ];
};

const circleBoxManifold = (
  circleBody: Body,
  circle: Extract<BodyCollider, { kind: "circle" }>,
  boxBody: Body,
  box: Extract<BodyCollider, { kind: "box" }>,
  tolerance: number,
): CollisionContact | null => {
  const angle = box.angle ?? 0;
  const local = rotate(sub(circleBody.state.position, boxBody.state.position), -angle);
  const localX = local.x;
  const localY = local.y;
  const closestX = Math.max(-box.halfWidth, Math.min(box.halfWidth, localX));
  const closestY = Math.max(-box.halfHeight, Math.min(box.halfHeight, localY));
  const towardBox = { x: closestX - localX, y: closestY - localY };
  const distance = magnitude(towardBox);

  if (distance > 0) {
    if (distance > circle.radius + tolerance) return null;
    return {
      normal: rotate(scale(towardBox, 1 / distance), angle),
      penetration: Math.max(0, circle.radius - distance),
    };
  }

  const distanceToVerticalEdge = box.halfWidth - Math.abs(localX);
  const distanceToHorizontalEdge = box.halfHeight - Math.abs(localY);
  if (distanceToVerticalEdge < distanceToHorizontalEdge) {
    const outward = localX >= 0 ? 1 : -1;
    return {
      normal: rotate({ x: -outward, y: 0 }, angle),
      penetration: circle.radius + distanceToVerticalEdge,
    };
  }
  const outward = localY >= 0 ? 1 : -1;
  return {
    normal: rotate({ x: 0, y: -outward }, angle),
    penetration: circle.radius + distanceToHorizontalEdge,
  };
};

const boxProjectionRadius = (
  box: Extract<BodyCollider, { kind: "box" }>,
  axis: Vector2,
): number => {
  const [horizontal, vertical] = boxAxes(box);
  return box.halfWidth * Math.abs(horizontal.x * axis.x + horizontal.y * axis.y)
    + box.halfHeight * Math.abs(vertical.x * axis.x + vertical.y * axis.y);
};

const boxBoxManifold = (
  a: Body,
  colliderA: Extract<BodyCollider, { kind: "box" }>,
  b: Body,
  colliderB: Extract<BodyCollider, { kind: "box" }>,
  tolerance: number,
): CollisionContact | null => {
  const delta = sub(b.state.position, a.state.position);
  let minimumOverlap = Number.POSITIVE_INFINITY;
  let minimumAxis: Vector2 = { x: 1, y: 0 };
  for (const axis of [...boxAxes(colliderA), ...boxAxes(colliderB)]) {
    const distance = Math.abs(delta.x * axis.x + delta.y * axis.y);
    const overlap = boxProjectionRadius(colliderA, axis) + boxProjectionRadius(colliderB, axis) - distance;
    if (overlap < -tolerance) return null;
    if (overlap < minimumOverlap) {
      minimumOverlap = overlap;
      minimumAxis = delta.x * axis.x + delta.y * axis.y >= 0 ? axis : scale(axis, -1);
    }
  }
  return { normal: minimumAxis, penetration: Math.max(0, minimumOverlap) };
};

/** Returns the contact normal from body A toward body B for circles and oriented boxes. */
export const collisionContact = (a: Body, b: Body, tolerance = 0): CollisionContact | null => {
  const colliderA = bodyCollider(a);
  const colliderB = bodyCollider(b);
  if (!colliderA || !colliderB) return null;

  if (colliderA.kind === "circle" && colliderB.kind === "circle") {
    const delta = sub(b.state.position, a.state.position);
    const distance = magnitude(delta);
    const radius = colliderA.radius + colliderB.radius;
    if (distance > radius + tolerance) return null;
    return { normal: normalize(delta), penetration: Math.max(0, radius - distance) };
  }

  if (colliderA.kind === "box" && colliderB.kind === "box") {
    return boxBoxManifold(a, colliderA, b, colliderB, tolerance);
  }

  if (colliderA.kind === "circle" && colliderB.kind === "box") {
    return circleBoxManifold(a, colliderA, b, colliderB, tolerance);
  }

  const manifold = circleBoxManifold(
    b,
    colliderB as Extract<BodyCollider, { kind: "circle" }>,
    a,
    colliderA as Extract<BodyCollider, { kind: "box" }>,
    tolerance,
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
    public readonly restitutionVelocityThreshold = 0,
  ) {
    if (!Number.isFinite(restitutionVelocityThreshold) || restitutionVelocityThreshold < 0) {
      throw new RangeError("Restitution velocity threshold must be a non-negative finite number.");
    }
  }

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
        const manifold = collisionContact(a, b);
        if (!manifold) continue;
        const { normal, penetration } = manifold;
        const relativeVelocity = sub(b.state.velocity, a.state.velocity);
        const normalVelocity = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
        const restitution = -normalVelocity < this.restitutionVelocityThreshold
          ? 0
          : Math.min(a.restitution ?? 1, b.restitution ?? 1);
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
          if (-normalVelocity >= this.restitutionVelocityThreshold) {
            this.collisions.push({ bodyA: a.id, bodyB: b.id, normal, impulse });
          }
        }
      }
    }
  }
}
