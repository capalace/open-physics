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
  lineTo: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
} => {
  const arc = vi.fn();
  const lineTo = vi.fn();
  const quadraticCurveTo = vi.fn();
  const setLineDash = vi.fn();
  const fillText = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const noop = () => undefined;
  const context = new Proxy({
    arc,
    lineTo,
    quadraticCurveTo,
    setLineDash,
    fillText,
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
  return { canvas, arc, lineTo, quadraticCurveTo, setLineDash, fillText };
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
    dispatchPointer: (type, x, y) => listeners.get(type)?.({
      pointerId: 1,
      clientX: x,
      clientY: y,
    } as PointerEvent),
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
    expect(added.label).toContain("공");
    expect(addedBody.state.velocity).toEqual({ x: 0, y: 0 });
  });

  it("starts a clean sandbox without carrying over lab apparatus", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("pulley", true);

    playground.startSandbox();

    expect(playground.paused).toBe(true);
    expect(playground.gravity).toBeCloseTo(9.81);
    expect(playground.objects.size).toBe(1);
    expect([...playground.objects.values()][0]).toMatchObject({
      label: "물체 1",
      shape: "circle",
      material: "rubber",
    });
  });

  it("creates four distinct sandbox primitives with matching motion roles", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();

    const ball = playground.addSandboxObject("ball");
    const box = playground.addSandboxObject("box");
    const platform = playground.addSandboxObject("platform");
    const wall = playground.addSandboxObject("wall");

    expect(ball.shape).toBe("circle");
    expect(playground.simulation.getBody(ball.id)?.collider).toEqual({ kind: "circle", radius: 25 });
    expect(box.shape).toBe("box");
    expect(playground.simulation.getBody(box.id)?.collider).toEqual({ kind: "box", halfWidth: 28, halfHeight: 28 });
    expect(playground.simulation.getBody(box.id)?.fixed).not.toBe(true);
    expect(platform).toMatchObject({ shape: "box", width: 170, height: 26 });
    expect(playground.simulation.getBody(platform.id)?.fixed).toBe(true);
    expect(wall).toMatchObject({ shape: "box", width: 28, height: 190 });
    expect(playground.simulation.getBody(wall.id)?.fixed).toBe(true);
  });

  it("resizes a selected object from its original dimensions and updates its collider", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const box = playground.addSandboxObject("box");

    playground.updateSelected({ size: "large" });

    expect(box.width).toBeCloseTo(56 * 1.4);
    expect(box.height).toBeCloseTo(56 * 1.4);
    expect(playground.simulation.getBody(box.id)?.collider).toEqual({
      kind: "box",
      halfWidth: 56 * 0.7,
      halfHeight: 56 * 0.7,
    });

    playground.updateSelected({ size: "small" });

    expect(box.width).toBeCloseTo(56 * 0.7);
    expect(box.height).toBeCloseTo(56 * 0.7);
    expect(playground.snapshot().selected?.size).toBe("small");
  });

  it("preserves a fixed wall's aspect ratio while resizing it", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const wall = playground.addSandboxObject("wall");

    playground.updateSelected({ size: "large" });

    expect(wall.width).toBeCloseTo(28 * 1.4);
    expect(wall.height).toBeCloseTo(190 * 1.4);
    expect(playground.simulation.getBody(wall.id)?.fixed).toBe(true);
  });

  it("updates circle and platform colliders when their size changes", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const ball = playground.addSandboxObject("ball");

    playground.updateSelected({ size: "small" });

    expect(ball.radius).toBeCloseTo(25 * 0.7);
    expect(playground.simulation.getBody(ball.id)?.collider).toEqual({
      kind: "circle",
      radius: 25 * 0.7,
    });

    const platform = playground.addSandboxObject("platform");
    playground.updateSelected({ size: "large" });

    expect(platform.width).toBeCloseTo(170 * 1.4);
    expect(platform.height).toBeCloseTo(26 * 1.4);
    expect(playground.simulation.getBody(platform.id)?.collider).toEqual({
      kind: "box",
      halfWidth: 170 * 0.7,
      halfHeight: 26 * 0.7,
    });
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

describe("PhysicsPlayground gravity visualization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the selected gravity as acceleration before the simulation starts", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("free-fall");
    const body = playground.simulation.allBodies[0];

    expect(playground.paused).toBe(true);
    expect(body.state.acceleration.y).toBeCloseTo(9.81 * 48);

    playground.setGravity(1.62);
    expect(body.state.acceleration.y).toBeCloseTo(1.62 * 48);

    playground.setGravity(24.79);
    expect(body.state.acceleration.y).toBeCloseTo(24.79 * 48);

    playground.setGravity(0);
    expect(body.state.acceleration).toEqual({ x: 0, y: 0 });
  });
});

