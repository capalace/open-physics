import { describe, expect, it } from "vitest";
import { UniformGravityField, PointGravityField, UniformElectricField, UniformMagneticField, radialField, fieldMagnitude } from "./fields";

describe("spatial fields", () => {
  const state = {
    position: { x: 0, y: 0 },
    velocity: { x: 2, y: 3 },
    acceleration: { x: 0, y: 0 },
    mass: 2,
  };

  it("applies uniform gravity", () => {
    const force = new UniformGravityField({ x: 0, y: -10 }).forceAt(state).vector;
    expect(force).toEqual({ x: 0, y: -20 });
  });

  it("applies inverse-square point gravity", () => {
    const force = new PointGravityField({ x: 2, y: 0 }, 5, 1).forceAt(state).vector;
    expect(force.x).toBeCloseTo(2.5);
    expect(force.y).toBeCloseTo(0);
  });

  it("applies a uniform electric field to a charged body", () => {
    const force = new UniformElectricField({ x: 3, y: 4 }).forceAt({ ...state, charge: 2 }).vector;
    expect(force).toEqual({ x: 6, y: 8 });
  });

  it("applies a uniform magnetic field", () => {
    const force = new UniformMagneticField(2).forceAt({ ...state, charge: 2 }).vector;
    expect(force).toEqual({ x: 12, y: -8 });
  });

  it("calculates radial field vectors", () => {
    const field = radialField({ x: 2, y: 0 }, 4, { x: 0, y: 0 });
    expect(field).toEqual({ x: 1, y: 0 });
    expect(fieldMagnitude(field)).toBe(1);
  });
});
