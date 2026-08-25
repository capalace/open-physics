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

export interface ConstantBodyForceOptions {
  bodyId: string;
  vector?: Vector2;
}

/** A learner-controlled force vector attached to one movable body. */
export class ConstantBodyForceLaw implements WorldForceLaw {
  readonly id: string;
  readonly bodyId: string;
  vector: Vector2;

  constructor(options: ConstantBodyForceOptions) {
    this.bodyId = options.bodyId;
    this.id = `force.constant.${options.bodyId}`;
    this.vector = { ...(options.vector ?? { x: 0, y: 0 }) };
    this.validate();
  }

  setVector(vector: Vector2): void {
    this.vector = { ...vector };
    this.validate();
  }

  force(_state: BodyState, _context: PhysicsContext): Force {
    return { vector: { ...this.vector }, source: this.id };
  }

  forceOnBody(body: Body, _bodies: readonly Body[], context: PhysicsContext): Force {
    return body.id === this.bodyId ? this.force(body.state, context) : zeroForce(this.id);
  }

  private validate(): void {
    if (!Number.isFinite(this.vector.x) || !Number.isFinite(this.vector.y)) {
      throw new RangeError("Constant force vector must be finite.");
    }
  }
}

export interface SurfaceContactFrictionOptions {
  floorY: number;
  normalAcceleration: number;
  contactTolerance?: number;
}

interface SurfaceContact {
  normal: Vector2;
  staticCoefficient: number;
  kineticCoefficient: number;
  floor: boolean;
}

interface BodyBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Applies static or kinetic friction along the floor and fixed-block contact surfaces. */
export class SurfaceContactFrictionModifier implements NetForceModifier {
  readonly id = "friction.surface.contact";
  floorY: number;
  normalAcceleration: number;
  contactTolerance: number;
  private readonly excludedBodyIds = new Set<string>();

  constructor(options: SurfaceContactFrictionOptions) {
    this.floorY = options.floorY;
    this.normalAcceleration = options.normalAcceleration;
    this.contactTolerance = options.contactTolerance ?? 2;
    this.validate();
  }

  setFloorY(floorY: number): void {
    this.floorY = floorY;
    this.validate();
  }

  setNormalAcceleration(normalAcceleration: number): void {
    this.normalAcceleration = normalAcceleration;
    this.validate();
  }

  excludeBody(id: string): void { this.excludedBodyIds.add(id); }
  clearExcludedBodies(): void { this.excludedBodyIds.clear(); }

  modifyForce(
    body: SimulatedBody,
    bodies: readonly SimulatedBody[],
    force: Force,
    context: PhysicsContext,
  ): Force {
    if (
      body.fixed
      || this.excludedBodyIds.has(body.id)
    ) {
      return force;
    }

    let vector = { ...force.vector };
    let modified = false;
    for (const contact of this.contacts(body, bodies)) {
      const normalLoad = contact.floor
        ? body.state.mass * this.normalAcceleration
        : Math.max(0, -(vector.x * contact.normal.x + vector.y * contact.normal.y));
      if (normalLoad <= 0) continue;

      const tangent = { x: -contact.normal.y, y: contact.normal.x };
      const tangentialSpeed = body.state.velocity.x * tangent.x + body.state.velocity.y * tangent.y;
      const tangentialForce = vector.x * tangent.x + vector.y * tangent.y;
      const maximumStaticFriction = contact.staticCoefficient * normalLoad;
      let nextTangentialForce: number;

      if (Math.abs(tangentialSpeed) < 0.01 && Math.abs(tangentialForce) <= maximumStaticFriction) {
        nextTangentialForce = 0;
      } else {
        const direction = Math.abs(tangentialSpeed) >= 0.01
          ? Math.sign(tangentialSpeed)
          : Math.sign(tangentialForce);
        nextTangentialForce = tangentialForce - direction * contact.kineticCoefficient * normalLoad;
        if (Math.abs(tangentialSpeed) >= 0.01) {
          const nextTangentialSpeed = tangentialSpeed
            + nextTangentialForce / body.state.mass * context.dt;
          if (tangentialSpeed * nextTangentialSpeed <= 0) {
            nextTangentialForce = -body.state.mass * tangentialSpeed / context.dt;
          }
        }
      }

      const forceDifference = nextTangentialForce - tangentialForce;
      if (forceDifference !== 0) {
        vector = {
          x: vector.x + tangent.x * forceDifference,
          y: vector.y + tangent.y * forceDifference,
        };
        modified = true;
      }
    }

    return modified ? { vector, source: this.id } : force;
  }

  private contacts(body: SimulatedBody, bodies: readonly SimulatedBody[]): SurfaceContact[] {
    const contacts: SurfaceContact[] = [];
    const bodyStatic = body.staticFriction ?? body.kineticFriction ?? 0;
    const bodyKinetic = body.kineticFriction ?? 0;
    const bounds = this.bounds(body);

    if (
      this.normalAcceleration > 0
      && (bodyStatic > 0 || bodyKinetic > 0)
      && Math.abs(bounds.bottom - this.floorY) <= this.contactTolerance
    ) {
      contacts.push({
        normal: { x: 0, y: -1 },
        staticCoefficient: bodyStatic,
        kineticCoefficient: bodyKinetic,
        floor: true,
      });
    }

    for (const surface of bodies) {
      if (surface.id === body.id || !surface.fixed || surface.collider?.kind !== "box") continue;
      const contactNormal = this.fixedBoxContactNormal(bounds, this.bounds(surface));
      if (!contactNormal) continue;
      const surfaceStatic = surface.staticFriction ?? surface.kineticFriction ?? 0;
      const surfaceKinetic = surface.kineticFriction ?? 0;
      contacts.push({
        normal: contactNormal,
        staticCoefficient: this.combineCoefficients(bodyStatic, surfaceStatic),
        kineticCoefficient: this.combineCoefficients(bodyKinetic, surfaceKinetic),
        floor: false,
      });
    }
    return contacts;
  }

