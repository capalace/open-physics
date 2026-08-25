import { describe, expect, it } from "vitest";
import { MultiBodyWorld } from "./world";
import type { WorldForceLaw } from "./world";

describe("MultiBodyWorld", () => {
  it("advances multiple bodies under world force laws", () => {
    const gravity: WorldForceLaw = {
      id: "gravity",
      force: () => ({ vector: { x: 0, y: -1 } }),
      forceOnBody: (body) => ({ vector: { x: 0, y: -body.state.mass } }),
    };
    const world = new MultiBodyWorld([gravity]);
    world.addBody({ id: "a", state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 2 } });
    world.addBody({ id: "b", state: { position: { x: 2, y: 0 }, velocity: { x: 0, y: 1 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.step(1);
    expect(world.getBody("a")?.state.velocity.y).toBe(-1);
    expect(world.getBody("b")?.state.velocity.y).toBe(0);
  });

  it("resolves an approaching collision", () => {
    const world = new MultiBodyWorld();
    world.addBody({ id: "a", radius: 1, restitution: 1, state: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.addBody({ id: "b", radius: 1, restitution: 1, state: { position: { x: 1.5, y: 0 }, velocity: { x: -1, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.step(0.01);
    expect(world.collisions).toHaveLength(1);
    expect(world.getBody("a")?.state.velocity.x).toBeCloseTo(-1);
    expect(world.getBody("b")?.state.velocity.x).toBeCloseTo(1);
  });

  it("resolves a circle colliding with a fixed box", () => {
    const world = new MultiBodyWorld();
    world.addBody({
      id: "ball",
      radius: 1,
      collider: { kind: "circle", radius: 1 },
      restitution: 1,
      state: { position: { x: -1.4, y: 0 }, velocity: { x: 1, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 },
    });
    world.addBody({
      id: "wall",
      collider: { kind: "box", halfWidth: 0.5, halfHeight: 2 },
      restitution: 1,
      fixed: true,
      state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 },
    });

    world.step(0.01);

    expect(world.collisions).toHaveLength(1);
    expect(world.getBody("ball")?.state.velocity.x).toBeCloseTo(-1);
  });

  it("resolves a moving box colliding with a fixed box", () => {
    const world = new MultiBodyWorld();
    world.addBody({
      id: "box",
      collider: { kind: "box", halfWidth: 0.5, halfHeight: 0.5 },
      restitution: 1,
      state: { position: { x: -0.8, y: 0 }, velocity: { x: 1, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 },
    });
    world.addBody({
      id: "wall",
      collider: { kind: "box", halfWidth: 0.5, halfHeight: 2 },
      restitution: 1,
      fixed: true,
      state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 },
    });

    world.step(0.01);

    expect(world.collisions).toHaveLength(1);
    expect(world.getBody("box")?.state.velocity.x).toBeCloseTo(-1);
  });

  it("enforces a distance constraint", () => {
    const world = new MultiBodyWorld([], undefined, [{ id: "rod", bodyA: "a", bodyB: "b", distance: 2 }]);
    world.addBody({ id: "a", fixed: true, state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.addBody({ id: "b", state: { position: { x: 3, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.step(0.01);
    expect(world.getBody("b")?.state.position.x).toBeCloseTo(2);
  });

  it("separates overlapping bodies even when they are initially at rest", () => {
    const world = new MultiBodyWorld();
    world.addBody({ id: "a", radius: 1, state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.addBody({ id: "b", radius: 1, state: { position: { x: 1, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.step(0.01);

    const a = world.getBody("a")!;
    const b = world.getBody("b")!;
    expect(b.state.position.x - a.state.position.x).toBeCloseTo(2);
  });

  it("clears bodies, collision history, and simulation time", () => {
    const world = new MultiBodyWorld();
    world.addBody({ id: "a", state: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 1 } });
    world.step(0.25);
    world.clear();

    expect(world.allBodies).toHaveLength(0);
    expect(world.collisions).toHaveLength(0);
    expect(world.currentTime).toBe(0);
  });

  it("adds and removes active force laws by id", () => {
    const world = new MultiBodyWorld();
    const law: WorldForceLaw = {
      id: "temporary",
      force: () => ({ vector: { x: 0, y: 0 } }),
      forceOnBody: () => ({ vector: { x: 0, y: 0 } }),
    };

    world.addLaw(law);
    expect(world.laws).toEqual([law]);
    expect(() => world.addLaw(law)).toThrow("Force law already exists");
    expect(world.removeLaw("temporary")).toBe(true);
    expect(world.removeLaw("temporary")).toBe(false);
  });
});
