import type { BodyState, PhysicsContext, Vector2 } from "../core";
import type { Force } from "../quantities";
import type { Body, WorldForceLaw } from "../world";

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
