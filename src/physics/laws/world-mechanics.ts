import type { BodyState, PhysicsContext, Vector2 } from "../core";
import type { Force } from "../quantities";
import type { Body, WorldForceLaw } from "../world";
import type { NetForceModifier, SimulatedBody } from "../simulation";

const zeroForce = (source: string): Force => ({ vector: { x: 0, y: 0 }, source });

export interface AnchoredSpringOptions {
  bodyId: string;
  anchor: Vector2;
  stiffness: number;
  restLength: number;
  damping?: number;
}

/** Hooke's law for one body connected to a fixed anchor: F = -kx - bv. */
export class AnchoredSpringLaw implements WorldForceLaw {
  readonly id: string;
  readonly bodyId: string;
  anchor: Vector2;
  stiffness: number;
  restLength: number;
  damping: number;

  constructor(options: AnchoredSpringOptions) {
    this.bodyId = options.bodyId;
    this.id = `spring.anchor.${options.bodyId}`;
    this.anchor = { ...options.anchor };
    this.stiffness = options.stiffness;
    this.restLength = options.restLength;
    this.damping = options.damping ?? 0;
    this.validate();
  }

  setGeometry(anchor: Vector2, restLength: number): void {
    this.anchor = { ...anchor };
    this.restLength = restLength;
    this.validate();
  }

  force(state: BodyState, _context: PhysicsContext): Force {
    const dx = state.position.x - this.anchor.x;
    const dy = state.position.y - this.anchor.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return zeroForce(this.id);

    const nx = dx / length;
    const ny = dy / length;
    const extension = length - this.restLength;
    const radialVelocity = state.velocity.x * nx + state.velocity.y * ny;
    const magnitude = -this.stiffness * extension - this.damping * radialVelocity;
    return {
      vector: { x: magnitude * nx || 0, y: magnitude * ny || 0 },
      source: this.id,
    };
  }

  forceOnBody(body: Body, _bodies: readonly Body[], context: PhysicsContext): Force {
    return body.id === this.bodyId ? this.force(body.state, context) : zeroForce(this.id);
  }

  private validate(): void {
    if (this.stiffness < 0) throw new RangeError("Spring stiffness must be non-negative.");
    if (this.restLength < 0) throw new RangeError("Spring rest length must be non-negative.");
    if (this.damping < 0) throw new RangeError("Spring damping must be non-negative.");
  }
}

export interface HorizontalGroundFrictionOptions {
  surfaceY: number;
  normalAcceleration: number;
  contactTolerance?: number;
}

/** Applies static or kinetic friction after all other forces have been combined. */
export class HorizontalGroundFrictionModifier implements NetForceModifier {
  readonly id = "friction.ground.horizontal";
  surfaceY: number;
  normalAcceleration: number;
  contactTolerance: number;
  private readonly excludedBodyIds = new Set<string>();

  constructor(options: HorizontalGroundFrictionOptions) {
    this.surfaceY = options.surfaceY;
    this.normalAcceleration = options.normalAcceleration;
    this.contactTolerance = options.contactTolerance ?? 2;
    this.validate();
  }

  setSurfaceY(surfaceY: number): void {
    this.surfaceY = surfaceY;
    this.validate();
  }

  setNormalAcceleration(normalAcceleration: number): void {
    this.normalAcceleration = normalAcceleration;
    this.validate();
  }

  excludeBody(id: string): void { this.excludedBodyIds.add(id); }
  clearExcludedBodies(): void { this.excludedBodyIds.clear(); }

  modifyForce(body: SimulatedBody, force: Force, context: PhysicsContext): Force {
    const kineticCoefficient = body.kineticFriction ?? 0;
    const staticCoefficient = body.staticFriction ?? kineticCoefficient;
    if (
      body.fixed
      || this.excludedBodyIds.has(body.id)
      || this.normalAcceleration === 0
      || (staticCoefficient === 0 && kineticCoefficient === 0)
      || Math.abs(this.bodyBottom(body) - this.surfaceY) > this.contactTolerance
    ) {
      return force;
    }

    const speed = Math.abs(body.state.velocity.x);
    const maximumStaticFriction = staticCoefficient * body.state.mass * this.normalAcceleration;
    if (speed < 0.01 && Math.abs(force.vector.x) <= maximumStaticFriction) {
      return { vector: { x: 0, y: force.vector.y }, source: this.id };
    }

    const direction = speed >= 0.01
      ? Math.sign(body.state.velocity.x)
      : Math.sign(force.vector.x);
    const kineticFriction = kineticCoefficient * body.state.mass * this.normalAcceleration;
    let horizontalForce = force.vector.x - direction * kineticFriction;
    if (speed >= 0.01) {
      const nextVelocity = body.state.velocity.x + horizontalForce / body.state.mass * context.dt;
      if (body.state.velocity.x * nextVelocity <= 0) {
        horizontalForce = -body.state.mass * body.state.velocity.x / context.dt;
      }
    }
    return {
      vector: { x: horizontalForce, y: force.vector.y },
      source: this.id,
    };
  }

