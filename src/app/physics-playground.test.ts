import { afterEach, describe, expect, it, vi } from "vitest";
import { PhysicsPlayground } from "./physics-playground";

const createCanvas = (): HTMLCanvasElement => ({
  width: 0,
  height: 0,
  style: {},
  getContext: () => ({}),
  addEventListener: () => undefined,
} as unknown as HTMLCanvasElement);

const createRenderingCanvas = (): {
  canvas: HTMLCanvasElement;
  arc: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
} => {
  const arc = vi.fn();
  const quadraticCurveTo = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const noop = () => undefined;
  const context = new Proxy({
    arc,
    quadraticCurveTo,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 40 }),
  }, {
    get(target, property) {
      return Reflect.get(target, property) ?? noop;
    },
  });
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
    addEventListener: () => undefined,
  } as unknown as HTMLCanvasElement;
  return { canvas, arc, quadraticCurveTo };
};

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

describe("PhysicsPlayground selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not draw a circular selection outline around a box", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, arc, quadraticCurveTo } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.visualization.vectors = false;
    const box = playground.addBox(480, 240);
    const drawObject = playground as unknown as { drawObject(object: typeof box): void };
    playground.select(null);
    drawObject.drawObject(box);
    const unselectedRoundedCorners = quadraticCurveTo.mock.calls.length;
    quadraticCurveTo.mockClear();
    playground.select(box.id);

    drawObject.drawObject(box);

    expect(arc).not.toHaveBeenCalled();
    expect(quadraticCurveTo).toHaveBeenCalledTimes(unselectedRoundedCorners + 4);
  });

  it("keeps a circular selection outline around a circle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, arc } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.visualization.vectors = false;
    const circle = playground.addCircle(480, 240);
    const drawObject = playground as unknown as { drawObject(object: typeof circle): void };

    drawObject.drawObject(circle);

    expect(arc).toHaveBeenCalledTimes(2);
  });
});
