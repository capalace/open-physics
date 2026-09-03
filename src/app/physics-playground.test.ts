import { afterEach, describe, expect, it, vi } from "vitest";
import { mechanicsForceDirection, PhysicsPlayground } from "./physics-playground";

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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height }),
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

  it("creates distinct moving and fixed sandbox primitives", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();

    const ball = playground.addSandboxObject("ball");
    const box = playground.addSandboxObject("box");
    const block = playground.addSandboxObject("block");

    expect(ball.shape).toBe("circle");
    expect(playground.simulation.getBody(ball.id)?.collider).toEqual({ kind: "circle", radius: 25 });
    expect(box.shape).toBe("box");
    expect(playground.simulation.getBody(box.id)?.collider).toEqual({ kind: "box", halfWidth: 28, halfHeight: 28 });
    expect(playground.simulation.getBody(box.id)?.fixed).not.toBe(true);
    expect(block).toMatchObject({ shape: "box", width: 170, height: 26 });
    expect(playground.simulation.getBody(block.id)?.fixed).toBe(true);
  });

  it("creates a fixed point that can anchor a rope", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();

    const anchor = playground.addSandboxObject("anchor");

    expect(anchor).toMatchObject({ shape: "circle", anchor: true, label: expect.stringContaining("고정점") });
    expect(playground.simulation.getBody(anchor.id)?.fixed).toBe(true);
  });

  it("connects two sandbox objects with a fixed-length rope", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const first = [...playground.objects.values()][0];
    const second = playground.addSandboxObject("ball");
    playground.select(first.id);

    expect(playground.startRopeConnection()).toBe(true);
    expect(playground.snapshot().ropeConnection).toMatchObject({ startId: first.id });
    dispatchPointer("pointerdown", second.x, second.y);

    const [rope] = playground.simulation.constraints;
    expect(rope).toMatchObject({ bodyA: first.id, bodyB: second.id });
    expect(rope.distance).toBeCloseTo(Math.hypot(second.x - first.x, second.y - first.y));
    expect(playground.snapshot().ropeConnection).toBeNull();

    dispatchPointer("pointerdown", second.x, second.y);
    dispatchPointer("pointermove", second.x + 100, second.y + 50);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeCloseTo(rope.distance);
    dispatchPointer("pointerup", second.x, second.y);

    const firstBody = playground.simulation.getBody(first.id)!;
    const secondBody = playground.simulation.getBody(second.id)!;
    secondBody.state.position.x += 100;
    playground.simulation.step(1 / 120);
    expect(Math.hypot(
      secondBody.state.position.x - firstBody.state.position.x,
      secondBody.state.position.y - firstBody.state.position.y,
    )).toBeCloseTo(rope.distance);
  });

  it("connects two sandbox objects with a visibly rigid rod", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const first = [...playground.objects.values()][0];
    const second = playground.addSandboxObject("ball");
    playground.select(first.id);

    expect(playground.startConnection("rod")).toBe(true);
    dispatchPointer("pointerdown", second.x, second.y);

    expect(playground.simulation.constraints).toEqual([
      expect.objectContaining({ id: expect.stringContaining("sandbox-rod-"), bodyA: first.id, bodyB: second.id }),
    ]);
  });

  it("adds a direct force that can cross the static-friction threshold", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const object = [...playground.objects.values()][0];
    const body = playground.simulation.getBody(object.id)!;
    body.state.position.y = playground.floorY - object.radius;
    playground.updateSelected({ material: "clay" });

    expect(playground.toggleForceForSelected()).toBe(true);
    expect(body.state.acceleration.x).toBe(0);

    const controller = playground as unknown as {
      forceLaws: Map<string, { setVector(vector: { x: number; y: number }): void }>;
    };
    controller.forceLaws.get(object.id)!.setVector({ x: 12 * 48, y: 0 });
    playground.simulation.refreshAccelerations();

    expect(body.state.acceleration.x).toBeGreaterThan(0);
    expect(playground.snapshot().appliedForceIds).toContain(object.id);
  });

  it("changes a direct force by dragging its arrow handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const object = [...playground.objects.values()][0];

    playground.toggleForceForSelected();
    dispatchPointer("pointerdown", object.x + 40, object.y);
    dispatchPointer("pointermove", object.x + 100, object.y);
    dispatchPointer("pointerup", object.x + 100, object.y);

    expect(playground.snapshot().observation?.appliedForce).toBeCloseTo(9.6);
    expect(playground.paused).toBe(false);
  });

  it("adds a movable point-gravity source to the sandbox", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const moving = [...playground.objects.values()][0];

    expect(playground.toggleSandboxEnvironment("gravity-source")).toBe(true);
    const source = [...playground.objects.values()].find((object) => object.gravitySource)!;
    const movingBody = playground.simulation.getBody(moving.id)!;
    movingBody.state.position = { x: source.x + 180, y: source.y };
    playground.simulation.refreshAccelerations();

    expect(playground.gravity).toBe(0);
    expect(movingBody.state.acceleration.x).toBeLessThan(0);
    expect(playground.snapshot().environment.gravitySourceCount).toBe(1);
  });

  it("removes a point-gravity field with its source object", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    playground.toggleSandboxEnvironment("gravity-source");
    const source = [...playground.objects.values()].find((object) => object.gravitySource)!;

    playground.select(source.id);
    playground.removeSelected();

    expect(playground.snapshot().environment.gravitySourceCount).toBe(0);
    expect(playground.simulation.fields.some((field) => field.id.endsWith(source.id))).toBe(false);
  });

  it("applies one sandbox water area to light and heavy objects", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const object = [...playground.objects.values()][0];
    const body = playground.simulation.getBody(object.id)!;

    expect(playground.toggleSandboxEnvironment("water")).toBe(true);
    const controller = playground as unknown as { sandboxWater: { waterline: number } };
    body.state.position.y = controller.sandboxWater.waterline + object.radius;
    playground.updateSelected({ mass: 0.5 });
    const lightAcceleration = body.state.acceleration.y;
    playground.updateSelected({ mass: 5 });
    const heavyAcceleration = body.state.acceleration.y;

    expect(lightAcceleration).toBeLessThan(0);
    expect(heavyAcceleration).toBeGreaterThan(0);
    expect(playground.snapshot().environment.water).toBe(true);
  });

  it("turns the shared sandbox water area off without changing objects", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const objectCount = playground.objects.size;

    expect(playground.toggleSandboxEnvironment("water")).toBe(true);
    expect(playground.toggleSandboxEnvironment("water")).toBe(false);

    expect(playground.snapshot().environment.water).toBe(false);
    expect(playground.objects.size).toBe(objectCount);
    expect(playground.simulation.laws.some((law) => law.id === "fluid.buoyancy.sandbox")).toBe(false);
  });

  it("removes a rope when either connected endpoint is deleted", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const moving = [...playground.objects.values()][0];
    const anchor = playground.addSandboxObject("anchor");
    playground.select(moving.id);
    playground.startRopeConnection();
    dispatchPointer("pointerdown", anchor.x, anchor.y);

    playground.select(anchor.id);
    playground.removeSelected();

    expect(playground.simulation.constraints).toEqual([]);
  });

  it("connects a sandbox spring to the selected movable object", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const selected = [...playground.objects.values()][0];

    const connected = playground.addSandboxApparatus("spring");
    const controller = playground as unknown as {
      sandboxSpringLaws: Map<string, { bodyId: string }>;
    };

    expect(connected.id).toBe(selected.id);
    expect(controller.sandboxSpringLaws.get(selected.id)?.bodyId).toBe(selected.id);
    expect(playground.objects.size).toBe(1);
  });

  it("keeps multiple sandbox springs while adding a guided apparatus", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const first = [...playground.objects.values()][0];
    playground.addSandboxApparatus("spring");
    const second = playground.addSandboxObject("ball");
    playground.addSandboxApparatus("spring");
    playground.addSandboxApparatus("lever");
    const controller = playground as unknown as {
      sandboxSpringLaws: Map<string, unknown>;
      guidedScene: { kind: string } | null;
    };

    expect(controller.sandboxSpringLaws.has(first.id)).toBe(true);
    expect(controller.sandboxSpringLaws.has(second.id)).toBe(true);
    expect(controller.guidedScene?.kind).toBe("lever");
  });

  it("keeps lever and pulley apparatus together with ordinary objects", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const ordinary = [...playground.objects.values()][0];

    const leverLoad = playground.addSandboxApparatus("lever");
    expect(playground.objects.has(ordinary.id)).toBe(true);
    expect(playground.simulation.getBody(ordinary.id)!.state.position.y).toBeGreaterThan(400);

    const pulleyLoad = playground.addSandboxApparatus("pulley");
    const controller = playground as unknown as {
      guidedScene: { kind: string } | null;
      sandboxGuidedScenes: Array<{ kind: string }>;
    };

    expect(playground.objects.has(ordinary.id)).toBe(true);
    expect(playground.objects.has(leverLoad.id)).toBe(true);
    expect(playground.objects.has(pulleyLoad.id)).toBe(true);
    expect(playground.objects.size).toBe(3);
    expect(controller.sandboxGuidedScenes.map((scene) => scene.kind)).toContain("lever");
    expect(controller.guidedScene?.kind).toBe("pulley-advantage");
    expect(playground.snapshot().selected).toMatchObject({ id: pulleyLoad.id, guided: true });
  });

  it("resizes a fixed block by dragging its corner handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const block = playground.addSandboxObject("block");
    const left = block.x - block.width / 2;
    const top = block.y - block.height / 2;

    dispatchPointer("pointerdown", block.x + block.width / 2, block.y + block.height / 2);
    dispatchPointer("pointermove", left + 240, top + 120);
    dispatchPointer("pointerup", left + 240, top + 120);

    expect(block).toMatchObject({
      x: left + 120,
      y: top + 60,
      width: 240,
      height: 120,
    });
    expect(playground.simulation.getBody(block.id)?.collider).toEqual({
      kind: "box",
      halfWidth: 120,
      halfHeight: 60,
    });
  });

  it("resizes only one axis from a block edge handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const block = playground.addSandboxObject("block");
    const left = block.x - block.width / 2;
    const top = block.y - block.height / 2;

    dispatchPointer("pointerdown", block.x + block.width / 2, block.y);
    dispatchPointer("pointermove", left + 230, block.y);
    dispatchPointer("pointerup", left + 230, block.y);
    expect(block).toMatchObject({ width: 230, height: 26, x: left + 115 });

    dispatchPointer("pointerdown", block.x, block.y + block.height / 2);
    dispatchPointer("pointermove", block.x, top + 110);
    dispatchPointer("pointerup", block.x, top + 110);
    expect(block).toMatchObject({ width: 230, height: 110, y: top + 55 });
    expect(playground.simulation.getBody(block.id)?.collider).toEqual({
      kind: "box",
      halfWidth: 115,
      halfHeight: 55,
    });
  });

  it("rotates a fixed block in 15 degree steps by dragging its top handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const block = playground.addSandboxObject("block");
    const handleDistance = block.height / 2 + 38;

    dispatchPointer("pointerdown", block.x, block.y - handleDistance);
    dispatchPointer(
      "pointermove",
      block.x + Math.sin(Math.PI / 6) * handleDistance,
      block.y - Math.cos(Math.PI / 6) * handleDistance,
    );
    dispatchPointer("pointerup", block.x, block.y - handleDistance);

    expect(block.angle).toBeCloseTo(Math.PI / 6);
    expect(playground.snapshot().selected?.angleDegrees).toBeCloseTo(30);
    expect(playground.simulation.getBody(block.id)?.collider).toMatchObject({
      kind: "box",
      angle: Math.PI / 6,
    });
  });

  it("keeps block resizing aligned with the rotated block", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const block = playground.addSandboxObject("block");
    const angle = Math.PI / 6;
    const handleDistance = block.height / 2 + 38;
    dispatchPointer("pointerdown", block.x, block.y - handleDistance);
    dispatchPointer(
      "pointermove",
      block.x + Math.sin(angle) * handleDistance,
      block.y - Math.cos(angle) * handleDistance,
    );
    dispatchPointer("pointerup", block.x, block.y - handleDistance);

    const rotate = (x: number, y: number) => ({
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    });
    const topLeft = rotate(-block.width / 2, -block.height / 2);
    const bottomRight = rotate(block.width / 2, block.height / 2);
    const target = rotate(240, 70);
    const anchor = { x: block.x + topLeft.x, y: block.y + topLeft.y };
    dispatchPointer("pointerdown", block.x + bottomRight.x, block.y + bottomRight.y);
    dispatchPointer("pointermove", anchor.x + target.x, anchor.y + target.y);
    dispatchPointer("pointerup", anchor.x + target.x, anchor.y + target.y);

    expect(block.width).toBeCloseTo(240);
    expect(block.height).toBeCloseTo(70);
    expect(block.angle).toBeCloseTo(angle);
    const collider = playground.simulation.getBody(block.id)?.collider;
    expect(collider).toMatchObject({ kind: "box", angle });
    expect(collider?.kind === "box" ? collider.halfWidth : 0).toBeCloseTo(120);
    expect(collider?.kind === "box" ? collider.halfHeight : 0).toBeCloseTo(35);
  });

  it("slides a low-friction ball down a rotated sandbox block", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.startSandbox();
    const ball = [...playground.objects.values()][0];
    const block = playground.addSandboxObject("block");
    const angle = -Math.PI / 6;
    const handleDistance = block.height / 2 + 38;
    dispatchPointer("pointerdown", block.x, block.y - handleDistance);
    dispatchPointer(
      "pointermove",
      block.x + Math.sin(angle) * handleDistance,
      block.y - Math.cos(angle) * handleDistance,
    );
    dispatchPointer("pointerup", block.x, block.y - handleDistance);

    playground.select(ball.id);
    playground.updateSelected({ material: "steel" });
    const ballBody = playground.simulation.getBody(ball.id)!;
    const alongRamp = { x: Math.cos(angle), y: Math.sin(angle) };
    const outward = { x: Math.sin(angle), y: -Math.cos(angle) };
    ballBody.state.position = {
      x: block.x + alongRamp.x * 24 + outward.x * (block.height / 2 + ball.radius),
      y: block.y + alongRamp.y * 24 + outward.y * (block.height / 2 + ball.radius),
    };
    ballBody.state.velocity = { x: 0, y: 0 };
    const startX = ballBody.state.position.x;

    for (let step = 0; step < 90; step += 1) playground.simulation.step(1 / 120);

    expect(ballBody.state.position.x).toBeLessThan(startX - 4);
  });
});

