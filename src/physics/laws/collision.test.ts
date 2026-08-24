import { describe, expect, it } from "vitest";
import { resolveCollision2D, elasticCollision1D } from "./collision";

describe("collision models", () => {
  it("handles a perfectly elastic equal-mass head-on collision", () => {
    const result = resolveCollision2D({
      massA: 1,
      massB: 1,
      velocityA: { x: 4, y: 0 },
      velocityB: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      restitution: 1,
    });
    expect(result.velocityA.x).toBeCloseTo(0);
    expect(result.velocityB.x).toBeCloseTo(4);
  });

  it("preserves tangential velocity", () => {
    const result = resolveCollision2D({
      massA: 1,
      massB: 1,
      velocityA: { x: 4, y: 3 },
      velocityB: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      restitution: 1,
    });
    expect(result.velocityA.y).toBeCloseTo(3);
    expect(result.velocityB.y).toBeCloseTo(0);
  });

  it("matches the 1D elastic collision formula", () => {
    expect(elasticCollision1D(1, 4, 1, 0)).toEqual({ velocityA: 0, velocityB: 4 });
  });
});
