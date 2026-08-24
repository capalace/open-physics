import { describe, expect, it } from "vitest";
import { distance, direction, distanceConstraintError, relativeNormalVelocity, projectOnto, removeNormalComponent } from "./constraints";

describe("mechanics constraints", () => {
  it("computes distance and direction", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(direction({ x: 0, y: 0 }, { x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  });

  it("computes fixed-distance error", () => {
    expect(distanceConstraintError({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(1);
  });

  it("computes relative normal velocity", () => {
    expect(relativeNormalVelocity({ x: 4, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(-4);
  });

  it("projects and removes a normal component", () => {
    expect(projectOnto({ x: 3, y: 4 }, { x: 1, y: 0 })).toEqual({ x: 3, y: 0 });
    expect(removeNormalComponent({ x: 3, y: 4 }, { x: 1, y: 0 })).toEqual({ x: 0, y: 4 });
  });
});
