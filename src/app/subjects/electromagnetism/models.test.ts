import { describe, expect, it } from "vitest";
import { ElectromagnetismModel } from "./models";

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
    const model = new ElectromagnetismModel("electromagnetic-force");
    const initial = model.snapshot();
    model.drag({ x: 0.7, y: 0.25 });
    model.setRunning(true);
    model.step(0.5);
    model.reset();
    expect(model.snapshot()).toEqual(initial);
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
