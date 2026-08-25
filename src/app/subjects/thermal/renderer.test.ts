import { describe, expect, it, vi } from "vitest";
import { ThermalWorld } from "./models";
import { ThermalRenderer } from "./renderer";

function interactiveCanvas() {
  const listeners = new Map<string, (event: PointerEvent) => void>();
  const noop = () => undefined;
  const context = new Proxy({ measureText: () => ({ width: 20 }) }, { get: (target, key) => Reflect.get(target, key) ?? noop });
  const canvas = {
    width: 800, height: 500, clientWidth: 800, clientHeight: 500, style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
    addEventListener: (type: string, listener: (event: PointerEvent) => void) => listeners.set(type, listener),
    removeEventListener: vi.fn(), setPointerCapture: vi.fn(),
  } as unknown as HTMLCanvasElement;
  return { canvas, pointer: (type: string, x: number, y: number) => listeners.get(type)?.({ clientX: x, clientY: y, pointerId: 1 } as PointerEvent) };
}

describe("ThermalRenderer direct manipulation", () => {
  it("turns a pointer drag into a model, particle and graph change", () => {
    const world = new ThermalWorld("particles");
    const before = world.snapshot();
    const { canvas, pointer } = interactiveCanvas();
    const changed = vi.fn();
    const renderer = new ThermalRenderer(world, canvas, changed);
    pointer("pointerdown", 120, 448);
    pointer("pointermove", 720, 448);
    pointer("pointerup", 720, 448);
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
    new ThermalRenderer(world, canvas);
    pointer("pointerdown", object.x * 800, object.y * 410);
    pointer("pointermove", 640, 164);
    pointer("pointerup", 640, 164);
    expect(world.snapshot().objects[0]).toMatchObject({ x: 0.8, y: 0.4 });
  });
});
