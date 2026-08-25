import { describe, expect, it } from "vitest";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import { ElectromagnetismModel, normalizedToWorld } from "./models";
import { canvasToModel, modelToCanvas } from "./renderer";

describe("ElectromagnetismModel", () => {
  it("changes Coulomb force when the learner moves or flips the test charge", () => {
    const model = new ElectromagnetismModel("charge");
    const initial = model.snapshot();
    model.drag({ x: 0.48, y: 0.5 });
    const closer = model.snapshot();
    expect(closer.measurement.value).toBeGreaterThan(initial.measurement.value);
    model.toggleSign();
    expect(model.snapshot().sign).toBe(-1);
  });

  it("uses probe position to change electric field and potential", () => {
    const field = new ElectromagnetismModel("electric-field");
    const initialField = field.snapshot().measurement.value;
    field.drag({ x: 0.48, y: 0.42 });
    expect(field.snapshot().measurement.value).not.toBeCloseTo(initialField);

    const potential = new ElectromagnetismModel("potential");
    const initialPotential = potential.snapshot().measurement.value;
    potential.drag({ x: 0.5, y: 0.5 });
    expect(potential.snapshot().measurement.value).toBeGreaterThan(initialPotential);
  });

  it("couples circuit resistance and capacitor separation to their measurements", () => {
    const circuit = new ElectromagnetismModel("circuits");
    circuit.drag({ x: 0.2, y: 0.5 });
    const lowResistanceCurrent = circuit.snapshot().measurement.value;
    circuit.drag({ x: 0.9, y: 0.5 });
    expect(circuit.snapshot().measurement.value).toBeLessThan(lowResistanceCurrent);

    const capacitor = new ElectromagnetismModel("capacitors");
    capacitor.drag({ x: 0.15, y: 0.5 });
    const closePlates = capacitor.snapshot().measurement.value;
    capacitor.drag({ x: 0.9, y: 0.5 });
    expect(capacitor.snapshot().measurement.value).toBeLessThan(closePlates);
  });

  it("changes magnetic results through direction, velocity, and magnet motion", () => {
    const magnetic = new ElectromagnetismModel("magnetic-field");
    const originalDirection = magnetic.snapshot().direction;
    magnetic.toggleDirection();
    expect(magnetic.snapshot().direction).toBe(-originalDirection);

    const force = new ElectromagnetismModel("electromagnetic-force");
    force.drag({ x: 0.55, y: 0.2 });
    force.setRunning(true);
    for (let frame = 0; frame < 60; frame += 1) force.step(1 / 120);
    expect(force.snapshot().trail.length).toBeGreaterThan(20);
    expect(force.snapshot().particle.y).not.toBeCloseTo(0.52);

    const induction = new ElectromagnetismModel("induction");
    induction.drag({ x: 0.72, y: 0.5 }, 0.1);
    expect(Math.abs(induction.snapshot().measurement.value)).toBeGreaterThan(0);
  });

  it("resets every guided experiment deterministically", () => {
    for (const id of [...ELECTROMAGNETISM_LAB_IDS, "sandbox"] as const) {
      const model = new ElectromagnetismModel(id);
      const initial = model.snapshot();
      model.drag({ x: 0.7, y: 0.25 }, 0.1);
      model.setRunning(true);
      model.step(0.5);
      model.reset();
      expect(model.snapshot()).toEqual(initial);
    }
  });

  it("provides a finite current graph marker for every guided experiment", () => {
    for (const id of ELECTROMAGNETISM_LAB_IDS) {
      const marker = new ElectromagnetismModel(id).snapshot().graphMarker;
      expect(marker).not.toBeNull();
      expect(Number.isFinite(marker?.x)).toBe(true);
      expect(Number.isFinite(marker?.y)).toBe(true);
    }
  });

  it("connects only the level controls exposed by each lab to physical results", () => {
    const charge = new ElectromagnetismModel("charge");
    const weakForce = charge.snapshot().measurement.value;
    charge.setLevel(1.5);
    expect(charge.snapshot().measurement.value).toBeGreaterThan(weakForce);

    const field = new ElectromagnetismModel("electric-field");
    const normalField = field.snapshot().measurement.value;
    field.setLevel(1.5);
    expect(field.snapshot().measurement.value).toBeGreaterThan(normalField);

    const potential = new ElectromagnetismModel("potential");
    const normalEnergy = potential.snapshot().secondaryMeasurement!.value;
    potential.setLevel(1.5);
    expect(potential.snapshot().secondaryMeasurement!.value).toBeGreaterThan(normalEnergy);
  });

  it("round-trips screen and model coordinates and keeps dragged handles under the pointer", () => {
    const point = { x: 0.63, y: 0.31 };
    expect(canvasToModel(modelToCanvas(point, 1000, 420), 1000, 420)).toEqual(point);

    const circuit = new ElectromagnetismModel("circuits");
    circuit.drag({ x: 0.61, y: 0.3 });
    expect(circuit.snapshot().probe).toEqual({ x: 0.61, y: 0.3 });

    const capacitor = new ElectromagnetismModel("capacitors");
    capacitor.drag({ x: 0.69, y: 0.78 });
    expect(capacitor.snapshot().probe).toEqual({ x: 0.69, y: 0.78 });
  });

  it("uses the same dipole field for the scene, graph, and current probe marker", () => {
    const model = new ElectromagnetismModel("electric-field");
    model.drag({ x: 0.62, y: 0.3 });
    const upper = model.snapshot();
    expect(upper.graphMarker?.y).toBeCloseTo(upper.measurement.value);
    expect(upper.graphMarker?.x).toBeCloseTo(0.62 * 2.4);
    model.drag({ x: 0.62, y: 0.78 });
    expect(model.snapshot().graph).not.toEqual(upper.graph);
  });

  it("keeps magnetic-force magnitude independent of in-plane velocity direction", () => {
    const model = new ElectromagnetismModel("electromagnetic-force");
    model.drag({ x: 0.7, y: 0.52 });
    const horizontal = model.snapshot();
    model.drag({ x: 0.25, y: 0.82 });
    const vertical = model.snapshot();
    expect(vertical.measurement.value).toBeCloseTo(horizontal.measurement.value);
    expect(new Set(vertical.graph.map((point) => point.y.toFixed(8))).size).toBe(1);
    expect(vertical.graphMarker?.y).toBeCloseTo(vertical.measurement.value);
  });

  it("aims the launched charge through the same isotropic world transform as the pointer", () => {
    const model = new ElectromagnetismModel("electromagnetic-force");
    const target = { x: 0.58, y: 0.24 };
    const origin = normalizedToWorld(model.snapshot().particle);
    const targetWorld = normalizedToWorld(target);
    model.drag(target);
    const velocity = model.snapshot().particleVelocity;
    expect(velocity.x * (targetWorld.y - origin.y) - velocity.y * (targetWorld.x - origin.x)).toBeCloseTo(0);
  });

  it("uses real drag duration and magnet-coil position for induction", () => {
    const slow = new ElectromagnetismModel("induction");
    slow.drag({ x: 0.2, y: 0.5 }, 0);
    slow.drag({ x: 0.3, y: 0.5 }, 0.1);
    const slowVoltage = Math.abs(slow.snapshot().measurement.value);

    const fast = new ElectromagnetismModel("induction");
    fast.drag({ x: 0.2, y: 0.5 }, 0);
    fast.drag({ x: 0.3, y: 0.5 }, 0.05);
    expect(Math.abs(fast.snapshot().measurement.value)).toBeCloseTo(slowVoltage * 2);

    const near = new ElectromagnetismModel("induction");
    near.drag({ x: 0.45, y: 0.5 }, 0);
    near.drag({ x: 0.55, y: 0.5 }, 0.1);
    expect(Math.abs(near.snapshot().measurement.value)).toBeGreaterThan(slowVoltage);
    expect(near.snapshot().graphMarker?.y).toBeCloseTo(near.snapshot().measurement.value);
  });

  it("connects sandbox charges and probes to field and potential calculations", () => {
    const model = new ElectromagnetismModel("sandbox");
    const initial = model.snapshot();
    expect(initial.measurement.label).toBe("탐침 전기장");
    expect(initial.measurement.value).toBeGreaterThan(0);
    expect(initial.secondaryMeasurement?.label).toBe("탐침 전위");
    const probe = initial.sandboxObjects.find((object) => object.kind === "probe")!;
    model.moveSandboxObject(probe.id, { x: 0.9, y: 0.85 });
    expect(model.snapshot().measurement.value).toBeLessThan(initial.measurement.value);
    expect(model.snapshot().graphMarker?.y).toBeCloseTo(model.snapshot().measurement.value);
  });

  it("connects nearby sandbox batteries and resistors into an Ohm-law circuit", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery");
    const resistor = model.addSandboxObject("resistor");
    model.moveSandboxObject(battery.id, { x: 0.45, y: 0.4 });
    model.moveSandboxObject(resistor.id, { x: 0.6, y: 0.4 });
    expect(model.snapshot().sandboxMetrics.current).toBeCloseTo(0.9);
    expect(model.snapshot().sandboxConnections.some((connection) => connection.kind === "circuit")).toBe(true);
    expect(model.snapshot().graphMarker).toEqual({ x: 10, y: 0.9 });
    model.moveSandboxObject(resistor.id, { x: 0.95, y: 0.9 });
    expect(model.snapshot().sandboxMetrics.current).toBe(0);
  });

  it("uses sandbox magnet and coil distance changes for induction", () => {
    const model = new ElectromagnetismModel("sandbox");
    const magnet = model.addSandboxObject("magnet");
    const coil = model.addSandboxObject("coil");
    model.moveSandboxObject(coil.id, { x: 0.65, y: 0.5 });
    model.moveSandboxObject(magnet.id, { x: 0.25, y: 0.5 }, 0);
    model.moveSandboxObject(magnet.id, { x: 0.5, y: 0.5 }, 0.1);
    const snapshot = model.snapshot();
    expect(Math.abs(snapshot.sandboxMetrics.inducedVoltage)).toBeGreaterThan(0);
    expect(snapshot.sandboxConnections.some((connection) => connection.kind === "induction")).toBe(true);
    expect(snapshot.sandboxGraph.title).toContain("자석-코일");
  });

  it("adds, moves, selects, and removes sandbox apparatus", () => {
    const model = new ElectromagnetismModel("sandbox");
    const magnet = model.addSandboxObject("magnet");
    expect(model.moveSandboxObject(magnet.id, { x: 0.8, y: 0.7 })).toBe(true);
    expect(model.hitSandboxObject({ x: 0.8, y: 0.7 })?.id).toBe(magnet.id);
    expect(model.removeSandboxObject(magnet.id)).toBe(true);
    expect(model.snapshot().sandboxObjects.some((object) => object.id === magnet.id)).toBe(false);
  });
});