describe("PhysicsPlayground extended mechanics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a spring that pulls the selected object toward equilibrium", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("spring");
    const body = playground.simulation.allBodies[0];
    const initialX = body.state.position.x;

    expect(playground.gravity).toBe(0);
    expect(playground.simulation.laws).toHaveLength(1);
    expect(body.state.acceleration.x).toBeLessThan(0);

    for (let frame = 0; frame < 60; frame += 1) advance.advance(1 / 120);
    expect(body.state.position.x).toBeLessThan(initialX);
  });

  it("shows energy exchange inside the spring experience", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("spring");
    const renderer = playground as unknown as { render(): void };

    renderer.render();

    expect(fillText).toHaveBeenCalledWith("움직임 에너지", expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith("용수철 에너지", expect.any(Number), expect.any(Number));
  });

  it("shows momentum inside the collision experience", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("collision");
    const renderer = playground as unknown as { render(): void };

    renderer.render();

    expect(fillText).toHaveBeenCalledWith("운동량 p = mv", expect.any(Number), expect.any(Number));
  });

  it("removes the spring connection when another quick start is loaded", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("spring");
    playground.loadPreset("free-fall");

    expect(playground.simulation.laws).toHaveLength(0);
    expect(playground.snapshot().preset).toBe("free-fall");
  });

  it("uses friction to slow a surface object to rest without reversing it", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("friction");
    const body = playground.simulation.allBodies[0];
    const initialSpeed = body.state.velocity.x;

    for (let frame = 0; frame < 5 * 120; frame += 1) advance.advance(1 / 120);

    expect(body.state.velocity.x).toBeGreaterThanOrEqual(0);
    expect(body.state.velocity.x).toBeLessThan(initialSpeed);
    expect(body.state.velocity.x).toBeCloseTo(0);
  });

  it("changes the friction force when the selected material changes", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("friction");
    const body = playground.simulation.allBodies[0];
    const woodAcceleration = Math.abs(body.state.acceleration.x);

    playground.updateSelected({ material: "clay" });

    expect(Math.abs(body.state.acceleration.x)).toBeGreaterThan(woodAcceleration);
  });

  it("draws the spring as a densely sampled smooth coil", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, lineTo } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("spring");
    const renderer = playground as unknown as { drawSpringConnection(): void };

    renderer.drawSpringConnection();

    expect(lineTo.mock.calls.length).toBeGreaterThan(300);
  });

  it("keeps a hard-thrown spring body from passing through its fixed mount", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("spring");
    const object = [...playground.objects.values()][0];
    const body = playground.simulation.getBody(object.id)!;
    const anchorX = 960 * 0.22;
    body.state.position = { x: 900, y: body.state.position.y };
    body.state.velocity = { x: -430, y: 0 };

    let minimumX = body.state.position.x;
    for (let frame = 0; frame < 3 * 120; frame += 1) {
      advance.advance(1 / 120);
      minimumX = Math.min(minimumX, body.state.position.x);
    }

    expect(minimumX).toBeGreaterThanOrEqual(anchorX + object.radius);
  });

  it("provides every mechanics quick start as a working initial state", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const presets = [
      "free-fall", "projectile", "collision", "spring", "friction",
      "rotation", "orbit", "buoyancy", "constraints", "pulley",
    ] as const;

    for (const preset of presets) {
      playground.loadPreset(preset);
      expect(playground.snapshot().preset).toBe(preset);
      expect(playground.objects.size).toBeGreaterThan(0);
      expect(playground.simulation.allBodies.length).toBe(playground.objects.size);
    }
  });

  it("includes pendulum motion in the rope and rod experience", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("constraints");
    const body = playground.simulation.allBodies[0];
    const anchor = { x: 960 * 0.34, y: 105 };
    const initialX = body.state.position.x;
    const length = Math.hypot(body.state.position.x - anchor.x, body.state.position.y - anchor.y);

    for (let frame = 0; frame < 120; frame += 1) advance.advance(1 / 120);

    expect(body.state.position.x).not.toBeCloseTo(initialX);
    expect(Math.hypot(body.state.position.x - anchor.x, body.state.position.y - anchor.y)).toBeCloseTo(length, 4);
  });

  it("moves the heavier pulley weight down by the same distance the light weight rises", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("pulley");
    const [left, right] = playground.simulation.allBodies;
    const leftStart = left.state.position.y;
    const rightStart = right.state.position.y;

    for (let frame = 0; frame < 60; frame += 1) advance.advance(1 / 120);

    expect(left.state.position.y).toBeLessThan(leftStart);
    expect(right.state.position.y).toBeGreaterThan(rightStart);
    expect(leftStart - left.state.position.y).toBeCloseTo(right.state.position.y - rightStart, 4);
  });

  it("places the pulley name above the wheel instead of across its spokes", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("pulley");
    const renderer = playground as unknown as { drawGuidedScene(): void };

    renderer.drawGuidedScene();

    const pulleyLabel = fillText.mock.calls.find(([text]) => text === "도르래")!;
    expect(pulleyLabel[2]).toBeLessThan(125 - 58);
  });

  it("keeps rope and rod bobs at their fixed constraint lengths", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("constraints");
    const [ropeBody, rodBody] = playground.simulation.allBodies;
    const anchors = [{ x: 960 * 0.34, y: 105 }, { x: 960 * 0.68, y: 105 }];
    const lengths = [ropeBody, rodBody].map((body, index) =>
      Math.hypot(body.state.position.x - anchors[index].x, body.state.position.y - anchors[index].y));

    for (let frame = 0; frame < 240; frame += 1) advance.advance(1 / 120);

    expect(Math.hypot(ropeBody.state.position.x - anchors[0].x, ropeBody.state.position.y - anchors[0].y)).toBeCloseTo(lengths[0], 4);
    expect(Math.hypot(rodBody.state.position.x - anchors[1].x, rodBody.state.position.y - anchors[1].y)).toBeCloseTo(lengths[1], 4);
  });

  it("applies upward buoyancy to a submerged object", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("buoyancy");
    const body = playground.simulation.allBodies[0];
    body.state.position.y = playground.floorY * 0.4 + 40;
    playground.simulation.refreshAccelerations();

    expect(body.state.acceleration.y).toBeLessThan(0);
  });

  it("keeps an upward acceleration label away from the object name", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("buoyancy");
    const object = [...playground.objects.values()][0];
    const body = playground.simulation.getBody(object.id)!;
    body.state.position.y = playground.floorY * 0.4 + 40;
    playground.simulation.refreshAccelerations();
    const renderer = playground as unknown as { drawObject(target: typeof object): void };

    renderer.drawObject(object);

    const name = fillText.mock.calls.find(([text]) => text === object.label)!;
    const acceleration = fillText.mock.calls.find(([text]) => text === "가속도")!;
    const nameBox = { left: name[1] - 20, right: name[1] + 20, top: name[2] - 14, bottom: name[2] };
    const accelerationBox = {
      left: acceleration[1],
      right: acceleration[1] + 40,
      top: acceleration[2] - 14,
      bottom: acceleration[2],
    };
    const overlaps = nameBox.left < accelerationBox.right
      && nameBox.right > accelerationBox.left
      && nameBox.top < accelerationBox.bottom
      && nameBox.bottom > accelerationBox.top;

    expect(overlaps).toBe(false);
  });

  it("maintains a near-circular orbit under point gravity", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("orbit");
    const orbiting = playground.simulation.allBodies.find((body) => !body.fixed)!;
    const center = playground.simulation.allBodies.find((body) => body.fixed)!.state.position;
    const radius = Math.hypot(orbiting.state.position.x - center.x, orbiting.state.position.y - center.y);

    for (let frame = 0; frame < 4 * 120; frame += 1) advance.advance(1 / 120);

    const nextRadius = Math.hypot(orbiting.state.position.x - center.x, orbiting.state.position.y - center.y);
    expect(Math.abs(nextRadius - radius) / radius).toBeLessThan(0.06);
    const radial = {
      x: orbiting.state.position.x - center.x,
      y: orbiting.state.position.y - center.y,
    };
    expect(radial.x * orbiting.state.acceleration.x + radial.y * orbiting.state.acceleration.y).toBeLessThan(0);
  });
});

