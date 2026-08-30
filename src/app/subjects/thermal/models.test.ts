import { describe, expect, it } from "vitest";
import { ThermalWorld, type ThermalSceneId, type ThermalTool } from "./models";

describe("ThermalWorld", () => {
  it("resets every guided scene to an identical deterministic state", () => {
    for (const scene of ["particles", "heat-transfer", "thermal-expansion", "phase-change", "gas", "heat-energy", "heat-engine", "entropy"] as const) {
      const world = new ThermalWorld(scene);
      const first = world.snapshot();
      world.step(0.5);
      world.setControl(0.9);
      world.reset(scene);
      expect(world.snapshot(), scene).toEqual(first);
    }
  });

  it("connects each direct control to its characteristic thermal calculation", () => {
    const changes: Array<[ThermalSceneId, (world: ThermalWorld) => number]> = [
      ["particles", (world) => world.snapshot().temperature],
      ["heat-transfer", (world) => world.snapshot().heatFlow],
      ["thermal-expansion", (world) => world.snapshot().expansion],
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
      if (scene === "heat-transfer") world.step(0.1);
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
    expect(guided.moveObject(guided.snapshot().objects[0].id, 0.9, 0.9)).toBe(false);
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

  it("stores graph x values in the units promised by each catalog", () => {
    const phase = new ThermalWorld("phase-change"); phase.setControl(0.5);
    expect(phase.snapshot().graph.at(-1)?.x).toBeCloseTo(250);
    const heatEnergy = new ThermalWorld("heat-energy"); heatEnergy.setControl(0.5);
    expect(heatEnergy.snapshot().graph.at(-1)?.x).toBeCloseTo(2.75);
    const entropy = new ThermalWorld("entropy"); entropy.setControl(0.5);
    expect(entropy.snapshot().graph.at(-1)?.x).toBeCloseTo(50);
  });

  it("keeps Celsius scenes separate from Kelvin state", () => {
    expect(new ThermalWorld("phase-change").snapshot().temperatureUnit).toBe("°C");
    expect(new ThermalWorld("heat-energy").snapshot().temperatureUnit).toBe("°C");
    expect(new ThermalWorld("particles").snapshot().temperatureUnit).toBe("K");
  });

  it("uses the same thermodynamic state for the heat-engine Canvas and P-V graph", () => {
    const world = new ThermalWorld("heat-engine");
    world.step(0.37);
    const snapshot = world.snapshot();
    expect(snapshot.graph.some((point) =>
      Math.abs(point.x - snapshot.volume) < 1e-8 && Math.abs(point.values[0] - snapshot.pressure) < 1e-8,
    )).toBe(true);
  });

  it("keeps the gas isotherm sorted after inserting the current state", () => {
    const world = new ThermalWorld("gas"); world.setControl(0.47);
    const xs = world.snapshot().graph.map((point) => point.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("uses each side's temperature for entropy particle speeds", () => {
    const world = new ThermalWorld("entropy");
    const particles = world.snapshot().particles;
    const hot = particles.filter((particle) => particle.group === "hot");
    const cold = particles.filter((particle) => particle.group === "cold");
    const average = (values: typeof particles) => values.reduce((sum, particle) => sum + particle.speed, 0) / values.length;
    expect(average(hot)).toBeGreaterThan(average(cold));
    world.setControl(1);
    expect(new Set(world.snapshot().particles.map((particle) => particle.group))).toEqual(new Set(["mixed"]));
  });

  it("shows greater mass as more particles while the same heat raises temperature less", () => {
    const world = new ThermalWorld("heat-energy");
    world.setControl(0.1); const light = world.snapshot();
    world.setControl(0.9); const heavy = world.snapshot();
    expect(heavy.particles.length).toBeGreaterThan(light.particles.length);
    expect(heavy.temperature - 20).toBeLessThan(light.temperature - 20);
    expect(heavy.energy).toBe(light.energy);
  });

  it("integrates heat transfer without rewriting the past and starts at zero", () => {
    const world = new ThermalWorld("heat-transfer");
    world.setControl(0.2);
    expect(world.snapshot().energy).toBe(0);
    expect(world.snapshot().graph.at(-1)?.values).toEqual([0, 0]);
    world.step(1);
    const accumulated = world.snapshot().energy;
    world.setControl(0.8);
    expect(world.snapshot().energy).toBeCloseTo(accumulated);
    world.step(1);
    expect(world.snapshot().energy).toBeGreaterThan(accumulated);
  });

  it("connects sandbox distance, insulation, thermometers, and graph to spatial placement", () => {
    const world = new ThermalWorld("sandbox");
    const container = world.snapshot().objects.find((item) => item.type === "container")!;
    const heater = world.addObject("heater", container.x + 0.05, container.y);
    const thermometer = world.snapshot().objects.find((item) => item.type === "thermometer")!;
    world.moveObject(thermometer.id, container.x, container.y);
    const nearby = world.snapshot();
    world.moveObject(heater.id, 0.98, 0.05);
    const far = world.snapshot();
    expect(nearby.temperature).toBeGreaterThan(far.temperature);
    expect(nearby.thermometerReadings[0].temperature).toBeGreaterThan(far.thermometerReadings[0].temperature);
    expect(nearby.graph).not.toEqual(far.graph);

    world.moveObject(heater.id, container.x + 0.12, container.y);
    const exposed = world.snapshot().temperature;
    const insulator = world.addObject("insulator", container.x + 0.06, container.y);
    expect(world.snapshot().temperature).toBeLessThan(exposed);
    world.removeObject(insulator.id);
    world.addObject("conductor", container.x + 0.06, container.y);
    expect(world.snapshot().temperature).toBeGreaterThan(exposed);
  });
});