  private fixedBoxContactNormal(body: BodyBounds, surface: BodyBounds): Vector2 | null {
    const overlapX = Math.min(body.right, surface.right) - Math.max(body.left, surface.left);
    const overlapY = Math.min(body.bottom, surface.bottom) - Math.max(body.top, surface.top);
    const candidates: Array<{ gap: number; normal: Vector2 }> = [];
    if (overlapX > 0) {
      candidates.push(
        { gap: Math.abs(body.bottom - surface.top), normal: { x: 0, y: -1 } },
        { gap: Math.abs(body.top - surface.bottom), normal: { x: 0, y: 1 } },
      );
    }
    if (overlapY > 0) {
      candidates.push(
        { gap: Math.abs(body.right - surface.left), normal: { x: -1, y: 0 } },
        { gap: Math.abs(body.left - surface.right), normal: { x: 1, y: 0 } },
      );
    }
    const contact = candidates.sort((a, b) => a.gap - b.gap)[0];
    return contact && contact.gap <= this.contactTolerance ? contact.normal : null;
  }

  private bounds(body: Body): BodyBounds {
    const halfWidth = body.collider?.kind === "box"
      ? body.collider.halfWidth
      : body.collider?.kind === "circle" ? body.collider.radius : body.radius ?? 0;
    const halfHeight = body.collider?.kind === "box"
      ? body.collider.halfHeight
      : body.collider?.kind === "circle" ? body.collider.radius : body.radius ?? 0;
    return {
      left: body.state.position.x - halfWidth,
      right: body.state.position.x + halfWidth,
      top: body.state.position.y - halfHeight,
      bottom: body.state.position.y + halfHeight,
    };
  }

  private combineCoefficients(a: number, b: number): number {
    return Math.sqrt(Math.max(0, a) * Math.max(0, b));
  }

  private validate(): void {
    if (!Number.isFinite(this.floorY)) throw new RangeError("Floor position must be finite.");
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

export interface BuoyancyAreaOptions {
  id: string;
  waterline: number;
  referenceDisplacedMass: number;
  referenceRadius: number;
  gravityAcceleration: number;
  drag?: number;
}

/** Archimedes buoyancy for every movable body entering one horizontal water area. */
export class BuoyancyAreaLaw implements WorldForceLaw {
  readonly id: string;
  waterline: number;
  referenceDisplacedMass: number;
  referenceRadius: number;
  gravityAcceleration: number;
  drag: number;

  constructor(options: BuoyancyAreaOptions) {
    this.id = options.id;
    this.waterline = options.waterline;
    this.referenceDisplacedMass = options.referenceDisplacedMass;
    this.referenceRadius = options.referenceRadius;
    this.gravityAcceleration = options.gravityAcceleration;
    this.drag = options.drag ?? 1.8;
    this.validate();
  }

  setWaterline(waterline: number): void {
    this.waterline = waterline;
    this.validate();
  }

  setGravityAcceleration(gravityAcceleration: number): void {
    this.gravityAcceleration = gravityAcceleration;
    this.validate();
  }

  force(_state: BodyState, _context: PhysicsContext): Force { return zeroForce(this.id); }

  forceOnBody(body: Body, _bodies: readonly Body[], _context: PhysicsContext): Force {
    if (body.fixed) return zeroForce(this.id);
    const dimensions = this.dimensions(body);
    if (!dimensions) return zeroForce(this.id);
    const submergedFraction = Math.max(0, Math.min(
      1,
      (body.state.position.y + dimensions.halfHeight - this.waterline) / (dimensions.halfHeight * 2),
    ));
    if (submergedFraction === 0) return zeroForce(this.id);

    const referenceArea = Math.PI * this.referenceRadius ** 2;
    const displacedMass = this.referenceDisplacedMass * dimensions.area / referenceArea;
    const dragFactor = this.drag * submergedFraction * body.state.mass;
    const buoyantForce = displacedMass * this.gravityAcceleration * submergedFraction;
    return {
      vector: {
        x: -body.state.velocity.x * dragFactor,
        y: -buoyantForce - body.state.velocity.y * dragFactor,
      },
      source: this.id,
    };
  }

  private dimensions(body: Body): { halfHeight: number; area: number } | null {
    if (body.collider?.kind === "circle") {
      return { halfHeight: body.collider.radius, area: Math.PI * body.collider.radius ** 2 };
    }
    if (body.collider?.kind === "box") {
      return {
        halfHeight: body.collider.halfHeight,
        area: body.collider.halfWidth * body.collider.halfHeight * 4,
      };
    }
    if (body.radius) return { halfHeight: body.radius, area: Math.PI * body.radius ** 2 };
    return null;
  }

  private validate(): void {
    if (!Number.isFinite(this.waterline)) throw new RangeError("Waterline must be finite.");
    if (this.referenceDisplacedMass <= 0) throw new RangeError("Reference displaced mass must be greater than zero.");
    if (this.referenceRadius <= 0) throw new RangeError("Reference radius must be greater than zero.");
    if (this.gravityAcceleration < 0) throw new RangeError("Gravity acceleration must be non-negative.");
    if (this.drag < 0) throw new RangeError("Fluid drag must be non-negative.");
  }
}
