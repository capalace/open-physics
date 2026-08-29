import { describe, expect, it } from "vitest";
import { PhysicsSimulation } from "../simulation";
import type { Body } from "../world";
import type { WorldForceLaw } from "../world";
import {
  AnchoredSpringLaw,
  BuoyancyAreaLaw,
  BuoyancyRegionLaw,
  ConstantBodyForceLaw,
  HorizontalSurfaceFrictionLaw,
  PushFrictionLaw,
  SurfaceContactFrictionModifier,
} from "./world-mechanics";

const context = { time: 0, dt: 0.1 };
const body = (overrides: Partial<Body> = {}): Body => ({
  id: "target",
  radius: 10,
  state: {
    position: { x: 50, y: 90 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    mass: 2,
  },
  ...overrides,
});

describe("AnchoredSpringLaw", () => {
  it("pulls a stretched body toward its anchor", () => {
    const law = new AnchoredSpringLaw({
      bodyId: "target",
      anchor: { x: 0, y: 90 },
      stiffness: 4,
      restLength: 30,
    });

    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: -80, y: 0 });
  });

  it("pushes a compressed body away and ignores other bodies", () => {
    const law = new AnchoredSpringLaw({
      bodyId: "target",
      anchor: { x: 0, y: 90 },
      stiffness: 4,
      restLength: 70,
    });

    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: 80, y: 0 });
    expect(law.forceOnBody(body({ id: "other" }), [], context).vector).toEqual({ x: 0, y: 0 });
  });

  it("uses damping opposite the radial motion", () => {
    const law = new AnchoredSpringLaw({
      bodyId: "target",
      anchor: { x: 0, y: 90 },
      stiffness: 0,
      restLength: 50,
      damping: 3,
    });
    const moving = body();
    moving.state.velocity.x = 4;

    expect(law.forceOnBody(moving, [], context).vector).toEqual({ x: -12, y: 0 });
  });
});

describe("ConstantBodyForceLaw", () => {
  it("applies an editable force only to its target body", () => {
    const law = new ConstantBodyForceLaw({ bodyId: "target", vector: { x: 12, y: -4 } });

    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: 12, y: -4 });
    expect(law.forceOnBody(body({ id: "other" }), [], context).vector).toEqual({ x: 0, y: 0 });

    law.setVector({ x: -6, y: 8 });
    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: -6, y: 8 });
  });
});

