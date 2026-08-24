import type { Vector2 } from "../core";

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

export interface CollisionInput {
  massA: number;
  massB: number;
  velocityA: Vector2;
  velocityB: Vector2;
  normal: Vector2;
  restitution: number;
}

/** Resolve the normal component of a 2D collision while preserving tangential velocity. */
export function resolveCollision2D(input: CollisionInput): { velocityA: Vector2; velocityB: Vector2 } {
  requirePositive(input.massA, "Mass A");
  requirePositive(input.massB, "Mass B");
  if (input.restitution < 0 || input.restitution > 1) {
    throw new RangeError("Restitution must be between 0 and 1.");
  }

  const length = Math.hypot(input.normal.x, input.normal.y);
  if (length === 0) throw new RangeError("Collision normal must be non-zero.");
  const nx = input.normal.x / length;
  const ny = input.normal.y / length;

  const relative = {
    x: input.velocityA.x - input.velocityB.x,
    y: input.velocityA.y - input.velocityB.y,
  };
  const relativeNormal = relative.x * nx + relative.y * ny;

  // Bodies moving apart need no impulse.
  if (relativeNormal >= 0) {
    return { velocityA: { ...input.velocityA }, velocityB: { ...input.velocityB } };
  }

  const impulseMagnitude = -(1 + input.restitution) * relativeNormal /
    (1 / input.massA + 1 / input.massB);

  return {
    velocityA: {
      x: input.velocityA.x + impulseMagnitude * nx / input.massA,
      y: input.velocityA.y + impulseMagnitude * ny / input.massA,
    },
    velocityB: {
      x: input.velocityB.x - impulseMagnitude * nx / input.massB,
      y: input.velocityB.y - impulseMagnitude * ny / input.massB,
    },
  };
}

/** Perfectly elastic 1D collision as a convenience formula. */
export function elasticCollision1D(
  massA: number,
  velocityA: number,
  massB: number,
  velocityB: number,
): { velocityA: number; velocityB: number } {
  requirePositive(massA, "Mass A");
  requirePositive(massB, "Mass B");
  const denominator = massA + massB;
  return {
    velocityA: ((massA - massB) * velocityA + 2 * massB * velocityB) / denominator,
    velocityB: (2 * massA * velocityA + (massB - massA) * velocityB) / denominator,
  };
}
