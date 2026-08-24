import type { Vector2 } from "../core";

/** Distance between two points. */
export const distance = (a: Vector2, b: Vector2): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/** Unit vector from a to b. */
export const direction = (a: Vector2, b: Vector2): Vector2 => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) throw new RangeError("Constraint points must be distinct.");
  return { x: dx / length, y: dy / length };
};

/** Position error for a fixed-distance constraint: C = |b-a| - L. */
export const distanceConstraintError = (a: Vector2, b: Vector2, targetDistance: number): number =>
  distance(a, b) - targetDistance;

/** Relative velocity along a constraint normal. */
export const relativeNormalVelocity = (
  velocityA: Vector2,
  velocityB: Vector2,
  normal: Vector2,
): number => (velocityB.x - velocityA.x) * normal.x + (velocityB.y - velocityA.y) * normal.y;

/** Project a vector onto a normalized constraint direction. */
export const projectOnto = (vector: Vector2, directionVector: Vector2): Vector2 => {
  const length = Math.hypot(directionVector.x, directionVector.y);
  if (length === 0) throw new RangeError("Constraint direction must be non-zero.");
  const nx = directionVector.x / length;
  const ny = directionVector.y / length;
  const scalar = vector.x * nx + vector.y * ny;
  return { x: scalar * nx, y: scalar * ny };
};

/** Remove the component of a vector along a constraint normal. */
export const removeNormalComponent = (vector: Vector2, normal: Vector2): Vector2 => {
  const normalComponent = projectOnto(vector, normal);
  return {
    x: vector.x - normalComponent.x,
    y: vector.y - normalComponent.y,
  };
};