describe("PhysicsPlayground force diagrams", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows gravity and its downward net force during free fall", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("free-fall");

    const diagram = playground.snapshot().forceDiagram!;

    expect(diagram.objectLabel).toBe("무거운 공");
    expect(diagram.forces.map((force) => force.label)).toEqual(["중력"]);
    expect(diagram.net.magnitude).toBeCloseTo(3 * 9.81);
    expect(diagram.net.direction).toBe("아래쪽");
    expect(diagram.balanced).toBe(false);
    expect(playground.snapshot().observation).toMatchObject({
      speedDirection: "멈춤",
      accelerationDirection: "아래쪽",
    });
  });

  it("draws guided vectors without floating labels that overlap around the object", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("free-fall");
    const renderer = playground as unknown as { render(): void };

    renderer.render();

    const labels = fillText.mock.calls.map(([label]) => String(label));
    expect(labels).not.toContain("운동 방향");
    expect(labels).not.toContain("여기서 끌어 보세요");
    expect(labels).not.toContain("가속도");
    expect(labels.some((label) => label.startsWith("알짜힘 "))).toBe(false);
    expect(labels.some((label) => label.startsWith("중력 "))).toBe(false);
  });

  it("keeps the ground label above the bottom overlay", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("friction");
    const renderer = playground as unknown as { render(): void };

    renderer.render();

    expect(canvas.height - playground.floorY).toBeGreaterThanOrEqual(76);
    const floorLabel = fillText.mock.calls.find(([label]) => label === "마찰이 있는 바닥");
    expect(floorLabel?.[2]).toBeLessThan(playground.floorY - 8);
  });

  it("separates applied force, friction, weight, and normal force on a pushed box", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("friction");
    const controller = playground as unknown as {
      frictionLaw: { setAppliedForce(force: number): void };
    };
    controller.frictionLaw.setAppliedForce(100 * 48);
    playground.simulation.refreshAccelerations();

    const diagram = playground.snapshot().forceDiagram!;
    const labels = diagram.forces.map((force) => force.label);

    expect(labels).toEqual(expect.arrayContaining(["주는 힘", "마찰력", "중력", "수직항력"]));
    expect(diagram.net.direction).toBe("오른쪽");
    expect(diagram.net.magnitude).toBeGreaterThan(70);
  });

  it("uses child-friendly eight-way direction labels", () => {
    expect(mechanicsForceDirection({ x: 0, y: -10 })).toBe("위쪽");
    expect(mechanicsForceDirection({ x: 10, y: 0 })).toBe("오른쪽");
    expect(mechanicsForceDirection({ x: -10, y: 10 })).toBe("아래왼쪽");
    expect(mechanicsForceDirection({ x: 0, y: 0 })).toBe("힘이 균형을 이뤄요");
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

  it("keeps an object still while it rests on a fixed block", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600, gravity: 9.81 });
    playground.startSandbox();
    const object = [...playground.objects.values()][0];
    const block = playground.addSandboxObject("block");
    const body = playground.simulation.getBody(object.id)!;
    const blockBody = playground.simulation.getBody(block.id)!;
    const advance = playground as unknown as { advance(dt: number): void };
    blockBody.state.position = { x: 480, y: 420 };
    body.state.position = {
      x: 480,
      y: blockBody.state.position.y - block.height / 2 - object.radius,
    };
    body.state.velocity = { x: 0, y: 0 };

    const verticalSpeeds: number[] = [];
    let collisionFrames = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      advance.advance(1 / 120);
      verticalSpeeds.push(body.state.velocity.y);
      if (playground.simulation.collisionEvents.length > 0) collisionFrames += 1;
    }

    expect(Math.max(...verticalSpeeds.map(Math.abs))).toBeLessThan(0.001);
    expect(collisionFrames).toBe(0);
    expect(body.state.position.y).toBeCloseTo(
      blockBody.state.position.y - block.height / 2 - object.radius,
    );
  });

  it("settles after a meaningful bounce on a fixed block", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600, gravity: 9.81 });
    playground.startSandbox();
    const object = [...playground.objects.values()][0];
    const block = playground.addSandboxObject("block");
    const body = playground.simulation.getBody(object.id)!;
    const blockBody = playground.simulation.getBody(block.id)!;
    const advance = playground as unknown as { advance(dt: number): void };
    blockBody.state.position = { x: 480, y: 420 };
    body.state.position = {
      x: 480,
      y: blockBody.state.position.y - block.height / 2 - object.radius,
    };
    body.state.velocity = { x: 0, y: 100 };

    advance.advance(1 / 120);
    expect(body.state.velocity.y).toBeLessThan(0);

    const finalVerticalSpeeds: number[] = [];
    for (let frame = 0; frame < 600; frame += 1) {
      advance.advance(1 / 120);
      if (frame >= 480) finalVerticalSpeeds.push(body.state.velocity.y);
    }

    expect(Math.max(...finalVerticalSpeeds.map(Math.abs))).toBeLessThan(0.001);
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

  it("slows a clay object more strongly than a steel object on the sandbox floor", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const finalSpeed = (material: "clay" | "steel"): number => {
      const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
      playground.startSandbox();
      const object = [...playground.objects.values()][0];
      playground.updateSelected({ material });
      const body = playground.simulation.getBody(object.id)!;
      const advance = playground as unknown as { advance(dt: number): void };
      body.state.position.y = playground.floorY - object.radius;
      body.state.velocity.x = 240;

      for (let frame = 0; frame < 60; frame += 1) advance.advance(1 / 120);
      return Math.abs(body.state.velocity.x);
    };

    expect(finalSpeed("clay")).toBeLessThan(finalSpeed("steel"));
  });

  it("does not apply floor friction without gravity", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    playground.setGravity(0);
    const object = [...playground.objects.values()][0];
    playground.updateSelected({ material: "clay" });
    const body = playground.simulation.getBody(object.id)!;
    const advance = playground as unknown as { advance(dt: number): void };
    body.state.position.y = playground.floorY - object.radius;
    body.state.velocity.x = 120;

    for (let frame = 0; frame < 60; frame += 1) advance.advance(1 / 120);

    expect(body.state.velocity.x).toBeCloseTo(120);
  });

  it("uses the selected fixed block material as a friction surface", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const finalSpeed = (surfaceMaterial: "clay" | "steel"): number => {
      const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
      playground.startSandbox();
      const moving = [...playground.objects.values()][0];
      const block = playground.addBox(480, 400, 420, 30, {
        fixed: true,
        material: "steel",
      });
      playground.updateSelected({ material: surfaceMaterial });
      playground.select(moving.id);
      playground.updateSelected({ material: "clay" });
      const body = playground.simulation.getBody(moving.id)!;
      body.state.position = { x: 300, y: 400 - block.height / 2 - moving.radius };
      body.state.velocity = { x: 240, y: 0 };
      const advance = playground as unknown as { advance(dt: number): void };

      for (let frame = 0; frame < 120; frame += 1) advance.advance(1 / 120);
      return Math.abs(body.state.velocity.x);
    };

    expect(finalSpeed("clay")).toBeLessThan(finalSpeed("steel"));
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

  it("centers the three free-fall balls when the preset loads in a wide world", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 1400, height: 600 });

    playground.loadPreset("free-fall");

    const positions = playground.simulation.allBodies.map((body) => body.state.position.x);
    const groupCenter = positions.reduce((sum, x) => sum + x, 0) / positions.length;
    expect(positions[1]).toBeCloseTo(playground.canvas.width / 2);
    expect(positions[1] - positions[0]).toBeCloseTo(positions[2] - positions[1]);
    expect(groupCenter).toBeCloseTo(playground.canvas.width / 2);
  });
});

