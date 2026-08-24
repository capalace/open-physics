import { afterEach, describe, expect, it, vi } from "vitest";
import { PhysicsPlayground } from "./physics-playground";

const createCanvas = (): HTMLCanvasElement => ({
  width: 0,
  height: 0,
  style: {},
  getContext: () => ({}),
  addEventListener: () => undefined,
} as unknown as HTMLCanvasElement);

describe("PhysicsPlayground contacts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps an object resting on the floor instead of colliding repeatedly", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600, gravity: 9.81 });
    const object = playground.addCircle(480, playground.floorY - 20, 20, { material: "rubber" });
    const body = playground.simulation.getBody(object.id)!;
    const advance = playground as unknown as { advance(dt: number): void };

    let movingFrames = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      advance.advance(1 / 120);
      if (Math.abs(body.state.velocity.y) > 0.001) movingFrames += 1;
    }

    expect(movingFrames).toBe(0);
    expect(body.state.position.y).toBeCloseTo(playground.floorY - 20);
  });

  it("still rebounds when it hits the floor with meaningful speed", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600, gravity: 9.81 });
    const object = playground.addCircle(480, playground.floorY - 20, 20, { material: "rubber" });
    const body = playground.simulation.getBody(object.id)!;
    const advance = playground as unknown as { advance(dt: number): void };
    body.state.velocity.y = 100;

    advance.advance(1 / 120);

    expect(body.state.velocity.y).toBeLessThan(0);
    expect(body.state.position.y).toBeCloseTo(playground.floorY - 20);
  });
});
