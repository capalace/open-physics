import { describe, expect, it, vi } from "vitest";
import { ThermalWorld } from "./models";
import { ThermalRenderer } from "./renderer";

function interactiveCanvas() {
  const listeners = new Map<string, (event: PointerEvent) => void>();
  const noop = () => undefined;
  const context = new Proxy({ measureText: () => ({ width: 20 }) }, { get: (target, key) => Reflect.get(target, key) ?? noop });
  const removeEventListener = vi.fn((type: string, listener: (event: PointerEvent) => void) => {
    if (listeners.get(type) === listener) listeners.delete(type);
  });
  const canvas = {
    width: 800, height: 500, clientWidth: 800, clientHeight: 500, style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
    addEventListener: (type: string, listener: (event: PointerEvent) => void) => listeners.set(type, listener),
    removeEventListener, setPointerCapture: vi.fn(),
  } as unknown as HTMLCanvasElement;
  return {
    canvas,
    removeEventListener,
    pointer: (type: string, x: number, y: number) => listeners.get(type)?.({ clientX: x, clientY: y, pointerId: 1 } as PointerEvent),
  };
}

describe("ThermalRenderer direct manipulation", () => {
  it("turns a pointer drag into a model, particle and graph change", () => {
    const world = new ThermalWorld("particles");
    const before = world.snapshot();
    const { canvas, pointer } = interactiveCanvas();
    const changed = vi.fn();
    const renderer = new ThermalRenderer(world, canvas, changed);
    pointer("pointerdown", 120, 260);
    pointer("pointermove", 120, 100);
    pointer("pointerup", 120, 100);
    const after = world.snapshot();
    expect(after.control).toBeGreaterThan(0.9);
    expect(after.temperature).toBeGreaterThan(before.temperature);
    expect(after.particles[0].speed).toBeGreaterThan(before.particles[0].speed);
    expect(after.graph).not.toEqual(before.graph);
    expect(changed).toHaveBeenCalled();
    renderer.destroy();
  });

  it("drags sandbox apparatus without changing guided apparatus through that path", () => {
    const world = new ThermalWorld("sandbox");
    const object = world.snapshot().objects[0];
    const { canvas, pointer } = interactiveCanvas();
    const renderer = new ThermalRenderer(world, canvas);
    pointer("pointerdown", object.x * 800, object.y * 410);
    pointer("pointermove", 640, 164);
    pointer("pointerup", 640, 164);
    expect(world.snapshot().objects[0]).toMatchObject({ x: 0.8, y: 0.4 });
    renderer.destroy();
  });

  it("hit-tests each guided scene's own apparatus handle", () => {
    const drags = [
      ["particles", [120, 260], [120, 120]],
      ["heat-transfer", [400, 205], [500, 205]],
      ["phase-change", [656, 305], [656, 110]],
      ["gas", [574, 190], [320, 190]],
      ["heat-energy", [376, 72], [610, 72]],
      ["heat-engine", [144, 190], [144, 95]],
      ["entropy", [400, 332], [400, 100]],
    ] as const;
    for (const [scene, from, to] of drags) {
      const world = new ThermalWorld(scene);
      const before = world.snapshot();
      const { canvas, pointer } = interactiveCanvas();
      const renderer = new ThermalRenderer(world, canvas);
      pointer("pointerdown", from[0], from[1]);
      pointer("pointermove", to[0], to[1]);
      pointer("pointerup", to[0], to[1]);
      expect(world.snapshot().control, scene).not.toBeCloseTo(before.control);
      renderer.destroy();
    }
  });

  it("removes every Canvas listener when destroyed", () => {
    const world = new ThermalWorld("particles");
    const { canvas, pointer, removeEventListener } = interactiveCanvas();
    const renderer = new ThermalRenderer(world, canvas);
    renderer.destroy();
    pointer("pointerdown", 120, 260);
    pointer("pointermove", 120, 100);
    expect(world.snapshot().control).toBeCloseTo(0.42);
    expect(removeEventListener).toHaveBeenCalledTimes(4);
  });
});
