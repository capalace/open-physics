import { describe, expect, it } from "vitest";
import { ThermalWorld, type ThermalSceneId, type ThermalTool } from "./models";

describe("ThermalWorld", () => {
  it("resets every guided scene to an identical deterministic state", () => {
    const world = new ThermalWorld("particles");
    const first = world.snapshot();
    world.step(0.5);
    world.setControl(0.9);
    world.reset("particles");
    expect(world.snapshot()).toEqual(first);
  });

  it("connects each direct control to its characteristic thermal calculation", () => {
    const changes: Array<[ThermalSceneId, (world: ThermalWorld) => number]> = [
      ["particles", (world) => world.snapshot().temperature],
      ["heat-transfer", (world) => world.snapshot().heatFlow],
      ["phase-change", (world) => world.snapshot().liquidFraction],
      ["gas", (world) => world.snapshot().pressure],
      ["heat-energy", (world) => world.snapshot().temperature],
      ["heat-engine", (world) => world.snapshot().efficiency],
      ["entropy", (world) => world.snapshot().entropy],
    ];
    for (const [scene, measure] of changes) {
      const world = new ThermalWorld(scene);
      world.setControl(0.2); const low = measure(world);
      world.setControl(0.85); const high = measure(world);
      expect(high, scene).not.toBeCloseTo(low);
      expect(world.snapshot().graph.length, scene).toBeGreaterThan(1);
    }
  });

  it("uses particle motion, phase fraction, energy packets and P-V states instead of color alone", () => {
    const particles = new ThermalWorld("particles");
    particles.setControl(0.1); const slow = particles.snapshot().particles.map((particle) => particle.speed);
    particles.setControl(0.9); const fast = particles.snapshot().particles.map((particle) => particle.speed);
    expect(fast.reduce((a, b) => a + b)).toBeGreaterThan(slow.reduce((a, b) => a + b));

    const phase = new ThermalWorld("phase-change"); phase.setControl(0.45);
    expect(phase.snapshot()).toMatchObject({ temperature: 0 });
    expect(phase.snapshot().liquidFraction).toBeGreaterThan(0);

    const gas = new ThermalWorld("gas"); gas.setControl(0.1); const compressed = gas.snapshot(); gas.setControl(0.9); const expanded = gas.snapshot();
    expect(compressed.volume).toBeLessThan(expanded.volume);
    expect(compressed.pressure).toBeGreaterThan(expanded.pressure);

    const engine = new ThermalWorld("heat-engine"); engine.step(0.4); const first = engine.snapshot(); engine.step(0.4); const second = engine.snapshot();
    expect(second.volume).not.toBeCloseTo(first.volume);
    expect(second.pressure).not.toBeCloseTo(first.pressure);
  });

  it("keeps guided apparatus protected and supports every sandbox tool lifecycle", () => {
    const guided = new ThermalWorld("gas");
    expect(guided.removeObject(guided.snapshot().objects[0].id)).toBe(false);
    expect(() => guided.addObject("heater")).toThrow();

    const sandbox = new ThermalWorld("sandbox");
    const types: ThermalTool[] = ["container", "heater", "cooler", "conductor", "insulator", "piston", "thermometer"];
    const added = types.map((type, index) => sandbox.addObject(type, 0.1 + index * 0.1, 0.4));
    expect(new Set(added.map((object) => object.type))).toEqual(new Set(types));
    expect(sandbox.moveObject(added[0].id, 0.8, 0.7)).toBe(true);
    expect(sandbox.snapshot().objects.find((object) => object.id === added[0].id)).toMatchObject({ x: 0.8, y: 0.7 });
    expect(sandbox.removeObject(added[0].id)).toBe(true);
    expect(sandbox.snapshot().objects.some((object) => object.id === added[0].id)).toBe(false);
  });
});