describe("SurfaceContactFrictionModifier", () => {
  it("cancels a small horizontal force while a body is resting on the ground", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 100, normalAcceleration: 10 });
    const resting = body({ staticFriction: 0.5, kineticFriction: 0.3 });

    expect(friction.modifyForce(resting, [], { vector: { x: 8, y: 20 }, source: "external" }, context).vector)
      .toEqual({ x: 0, y: 20 });
  });

  it("uses kinetic friction after the maximum static force is exceeded", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 100, normalAcceleration: 10 });
    const resting = body({ staticFriction: 0.5, kineticFriction: 0.3 });

    expect(friction.modifyForce(resting, [], { vector: { x: 12, y: 20 }, source: "external" }, context).vector.x)
      .toBe(6);
  });

  it("stops a moving body without reversing it", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 100, normalAcceleration: 10 });
    const moving = body({ staticFriction: 0.7, kineticFriction: 0.6 });
    moving.state.velocity.x = 0.1;

    expect(friction.modifyForce(moving, [], { vector: { x: 0, y: 20 }, source: "external" }, context).vector.x)
      .toBe(-2);
  });

  it("combines both materials while resting on top of a fixed block", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 500, normalAcceleration: 10 });
    const resting = body({ staticFriction: 0.5, kineticFriction: 0.3 });
    resting.state.position = { x: 50, y: 40 };
    const block = body({
      id: "block",
      radius: undefined,
      collider: { kind: "box", halfWidth: 30, halfHeight: 5 },
      staticFriction: 0.8,
      kineticFriction: 0.6,
      fixed: true,
    });
    block.state.position = { x: 50, y: 55 };

    expect(friction.modifyForce(
      resting,
      [resting, block],
      { vector: { x: 8, y: 20 }, source: "external" },
      context,
    ).vector).toEqual({ x: 0, y: 20 });
  });

  it("applies friction along the side of a fixed block", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 500, normalAcceleration: 10 });
    const sliding = body({ staticFriction: 0.5, kineticFriction: 0.3 });
    sliding.state.position = { x: 40, y: 50 };
    sliding.state.velocity.y = 4;
    const wall = body({
      id: "wall",
      radius: undefined,
      collider: { kind: "box", halfWidth: 5, halfHeight: 30 },
      staticFriction: 0.8,
      kineticFriction: 0.6,
      fixed: true,
    });
    wall.state.position = { x: 55, y: 50 };

    const result = friction.modifyForce(
      sliding,
      [sliding, wall],
      { vector: { x: 20, y: 0 }, source: "external" },
      context,
    );

    expect(result.vector.x).toBe(20);
    expect(result.vector.y).toBeLessThan(0);
  });

  it("cancels the downhill gravity component on a high-friction incline", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 500, normalAcceleration: 10 });
    const angle = -Math.PI / 6;
    const resting = body({ staticFriction: 1, kineticFriction: 0.8 });
    resting.state.position = {
      x: 50 + Math.sin(angle) * 15,
      y: 100 - Math.cos(angle) * 15,
    };
    const ramp = body({
      id: "ramp",
      radius: undefined,
      collider: { kind: "box", halfWidth: 50, halfHeight: 5, angle },
      staticFriction: 1,
      kineticFriction: 0.8,
      fixed: true,
    });
    ramp.state.position = { x: 50, y: 100 };

    const result = friction.modifyForce(
      resting,
      [resting, ramp],
      { vector: { x: 0, y: 20 }, source: "gravity" },
      context,
    );
    const downhill = { x: -Math.cos(angle), y: -Math.sin(angle) };

    expect(result.vector.x * downhill.x + result.vector.y * downhill.y).toBeCloseTo(0);
  });

  it("leaves a downhill force on a low-friction incline", () => {
    const friction = new SurfaceContactFrictionModifier({ floorY: 500, normalAcceleration: 10 });
    const angle = -Math.PI / 6;
    const sliding = body({ staticFriction: 0.1, kineticFriction: 0.05 });
    sliding.state.position = {
      x: 50 + Math.sin(angle) * 15,
      y: 100 - Math.cos(angle) * 15,
    };
    const ramp = body({
      id: "ramp",
      radius: undefined,
      collider: { kind: "box", halfWidth: 50, halfHeight: 5, angle },
      staticFriction: 0.1,
      kineticFriction: 0.05,
      fixed: true,
    });
    ramp.state.position = { x: 50, y: 100 };

    const result = friction.modifyForce(
      sliding,
      [sliding, ramp],
      { vector: { x: 0, y: 20 }, source: "gravity" },
      context,
    );
    const downhill = { x: -Math.cos(angle), y: -Math.sin(angle) };

    expect(result.vector.x * downhill.x + result.vector.y * downhill.y).toBeGreaterThan(0);
  });

  it("modifies the combined force before the simulation integrates it", () => {
    const push: WorldForceLaw = {
      id: "push",
      force: () => ({ vector: { x: 8, y: 20 }, source: "push" }),
      forceOnBody: () => ({ vector: { x: 8, y: 20 }, source: "push" }),
    };
    const simulation = new PhysicsSimulation({
      laws: [push],
      forceModifiers: [new SurfaceContactFrictionModifier({ floorY: 100, normalAcceleration: 10 })],
    });
    simulation.addBody(body({ staticFriction: 0.5, kineticFriction: 0.3 }));

    simulation.refreshAccelerations();

    expect(simulation.getBody("target")?.state.acceleration.x).toBe(0);
    const breakdown = simulation.forceBreakdown("target", 0.1);
    expect(breakdown.map((force) => force.source)).toEqual(["push", "friction.surface.contact"]);
    expect(breakdown.reduce((sum, force) => sum + force.vector.x, 0)).toBe(0);
  });
});

