import { describe, expect, it } from "vitest";
import { vec2 } from "../core";
import { SI } from "../quantities";
import { UniformGravity, PointGravity } from "./gravity";
import { ConstantForce, KineticFriction, SpringForce } from "./basic";

const state = (overrides = {}) => ({
  position: vec2(0, 0),
  velocity: vec2(0, 0),
  acceleration: vec2(0, 0),
  mass: 2,
  ...overrides,
});

const context = { time: 0, dt: 1 / 60 };

function expectVector(actual: { x: number; y: number }, expected: { x: number; y: number }, precision = 10) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

describe("UniformGravity", () => {
  it("implements F = mg", () => {
    const result = new UniformGravity().force(state(), context);
    expectVector(result.vector, { x: 0, y: -2 * SI.gravitationalAcceleration });
  });

  it("supports arbitrary gravity direction", () => {
    const result = new UniformGravity(vec2(3, 4)).force(state(), context);
    expectVector(result.vector, { x: 6, y: 8 });
  });
});

describe("PointGravity", () => {
  it("implements F = Gm₁m₂/r²", () => {
    const result = new PointGravity(4, vec2(3, 0), 10).force(state(), context);
    expectVector(result.vector, { x: 80 / 9, y: 0 });
  });

  it("returns zero at coincident positions instead of dividing by zero", () => {
    const result = new PointGravity(4, vec2(0, 0), 10).force(state(), context);
    expectVector(result.vector, { x: 0, y: 0 });
  });
});

describe("ConstantForce", () => {
  it("returns the configured force", () => {
    const result = new ConstantForce(vec2(5, -2)).force(state(), context);
    expectVector(result.vector, { x: 5, y: -2 });
  });
});

describe("SpringForce", () => {
  it("implements Hooke's law F = -kx", () => {
    const result = new SpringForce(vec2(0, 0), 10, 2).force(
      state({ position: vec2(5, 0) }),
      context,
    );
    expectVector(result.vector, { x: -30, y: 0 });
  });

  it("has zero force at the rest length", () => {
    const result = new SpringForce(vec2(0, 0), 10, 2).force(
      state({ position: vec2(2, 0) }),
      context,
    );
    expectVector(result.vector, { x: 0, y: 0 });
  });
});

describe("KineticFriction", () => {
  it("implements F = μN opposite velocity", () => {
    const result = new KineticFriction(20, 0.25).force(
      state({ velocity: vec2(3, 4) }),
      context,
    );
    expectVector(result.vector, { x: -3, y: -4 });
  });

  it("does not apply a kinetic friction force to a stationary body", () => {
    const result = new KineticFriction(20, 0.25).force(state(), context);
    expectVector(result.vector, { x: 0, y: 0 });
  });
});