  private bodyBottom(body: Body): number {
    const halfHeight = body.collider?.kind === "box"
      ? body.collider.halfHeight
      : body.collider?.kind === "circle" ? body.collider.radius : body.radius ?? 0;
    return body.state.position.y + halfHeight;
  }

  private validate(): void {
    if (!Number.isFinite(this.surfaceY)) throw new RangeError("Surface position must be finite.");
    if (!Number.isFinite(this.normalAcceleration) || this.normalAcceleration < 0) {
      throw new RangeError("Normal acceleration must be finite and non-negative.");
    }
    if (!Number.isFinite(this.contactTolerance) || this.contactTolerance < 0) {
      throw new RangeError("Contact tolerance must be finite and non-negative.");
    }
  }
}

export interface HorizontalSurfaceFrictionOptions {
  bodyId: string;
  surfaceY: number;
  coefficient: number;
  normalAcceleration: number;
  contactTolerance?: number;
}

/** Kinetic friction on a flat surface, capped so a slow body never reverses: F = μN. */
export class HorizontalSurfaceFrictionLaw implements WorldForceLaw {
  readonly id: string;
  readonly bodyId: string;
  surfaceY: number;
  coefficient: number;
  normalAcceleration: number;
  contactTolerance: number;

  constructor(options: HorizontalSurfaceFrictionOptions) {
    this.bodyId = options.bodyId;
    this.id = `friction.surface.${options.bodyId}`;
    this.surfaceY = options.surfaceY;
    this.coefficient = options.coefficient;
    this.normalAcceleration = options.normalAcceleration;
    this.contactTolerance = options.contactTolerance ?? 2;
    this.validate();
  }

  setSurfaceY(surfaceY: number): void { this.surfaceY = surfaceY; }

  setCoefficient(coefficient: number): void {
    this.coefficient = coefficient;
    this.validate();
  }

  setNormalAcceleration(normalAcceleration: number): void {
    this.normalAcceleration = normalAcceleration;
    this.validate();
  }

  force(state: BodyState, context: PhysicsContext): Force {
    const speed = Math.abs(state.velocity.x);
    if (speed === 0 || this.coefficient === 0 || this.normalAcceleration === 0) {
      return zeroForce(this.id);
    }
    const maximumFriction = this.coefficient * state.mass * this.normalAcceleration;
    const stoppingForce = state.mass * speed / context.dt;
    const magnitude = Math.min(maximumFriction, stoppingForce);
    return {
      vector: { x: -Math.sign(state.velocity.x) * magnitude, y: 0 },
      source: this.id,
    };
  }

  forceOnBody(body: Body, _bodies: readonly Body[], context: PhysicsContext): Force {
    const bottom = body.state.position.y + (body.radius ?? 0);
    if (body.id !== this.bodyId || Math.abs(bottom - this.surfaceY) > this.contactTolerance) {
      return zeroForce(this.id);
    }
    return this.force(body.state, context);
  }

  private validate(): void {
    if (this.coefficient < 0) throw new RangeError("Friction coefficient must be non-negative.");
    if (this.normalAcceleration < 0) throw new RangeError("Normal acceleration must be non-negative.");
    if (this.contactTolerance < 0) throw new RangeError("Contact tolerance must be non-negative.");
  }
}

export interface PushFrictionOptions {
  bodyId: string;
  surfaceY: number;
  staticCoefficient: number;
  kineticCoefficient: number;
  normalAcceleration: number;
  contactTolerance?: number;
}

export type PushFrictionStatus = "holding" | "moving";

/** Static and kinetic friction for a body that the learner pushes or pulls directly. */
export class PushFrictionLaw implements WorldForceLaw {
  readonly id: string;
  readonly bodyId: string;
  surfaceY: number;
  staticCoefficient: number;
  kineticCoefficient: number;
  normalAcceleration: number;
  contactTolerance: number;
  appliedForce = 0;

  constructor(options: PushFrictionOptions) {
    this.bodyId = options.bodyId;
    this.id = `friction.push.${options.bodyId}`;
    this.surfaceY = options.surfaceY;
    this.staticCoefficient = options.staticCoefficient;
    this.kineticCoefficient = options.kineticCoefficient;
    this.normalAcceleration = options.normalAcceleration;
    this.contactTolerance = options.contactTolerance ?? 2;
    this.validate();
  }

  setAppliedForce(force: number): void {
    if (!Number.isFinite(force)) throw new RangeError("Applied force must be finite.");
    this.appliedForce = force;
  }