describe("HorizontalSurfaceFrictionLaw", () => {
  it("applies μN opposite horizontal movement while touching the surface", () => {
    const law = new HorizontalSurfaceFrictionLaw({
      bodyId: "target",
      surfaceY: 100,
      coefficient: 0.25,
      normalAcceleration: 10,
    });
    const moving = body();
    moving.state.velocity.x = 20;

    expect(law.forceOnBody(moving, [], context).vector).toEqual({ x: -5, y: 0 });
  });

  it("does not apply friction while the body is away from the surface", () => {
    const law = new HorizontalSurfaceFrictionLaw({
      bodyId: "target",
      surfaceY: 120,
      coefficient: 0.25,
      normalAcceleration: 10,
    });
    const moving = body();
    moving.state.velocity.x = 20;

    expect(law.forceOnBody(moving, [], context).vector).toEqual({ x: 0, y: 0 });
  });

  it("caps friction so a slow body stops without reversing", () => {
    const law = new HorizontalSurfaceFrictionLaw({
      bodyId: "target",
      surfaceY: 100,
      coefficient: 10,
      normalAcceleration: 10,
    });
    const moving = body();
    moving.state.velocity.x = 0.1;

    expect(law.forceOnBody(moving, [], context).vector.x).toBe(-2);
  });
});

describe("PushFrictionLaw", () => {
  it("matches an applied force until maximum static friction is exceeded", () => {
    const law = new PushFrictionLaw({
      bodyId: "target",
      surfaceY: 100,
      staticCoefficient: 0.5,
      kineticCoefficient: 0.3,
      normalAcceleration: 10,
    });
    law.setAppliedForce(8);

    expect(law.maximumStaticForce(body().state)).toBe(10);
    expect(law.forceOnBody(body(), [], context).vector.x).toBe(0);
    expect(law.status(body().state)).toBe("holding");

    law.setAppliedForce(12);
    expect(law.forceOnBody(body(), [], context).vector.x).toBe(6);
    expect(law.status(body().state)).toBe("moving");
  });

  it("uses kinetic friction after motion starts and can pull in either direction", () => {
    const law = new PushFrictionLaw({
      bodyId: "target",
      surfaceY: 100,
      staticCoefficient: 0.5,
      kineticCoefficient: 0.3,
      normalAcceleration: 10,
    });
    const moving = body();
    moving.state.velocity.x = 5;
    law.setAppliedForce(-4);

    expect(law.forceOnBody(moving, [], context).vector.x).toBe(-10);
  });
});

describe("BuoyancyRegionLaw", () => {
  it("increases upward buoyancy as more of the body is submerged", () => {
    const law = new BuoyancyRegionLaw({
      bodyId: "target",
      waterline: 80,
      displacedMass: 3,
      gravityAcceleration: 10,
      drag: 0,
    });
    const halfSubmerged = body();
    halfSubmerged.state.position.y = 80;
    const fullySubmerged = body();
    fullySubmerged.state.position.y = 90;

    expect(law.forceOnBody(halfSubmerged, [], context).vector.y).toBe(-15);
    expect(law.forceOnBody(fullySubmerged, [], context).vector.y).toBe(-30);
  });

  it("applies no buoyancy above the waterline", () => {
    const law = new BuoyancyRegionLaw({
      bodyId: "target",
      waterline: 120,
      displacedMass: 3,
      gravityAcceleration: 10,
    });

    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: 0, y: 0 });
  });
});

describe("BuoyancyAreaLaw", () => {
  it("applies buoyancy to every movable body inside the water area", () => {
    const law = new BuoyancyAreaLaw({
      id: "sandbox-water",
      waterline: 80,
      referenceDisplacedMass: 3,
      referenceRadius: 10,
      gravityAcceleration: 10,
      drag: 0,
    });
    const light = body();
    light.state.position.y = 90;
    const heavy = body({ id: "heavy" });
    heavy.state.position.y = 90;
    heavy.state.mass = 8;

    expect(law.forceOnBody(light, [light, heavy], context).vector.y).toBe(-30);
    expect(law.forceOnBody(heavy, [light, heavy], context).vector.y).toBe(-30);
  });

  it("ignores fixed bodies and bodies above the water", () => {
    const law = new BuoyancyAreaLaw({
      id: "sandbox-water",
      waterline: 120,
      referenceDisplacedMass: 3,
      referenceRadius: 10,
      gravityAcceleration: 10,
    });

    expect(law.forceOnBody(body(), [], context).vector).toEqual({ x: 0, y: 0 });
    expect(law.forceOnBody(body({ fixed: true }), [], context).vector).toEqual({ x: 0, y: 0 });
  });
});