describe("PhysicsPlayground canvas sizing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("expands the world while keeping objects in the same relative place", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const object = playground.addCircle(480, playground.floorY - 25, 25);
    const resize = playground as unknown as { resizeWorld(width: number, height: number): void };

    resize.resizeWorld(1440, 800);

    const body = playground.simulation.getBody(object.id)!;
    expect(playground.canvas.width).toBe(1440);
    expect(playground.canvas.height).toBe(800);
    expect(body.state.position.x).toBeCloseTo(720);
    expect(body.state.position.y).toBeCloseTo(playground.floorY - 25);
    expect(object.x).toBeCloseTo(body.state.position.x);
    expect(object.y).toBeCloseTo(body.state.position.y);
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

  it("draws non-zero velocity lengths in proportion to speed", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const velocityVector = playground as unknown as {
      velocityVector(velocity: { x: number; y: number }): { x: number; y: number };
    };

    const slow = velocityVector.velocityVector({ x: 50, y: 0 });
    const fast = velocityVector.velocityVector({ x: 100, y: 0 });

    expect(Math.hypot(fast.x, fast.y)).toBeCloseTo(Math.hypot(slow.x, slow.y) * 2);
  });

  it("keeps a slow velocity handle outside the selected object", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const object = playground.addCircle(480, 240, 35);
    const control = playground as unknown as {
      velocityControlVector(target: typeof object, velocity: { x: number; y: number }): { x: number; y: number };
    };

    const vector = control.velocityControlVector(object, { x: 0, y: 1 });

    expect(Math.hypot(vector.x, vector.y)).toBeGreaterThan(object.radius + 12);
  });

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

    expect(playground.paused).toBe(false);
    expect(body.state.position).toEqual({ x: 480, y: 240 });
    expect(body.state.velocity.x).toBeCloseTo(0);
    expect(body.state.velocity.y).toBeLessThan(0);
  });

  it("snaps every movement angle to 15 degree steps", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    const object = playground.addCircle(480, 240, 25);
    const body = playground.simulation.getBody(object.id)!;

    dispatchPointer("pointerdown", 544, 240);
    dispatchPointer("pointermove", 550, 200);

    const angle = Math.atan2(body.state.velocity.y, body.state.velocity.x) * 180 / Math.PI;
    expect(angle).toBeCloseTo(-30);
    expect(Math.hypot(body.state.velocity.x, body.state.velocity.y) * 0.22).toBeCloseTo(Math.hypot(70, 40));
  });

  it("starts a quick start immediately when autoplay is requested", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });

    playground.loadPreset("projectile", true);

    expect(playground.paused).toBe(false);
    playground.paused = true;
    playground.reset(true);
    expect(playground.paused).toBe(false);
  });

  it("starts the spring when its object is released after dragging", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("spring");
    const object = [...playground.objects.values()][0];

    dispatchPointer("pointerdown", object.x, object.y);
    dispatchPointer("pointermove", object.x + 80, object.y);
    dispatchPointer("pointerup", object.x + 80, object.y);

    expect(playground.paused).toBe(false);
  });

  it("keeps ordinary object placement paused", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("free-fall");
    const object = [...playground.objects.values()][0];

    dispatchPointer("pointerdown", object.x, object.y);
    dispatchPointer("pointermove", object.x + 40, object.y + 40);
    dispatchPointer("pointerup", object.x + 40, object.y + 40);

    expect(playground.paused).toBe(true);
  });

  it("labels upward movement as a positive 90 degree angle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const angleLabel = playground as unknown as {
      displayAngle(vector: { x: number; y: number }): number;
    };

    expect(angleLabel.displayAngle({ x: 0, y: -1 })).toBe(90);
    expect(angleLabel.displayAngle({ x: -1, y: 0 })).toBe(180);
    expect(angleLabel.displayAngle({ x: 0, y: 1 })).toBe(270);
  });
});

