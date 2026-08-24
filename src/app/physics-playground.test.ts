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

const createInteractiveCanvas = (): {
  canvas: HTMLCanvasElement;
  dispatchPointer: (type: string, x: number, y: number) => void;
} => {
  const listeners = new Map<string, (event: PointerEvent) => void>();
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ({}),
    addEventListener: (type: string, listener: (event: PointerEvent) => void) => listeners.set(type, listener),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
    setPointerCapture: () => undefined,
  } as unknown as HTMLCanvasElement;
  return {
    canvas,
    dispatchPointer: (type, x, y) => listeners.get(type)?.({ pointerId: 1, clientX: x, clientY: y } as PointerEvent),
  };
};

describe("PhysicsPlayground object creation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds only circular objects from the general add action", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("free-fall");
    playground.paused = false;

    const object = playground.addObject();
    const body = playground.simulation.getBody(object.id)!;

    expect(object.shape).toBe("circle");
    expect(playground.paused).toBe(true);
    expect(body.state.velocity).toEqual({ x: 0, y: 0 });
  });

  it("loads a projectile quick start but keeps the add action general", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("projectile");

    const starter = [...playground.objects.values()].find((object) => object.label === "발사체")!;
    const starterBody = playground.simulation.getBody(starter.id)!;
    const added = playground.addObject();
    const addedBody = playground.simulation.getBody(added.id)!;

    expect(starterBody.state.velocity.x / 48).toBeCloseTo(5.6);
    expect(starterBody.state.velocity.y / 48).toBeCloseTo(-7.2);
    expect(added.shape).toBe("circle");
    expect(added.label).toContain("물체");
    expect(addedBody.state.velocity).toEqual({ x: 0, y: 0 });
  });
});

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

  it("lets the collision preset settle instead of bouncing around indefinitely", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("collision");
    let collided = false;

    for (let frame = 0; frame < 30 * 120; frame += 1) {
      advance.advance(1 / 120);
      if (playground.simulation.collisionEvents.length > 0) collided = true;
    }

    const maximumSpeed = Math.max(...playground.simulation.allBodies.map((body) =>
      Math.hypot(body.state.velocity.x, body.state.velocity.y) / 48));
    expect(collided).toBe(true);
    expect(maximumSpeed).toBeLessThan(0.05);
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

    const hasCircularSelectionOutline = arc.mock.calls.some(([x, y]) => x === box.x && y === box.y);
    expect(hasCircularSelectionOutline).toBe(false);
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

    const objectCenteredArcs = arc.mock.calls.filter(([x, y]) => x === circle.x && y === circle.y);
    expect(objectCenteredArcs).toHaveLength(2);
  });
});

describe("PhysicsPlayground velocity control", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sets movement by dragging the selected object's arrow handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    const object = playground.addCircle(480, 240, 25);
    const body = playground.simulation.getBody(object.id)!;
    playground.paused = false;

    dispatchPointer("pointerdown", 544, 240);
    dispatchPointer("pointermove", 480, 180);
    dispatchPointer("pointerup", 480, 180);

    expect(playground.paused).toBe(true);
    expect(body.state.position).toEqual({ x: 480, y: 240 });
    expect(body.state.velocity.x).toBeCloseTo(0);
    expect(body.state.velocity.y).toBeLessThan(0);
  });
});