describe("PhysicsPlayground lab graphs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("provides a meaningful graph for every mechanics lab", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const expectedTitles = new Map([
      ["free-fall", "바닥까지 남은 높이"],
      ["projectile", "발사체의 높이"],
      ["collision", "두 물체의 운동량"],
      ["spring", "에너지가 바뀌는 모습"],
      ["friction", "미는 힘과 버티는 힘"],
      ["rotation", "지렛대에 필요한 힘"],
      ["constraints", "두 진자의 각도"],
      ["pulley", "줄 수에 따른 필요한 힘"],
      ["orbit", "발사 속력과 궤도 기준"],
      ["buoyancy", "물에 잠긴 깊이"],
    ]);

    for (const [preset, title] of expectedTitles) {
      playground.loadPreset(preset as Parameters<typeof playground.loadPreset>[0]);
      const graph = playground.snapshot().graph!;
      expect(graph).toMatchObject({ title, xLabel: "시간", samples: [{ time: 0 }] });
      expect(graph.samples[0].values).toHaveLength(graph.series.length);
      expect(graph.samples[0].values.every(Number.isFinite)).toBe(true);
    }
  });

  it("collects graph samples while a lab runs and clears them on reset", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    const advance = playground as unknown as { advance(dt: number): void };
    playground.loadPreset("collision", true);

    for (let frame = 0; frame < 120; frame += 1) advance.advance(1 / 120);

    expect(playground.snapshot().graph?.series.map((series) => series.label)).toEqual(["물체 A", "물체 B"]);
    expect(playground.snapshot().graph?.samples.length).toBeGreaterThan(5);
    playground.reset();
    expect(playground.snapshot().graph?.samples).toHaveLength(1);
  });

  it("shows a selected-object speed graph and observation values in the free playground", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.startSandbox();
    const selected = playground.snapshot().selected!;
    const body = playground.simulation.getBody(selected.id)!;
    body.state.velocity = { x: 3 * 48, y: 4 * 48 };
    playground.simulation.refreshAccelerations();

    expect(playground.snapshot().graph).toMatchObject({
      title: `${selected.label}의 속력`,
      yLabel: "속력 (m/s)",
    });
    expect(playground.snapshot().observation).toMatchObject({
      speed: 5,
      momentum: 5,
      kineticEnergy: 12.5,
    });
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

  it("holds a pushed box until maximum static friction is exceeded", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("friction");
    const body = playground.simulation.allBodies[0];
    const controller = playground as unknown as { frictionHandlePoint(): { x: number; y: number } };
    const handle = controller.frictionHandlePoint();

    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x + 19, handle.y);
    expect(body.state.acceleration.x).toBeCloseTo(0);

    dispatchPointer("pointermove", handle.x + 74, handle.y);
    expect(body.state.acceleration.x).toBeGreaterThan(0);
    const values = playground.snapshot().graph!.samples.at(-1)!.values;
    expect(values[0]).toBeGreaterThan(values[1]);
  });

  it("changes maximum static friction when the selected material changes", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });
    playground.loadPreset("friction");
    const body = playground.simulation.allBodies[0];
    const woodLimit = playground.snapshot().graph!.samples.at(-1)!.values[1];

    playground.updateSelected({ material: "clay" });

    const clayLimit = playground.snapshot().graph!.samples.at(-1)!.values[1];
    expect(clayLimit).toBeGreaterThan(woodLimit);
    expect(body.state.acceleration.x).toBeCloseTo(0);
  });

  it("summarizes stable friction and pulley results for side-by-side comparison", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createCanvas(), { width: 960, height: 600 });

    playground.loadPreset("friction");
    const friction = playground.snapshot().comparison;
    expect(friction?.condition).toContain("나무");
    expect(friction?.values[0]).toMatchObject({ label: "움직이기 시작하는 힘", unit: "N" });

    playground.loadPreset("pulley");
    const pulley = playground.snapshot().comparison;
    expect(pulley?.condition).toContain("1줄");
    expect(pulley?.values.map((value) => value.label)).toEqual(["필요한 힘", "1 m 올릴 때 당기는 줄"]);
  });

  it("exposes post-collision horizontal velocities to the prediction comparison", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("collision");

    expect(playground.snapshot().collision).toMatchObject({ occurred: false });
    let collided = false;
    for (let frame = 0; frame < 360 && !collided; frame += 1) {
      playground.paused = true;
      playground.stepOnce();
      collided = playground.snapshot().collision?.occurred ?? false;
    }

    expect(collided).toBe(true);
    expect(playground.snapshot().collision?.velocityA).toEqual(expect.any(Number));
    expect(playground.snapshot().collision?.velocityB).toEqual(expect.any(Number));
  });

  it("draws the spring as a densely sampled smooth coil", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, lineTo } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("spring");
    const renderer = playground as unknown as {
      springLaw: { bodyId: string };
      drawSpringConnection(law: { bodyId: string }): void;
    };

    renderer.drawSpringConnection(renderer.springLaw);

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

  it("needs less force when the lever effort point is farther from the pivot", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("rotation");
    dispatchPointer("pointerdown", 543, 320);
    const nearForce = playground.snapshot().graph!.samples.at(-1)!.values[1];

    dispatchPointer("pointerdown", 702, 320);
    const farForce = playground.snapshot().graph!.samples.at(-1)!.values[1];
    expect(farForce).toBeLessThan(nearForce);
  });

  it("lifts the lever load when the handle is pulled past the required force", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("rotation");
    const load = playground.simulation.allBodies[0];
    const startY = load.state.position.y;
    dispatchPointer("pointerdown", 692, 390);
    dispatchPointer("pointermove", 692, 510);
    expect(load.state.position.y).toBeLessThan(startY);
  });

  it("stops the lever at its required force after a successful lift", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("rotation");

    dispatchPointer("pointerdown", 692, 390);
    dispatchPointer("pointermove", 692, 500);
    const [successForce, requiredForce] = playground.snapshot().graph!.samples.at(-1)!.values;
    dispatchPointer("pointermove", 692, 580);
    const [extendedForce] = playground.snapshot().graph!.samples.at(-1)!.values;

    expect(successForce).toBeCloseTo(requiredForce);
    expect(extendedForce).toBeCloseTo(requiredForce);
  });

  it("draws the lever with named effort positions, a fulcrum, and a direct handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, fillText } = createRenderingCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("rotation");
    const renderer = playground as unknown as { drawGuidedScene(): void };

    renderer.drawGuidedScene();

    const labels = fillText.mock.calls.map(([label]) => label);
    expect(labels).toEqual(expect.arrayContaining(["가까이", "중간", "멀리", "받침점", "아래로 눌러요"]));
  });

  it("trades more pulling distance for lower force with four pulley strands", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("pulley");
    const load = playground.simulation.allBodies[0];
    const startY = load.state.position.y;
    const oneStrandForce = playground.snapshot().graph!.samples.at(-1)!.values[1];
    const controller = playground as unknown as {
      guidedScene: { kind: string; pullDistance: number };
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };

    dispatchPointer("pointerdown", 584, 86);
    const fourStrandForce = playground.snapshot().graph!.samples.at(-1)!.values[1];
    const handle = controller.pulleyHandlePoint(controller.guidedScene);
    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x, handle.y + 200);

    expect(fourStrandForce).toBeCloseTo(oneStrandForce / 4);
    expect(startY - load.state.position.y).toBeCloseTo(200);
    expect(controller.guidedScene.pullDistance).toBeCloseTo(800);
  });

  it("makes a high-force pulley feel harder to drag", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const oneStrand = createInteractiveCanvas();
    const hardPlayground = new PhysicsPlayground(oneStrand.canvas, { width: 960, height: 600 });
    hardPlayground.loadPreset("pulley");
    const hardLoad = hardPlayground.simulation.allBodies[0];
    const hardStartY = hardLoad.state.position.y;
    const hardController = hardPlayground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };
    const hardHandle = hardController.pulleyHandlePoint(hardController.guidedScene);

    oneStrand.dispatchPointer("pointerdown", hardHandle.x, hardHandle.y);
    oneStrand.dispatchPointer("pointermove", hardHandle.x, hardHandle.y + 200);

    const fourStrands = createInteractiveCanvas();
    const easyPlayground = new PhysicsPlayground(fourStrands.canvas, { width: 960, height: 600 });
    easyPlayground.loadPreset("pulley");
    const easyLoad = easyPlayground.simulation.allBodies[0];
    const easyStartY = easyLoad.state.position.y;
    const easyController = easyPlayground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };

    fourStrands.dispatchPointer("pointerdown", 584, 86);
    const easyHandle = easyController.pulleyHandlePoint(easyController.guidedScene);
    fourStrands.dispatchPointer("pointerdown", easyHandle.x, easyHandle.y);
    fourStrands.dispatchPointer("pointermove", easyHandle.x, easyHandle.y + 200);

    expect(hardStartY - hardLoad.state.position.y).toBeCloseTo(50);
    expect(easyStartY - easyLoad.state.position.y).toBeCloseTo(200);
  });

  it("keeps the pulley handle under the pointer while the load responds by mechanical advantage", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("pulley");
    const controller = playground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };
    const handle = controller.pulleyHandlePoint(controller.guidedScene);

    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x, handle.y + 160);

    expect(controller.pulleyHandlePoint(controller.guidedScene).y).toBeCloseTo(handle.y + 160);
  });

  it("accepts the full visible width of a mechanics drag handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createInteractiveCanvas().canvas, { width: 960, height: 600 });
    playground.loadPreset("rotation");
    const controller = playground as unknown as {
      guidedScene: object;
      leverHandlePoint(scene: object): { x: number; y: number };
      beginChallengeInteraction(point: { x: number; y: number }, pointerId: number): boolean;
    };
    const handle = controller.leverHandlePoint(controller.guidedScene);

    expect(controller.beginChallengeInteraction({ x: handle.x + 29, y: handle.y }, 1)).toBe(true);
  });

  it("keeps the pulley handle where it was released and continues from there", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 800 });
    playground.loadPreset("pulley");
    const load = playground.simulation.allBodies[0];
    const startY = load.state.position.y;
    const controller = playground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };

    dispatchPointer("pointerdown", 584, 86);
    const firstHandle = controller.pulleyHandlePoint(controller.guidedScene);
    dispatchPointer("pointerdown", firstHandle.x, firstHandle.y);
    dispatchPointer("pointermove", firstHandle.x, firstHandle.y + 200);
    dispatchPointer("pointerup", firstHandle.x, firstHandle.y + 200);

    const secondHandle = controller.pulleyHandlePoint(controller.guidedScene);
    expect(secondHandle.y).toBeCloseTo(firstHandle.y + 200);

    dispatchPointer("pointerdown", secondHandle.x, secondHandle.y);
    dispatchPointer("pointermove", secondHandle.x, secondHandle.y + 100);
    dispatchPointer("pointerup", secondHandle.x, secondHandle.y + 100);

    expect(startY - load.state.position.y).toBeCloseTo(300);
    expect(controller.pulleyHandlePoint(controller.guidedScene).y).toBeCloseTo(firstHandle.y + 300);
  });

  it("stops a full pulley pull at the safe lifting height", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("pulley");
    const load = playground.simulation.allBodies[0];
    const startY = load.state.position.y;
    const controller = playground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };

    dispatchPointer("pointerdown", 584, 86);
    const handle = controller.pulleyHandlePoint(controller.guidedScene);
    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x, handle.y + 250);

    expect(startY - load.state.position.y).toBeCloseTo(200);
  });

  it("uses the full available pulley travel in a tall world", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 800 });
    playground.loadPreset("pulley");
    const load = playground.simulation.allBodies[0];
    const startY = load.state.position.y;
    const controller = playground as unknown as {
      guidedScene: object;
      pulleyHandlePoint(scene: object): { x: number; y: number };
    };

    dispatchPointer("pointerdown", 584, 86);
    const handle = controller.pulleyHandlePoint(controller.guidedScene);
    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x, handle.y + 450);

    expect(startY - load.state.position.y).toBeCloseTo(400);
  });

  it("draws a four-strand block and tackle with detailed wheels and a pull handle", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const rendering = createRenderingCanvas();
    const playground = new PhysicsPlayground(rendering.canvas, { width: 960, height: 600 });
    playground.loadPreset("pulley");
    const controller = playground as unknown as {
      beginChallengeInteraction(point: { x: number; y: number }, pointerId: number): boolean;
      drawGuidedScene(): void;
    };
    controller.beginChallengeInteraction({ x: 584, y: 86 }, 1);

    controller.drawGuidedScene();

    expect(rendering.arc.mock.calls.length).toBeGreaterThan(20);
    expect(rendering.fillText.mock.calls.some(([label]) => label === "당기는 손잡이")).toBe(true);
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

  it("keeps a guided object name uncluttered by an acceleration label", () => {
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
    const acceleration = fillText.mock.calls.find(([text]) => text === "가속도");
    expect(name).toBeDefined();
    expect(acceleration).toBeUndefined();
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
    expect(quadraticCurveTo.mock.calls.length).toBeGreaterThanOrEqual(unselectedRoundedCorners + 4);
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

  it("gives the mechanics velocity handle a finger-sized hit target", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const playground = new PhysicsPlayground(createInteractiveCanvas().canvas, { width: 960, height: 600 });
    const object = playground.addCircle(480, 240, 25);
    const controller = playground as unknown as {
      velocityControlVector(target: typeof object, velocity: { x: number; y: number }): { x: number; y: number };
      hitVelocityHandle(point: { x: number; y: number }): typeof object | null;
    };
    const vector = controller.velocityControlVector(object, { x: 0, y: 0 });

    expect(controller.hitVelocityHandle({ x: object.x + vector.x + 20, y: object.y + vector.y })).toBe(object);
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

  it("can keep direct velocity editing paused for a prediction step", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { canvas, dispatchPointer } = createInteractiveCanvas();
    const playground = new PhysicsPlayground(canvas, { width: 960, height: 600 });
    playground.loadPreset("collision");
    playground.setDirectManipulationAutoPlay(false);
    const first = [...playground.objects.values()][0];
    playground.select(first.id);
    const handle = { x: first.x + 64, y: first.y };

    dispatchPointer("pointerdown", handle.x, handle.y);
    dispatchPointer("pointermove", handle.x + 20, handle.y);
    dispatchPointer("pointerup", handle.x + 20, handle.y);

    expect(playground.paused).toBe(true);
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