  setSurfaceY(surfaceY: number): void {
    if (!Number.isFinite(surfaceY)) throw new RangeError("Surface position must be finite.");
    this.surfaceY = surfaceY;
  }

  setCoefficients(staticCoefficient: number, kineticCoefficient: number): void {
    this.staticCoefficient = staticCoefficient;
    this.kineticCoefficient = kineticCoefficient;
    this.validate();
  }

  setNormalAcceleration(normalAcceleration: number): void {
    this.normalAcceleration = normalAcceleration;
    this.validate();
  }

  maximumStaticForce(state: BodyState): number {
    return this.staticCoefficient * state.mass * this.normalAcceleration;
  }

  status(state: BodyState): PushFrictionStatus {
    const nearlyStopped = Math.abs(state.velocity.x) < 0.01;
    return nearlyStopped && Math.abs(this.appliedForce) <= this.maximumStaticForce(state)
      ? "holding"
      : "moving";
  }

  force(state: BodyState, context: PhysicsContext): Force {
    if (this.status(state) === "holding") return zeroForce(this.id);

    const direction = Math.abs(state.velocity.x) >= 0.01
      ? Math.sign(state.velocity.x)
      : Math.sign(this.appliedForce);
    const kineticFriction = this.kineticCoefficient * state.mass * this.normalAcceleration;
    let netForce = this.appliedForce - direction * kineticFriction;
    const wouldReverse = state.velocity.x * netForce < 0
      && Math.abs(netForce) * context.dt / state.mass >= Math.abs(state.velocity.x);
    if (wouldReverse) netForce = -state.mass * state.velocity.x / context.dt;
    return {
      vector: { x: netForce, y: 0 },
      source: this.id,
    };
  }

  forceOnBody(body: Body, _bodies: readonly Body[], context: PhysicsContext): Force {
    const bottom = body.state.position.y + (body.radius ?? 0);
    if (body.id !== this.bodyId || Math.abs(bottom - this.surfaceY) > this.contactTolerance) {
      return zeroForce(this.id);
    }
    return this.force(body.state, context);
  }

  private validate(): void {
    if (!Number.isFinite(this.surfaceY)) throw new RangeError("Surface position must be finite.");
    if (this.staticCoefficient < 0) throw new RangeError("Static friction coefficient must be non-negative.");
    if (this.kineticCoefficient < 0) throw new RangeError("Kinetic friction coefficient must be non-negative.");
    if (this.normalAcceleration < 0) throw new RangeError("Normal acceleration must be non-negative.");
    if (this.contactTolerance < 0) throw new RangeError("Contact tolerance must be non-negative.");
  }
}

export interface BuoyancyRegionOptions {
  bodyId: string;
  waterline: number;
  displacedMass: number;
  gravityAcceleration: number;
  drag?: number;
}

/** Archimedes buoyancy for a circular body entering a horizontal fluid region. */
export class BuoyancyRegionLaw implements WorldForceLaw {
  readonly id: string;
  readonly bodyId: string;
  waterline: number;
  displacedMass: number;
  gravityAcceleration: number;
  drag: number;

  constructor(options: BuoyancyRegionOptions) {
    this.bodyId = options.bodyId;
    this.id = `fluid.buoyancy.${options.bodyId}`;
    this.waterline = options.waterline;
    this.displacedMass = options.displacedMass;
    this.gravityAcceleration = options.gravityAcceleration;
    this.drag = options.drag ?? 1.8;
    this.validate();
  }

  setWaterline(waterline: number): void { this.waterline = waterline; }
  setGravityAcceleration(value: number): void {
    this.gravityAcceleration = value;
    this.validate();
  }

  force(state: BodyState, _context: PhysicsContext): Force {
    return zeroForce(this.id);
  }

  forceOnBody(body: Body, _bodies: readonly Body[], _context: PhysicsContext): Force {
    if (body.id !== this.bodyId || !body.radius) return zeroForce(this.id);
    const submergedFraction = Math.max(0, Math.min(
      1,
      (body.state.position.y + body.radius - this.waterline) / (body.radius * 2),
    ));
    if (submergedFraction === 0) return zeroForce(this.id);
    const dragFactor = this.drag * submergedFraction * body.state.mass;
    const buoyantForce = this.displacedMass * this.gravityAcceleration * submergedFraction;
    return {
      vector: {
        x: -body.state.velocity.x * dragFactor,
        y: -buoyantForce - body.state.velocity.y * dragFactor,
      },
      source: this.id,
    };
  }

  private validate(): void {
    if (this.displacedMass <= 0) throw new RangeError("Displaced mass must be greater than zero.");
    if (this.gravityAcceleration < 0) throw new RangeError("Gravity acceleration must be non-negative.");
    if (this.drag < 0) throw new RangeError("Fluid drag must be non-negative.");
  }
}