describe("PhysicsPlayground trajectory preview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("curves the preview according to the selected gravity", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const object = playground.addCircle(160, 160, 20);
    const preview = playground as unknown as {
      predictedPath(
        target: typeof object,
        velocity: { x: number; y: number },
        acceleration: { x: number; y: number },
      ): Array<{ x: number; y: number }>;
    };

    const zeroGravity = preview.predictedPath(object, { x: 120, y: -60 }, { x: 0, y: 0 });
    const earthGravity = preview.predictedPath(object, { x: 120, y: -60 }, { x: 0, y: 9.81 * 48 });

    expect(zeroGravity.length).toBeGreaterThan(3);
    expect(earthGravity.length).toBeGreaterThan(3);
    expect(earthGravity[3].x).toBeCloseTo(zeroGravity[3].x);
    expect(earthGravity[3].y).toBeGreaterThan(zeroGravity[3].y);
  });

  it("draws the dotted preview only while the world is paused", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, setLineDash } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.addCircle(160, 160, 20, { velocity: { x: 2, y: -2 } });
    const renderer = playground as unknown as { render(): void };

    renderer.render();
    expect(setLineDash).toHaveBeenCalledWith([5, 8]);

    setLineDash.mockClear();
    playground.paused = false;
    renderer.render();
    expect(setLineDash).not.toHaveBeenCalledWith([5, 8]);
  });
});
