import { describe, expect, it } from "vitest";
import type { Body } from "../world";
import {
  AnchoredSpringLaw,
  BuoyancyRegionLaw,
  HorizontalSurfaceFrictionLaw,
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
