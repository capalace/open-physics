import { describe, expect, it } from "vitest";
import { ELECTROMAGNETISM_LAB_IDS } from "./catalog";
import { ElectromagnetismModel, isElectromagnetismWireConnectable, normalizedToWorld, sandboxBulbBrightness } from "./models";
import { canvasToModel, modelToCanvas } from "./renderer";

describe("ElectromagnetismModel", () => {
  it("distinguishes wire-connectable circuit parts from field apparatus", () => {
    expect(["battery", "resistor", "bulb", "switch", "capacitor", "coil", "motor", "generator", "transformer"].every((kind) => isElectromagnetismWireConnectable(kind as "battery"))).toBe(true);
    expect(["charge", "current-wire", "field-region", "magnet", "iron-load", "probe"].every((kind) => !isElectromagnetismWireConnectable(kind as "charge"))).toBe(true);
  });
  it("changes Coulomb force when the learner moves or flips the test charge", () => {
    const model = new ElectromagnetismModel("charge");
    const initial = model.snapshot();
    expect(initial.fieldSamples.length).toBeGreaterThan(50);
    expect(initial.fieldLines.length).toBeGreaterThan(0);
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

  it("couples circuit resistance to current and conserves isolated capacitor charge", () => {
    const circuit = new ElectromagnetismModel("circuits");
    circuit.drag({ x: 0.2, y: 0.5 });
    const lowResistanceCurrent = circuit.snapshot().measurement.value;
    circuit.drag({ x: 0.9, y: 0.5 });
    expect(circuit.snapshot().measurement.value).toBeLessThan(lowResistanceCurrent);
    const seriesCurrent = circuit.snapshot().measurement.value;
    circuit.setCircuitArrangement("parallel");
    expect(circuit.snapshot().measurement.value).toBeGreaterThan(seriesCurrent * 3);

    const capacitor = new ElectromagnetismModel("capacitors");
    capacitor.drag({ x: 0.15, y: 0.5 });
    for (let frame = 0; frame < 180; frame += 1) capacitor.step(1 / 60);
    capacitor.setCapacitorMode("open");
    const closePlates = capacitor.snapshot();
    capacitor.drag({ x: 0.9, y: 0.5 });
    const farPlates = capacitor.snapshot();
    expect(farPlates.capacitorVoltage).toBeGreaterThan(closePlates.capacitorVoltage);
    expect(farPlates.secondaryMeasurement!.value).toBeCloseTo(closePlates.secondaryMeasurement!.value);
  });

  it("charges a capacitor through a wired sandbox circuit and reduces the charging current", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery", 9);
    const resistor = model.addSandboxObject("resistor", 10);
    const capacitor = model.addSandboxObject("capacitor", 5);
    model.setSandboxObjectSecondaryValue(capacitor.id, 0);
    model.connectSandboxObjects(battery.id, resistor.id, "b", "a");
    model.connectSandboxObjects(resistor.id, capacitor.id, "b", "a");
    model.connectSandboxObjects(capacitor.id, battery.id, "b", "a");

    const initial = model.snapshot();
    const initialCurrent = Math.abs(initial.sandboxCurrents.find((entry) => entry.objectId === capacitor.id)?.current ?? 0);
    for (let frame = 0; frame < 180; frame += 1) model.step(1 / 60);
    const charged = model.snapshot();
    const chargedCapacitor = charged.sandboxObjects.find((object) => object.id === capacitor.id)!;
    const laterCurrent = Math.abs(charged.sandboxCurrents.find((entry) => entry.objectId === capacitor.id)?.current ?? 0);

    expect(initialCurrent).toBeGreaterThan(0.1);
    expect(chargedCapacitor.secondaryValue).toBeGreaterThan(4);
    expect(laterCurrent).toBeLessThan(initialCurrent);
  });

  it("selects the visible edge of large sandbox apparatus", () => {
    const model = new ElectromagnetismModel("sandbox");
    const transformer = model.addSandboxObject("transformer");
    expect(model.hitSandboxObject({ x: transformer.position.x + 0.075, y: transformer.position.y })?.id).toBe(transformer.id);
  });

  it("changes magnetic results through direction, velocity, and magnet motion", () => {
    const magnetic = new ElectromagnetismModel("magnetic-field");
    const originalDirection = magnetic.snapshot().direction;
    magnetic.toggleDirection();
    expect(magnetic.snapshot().direction).toBe(-originalDirection);

    const force = new ElectromagnetismModel("electromagnetic-force");
    const originalForce = force.snapshot().lorentzForce.y;
    force.toggleSign();
    expect(force.snapshot().lorentzForce.y).toBeCloseTo(-originalForce);
    force.toggleDirection();
    expect(force.snapshot().lorentzForce.y).toBeCloseTo(originalForce);

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

  it("uses Fleming's left-hand rule for current, field, and force direction", () => {
    const model = new ElectromagnetismModel("electromagnetic-force");
    const original = model.snapshot();
    expect(original.lorentzForce.y).toBeLessThan(0);
    expect(original.measurement.label).toBe("도선에 작용하는 힘");
    expect(original.graph[0]).toEqual({ x: 0, y: 0 });
    model.drag({ x: 0.2, y: 0.5 });
    expect(model.snapshot().sign).toBe(-1);
    expect(model.snapshot().level).toBeCloseTo(1);
    model.toggleDirection();
    expect(model.snapshot().lorentzForce.y).toBeLessThan(0);
    model.setLevel(1.5);
    expect(model.snapshot().measurement.value).toBeGreaterThan(original.measurement.value);
    expect(model.snapshot().graphMarker).toEqual({ x: 4.5, y: model.snapshot().measurement.value });
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

  it("launches a charged particle into opposite curved paths when charge or field direction flips", () => {
    const launch = (flipCharge: boolean, flipField: boolean) => {
      const model = new ElectromagnetismModel("charged-particle");
      model.drag({ x: 0.4, y: 0.55 });
      if (flipCharge) model.toggleSign();
      if (flipField) model.toggleDirection();
      model.setRunning(true);
      for (let frame = 0; frame < 50; frame += 1) model.step(1 / 60);
      return model.snapshot();
    };

    const normal = launch(false, false);
    const oppositeCharge = launch(true, false);
    const oppositeField = launch(false, true);
    expect(normal.particle.y).toBeLessThan(0.55);
    expect(oppositeCharge.particle.y).toBeGreaterThan(0.55);
    expect(oppositeField.particle.y).toBeGreaterThan(0.55);
    expect(normal.trail.length).toBeGreaterThan(30);
    expect(normal.particleTargetsHit.some(Boolean)).toBe(true);
    expect(normal.graphMarker?.y).toBeCloseTo(normal.measurement.value);
  });

  it("lifts more clips when an electromagnet gets more current or coil turns", () => {
    const model = new ElectromagnetismModel("electromagnet");
    model.setLevel(0.5); model.setCoilTurns(40);
    const weak = model.snapshot();
    model.drag({ x: 0.7, y: 0.22 }); model.setCoilTurns(140);
    const strong = model.snapshot();
    expect(strong.measurement.value).toBeGreaterThan(weak.measurement.value * 3);
    expect(strong.secondaryMeasurement!.value).toBe(weak.secondaryMeasurement!.value);
    expect(strong.graphMarker?.y).toBeCloseTo(strong.measurement.value);
  });

  it("runs the motor automatically and reverses its loaded shaft with current or magnetic direction", () => {
    const model = new ElectromagnetismModel("motor");
    expect(model.snapshot().running).toBe(true);
    model.step(0.25);
    const lifting = model.snapshot();
    expect(lifting.rotorAngle).toBeGreaterThan(0);
    expect(lifting.motorLoadHeight).toBeLessThan(0.78);
    model.toggleSign(); model.step(0.25);
    expect(model.snapshot().angularSpeed).toBeLessThan(0);
    expect(model.snapshot().motorLoadHeight).toBe(0.78);
    model.toggleDirection(); model.step(0.25);
    expect(model.snapshot().angularSpeed).toBeGreaterThan(0);
  });

  it("lets the electromagnet lift only loads below its available force", () => {
    const model = new ElectromagnetismModel("electromagnet");
    model.setDeviceLoad(3); model.setLevel(0.5); model.setCoilTurns(40);
    model.drag({ x: 0.5, y: 0.7 });
    expect(model.snapshot().craneCarrying).toBe(0);
    model.setLevel(1.5); model.setCoilTurns(140);
    model.drag({ x: 0.5, y: 0.7 });
    expect(model.snapshot().craneCarrying).toBe(1);
    model.drag({ x: 0.82, y: 0.7 });
    expect(model.snapshot().craneCarrying).toBe(0);
    expect(model.snapshot().craneDelivered).toBe(1);
  });

  it("lifts only loads whose required torque is below the motor torque", () => {
    const model = new ElectromagnetismModel("motor");
    model.setLevel(1.5);
    model.setDeviceLoad(1);
    for (let frame = 0; frame < 120; frame += 1) model.step(1 / 60);
    const lightHeight = model.snapshot().motorLoadHeight;
    expect(lightHeight).toBeLessThan(0.78);

    model.reset(); model.setLevel(0.5); model.setDeviceLoad(3);
    for (let frame = 0; frame < 120; frame += 1) model.step(1 / 60);
    expect(model.snapshot().motorLoadHeight).toBe(0.78);
  });

  it("charges, isolates, and discharges a capacitor through a visible load", () => {
    const model = new ElectromagnetismModel("capacitors");
    for (let frame = 0; frame < 180; frame += 1) model.step(1 / 60);
    const charged = model.snapshot().capacitorVoltage;
    expect(charged).toBeGreaterThan(7);
    model.setCapacitorMode("open"); model.step(1);
    expect(model.snapshot().capacitorVoltage).toBeCloseTo(charged);
    model.setCapacitorMode("lamp");
    for (let frame = 0; frame < 60; frame += 1) model.step(1 / 60);
    expect(model.snapshot().capacitorVoltage).toBeLessThan(charged);
    expect(model.snapshot().graph.length).toBeGreaterThan(10);
  });

  it("moves a current-carrying wire along its rails instead of only drawing a force arrow", () => {
    const model = new ElectromagnetismModel("electromagnetic-force");
    const start = model.snapshot().wirePosition;
    for (let frame = 0; frame < 120; frame += 1) model.step(1 / 60);
    expect(model.snapshot().wirePosition).toBeLessThan(start);
    model.toggleDirection();
    for (let frame = 0; frame < 240; frame += 1) model.step(1 / 60);
    expect(model.snapshot().wirePosition).toBeGreaterThan(0.4);
  });

  it("turns direct crank motion into generator voltage and brighter output with more turns", () => {
    const model = new ElectromagnetismModel("generator");
    model.drag({ x: 0.51, y: 0.5 }, 0);
    model.drag({ x: 0.36, y: 0.65 }, 0.1);
    const normal = model.snapshot();
    expect(normal.angularSpeed).toBeGreaterThan(0);
    expect(normal.measurement.value).toBeGreaterThan(0);
    model.setCoilTurns(140);
    expect(model.snapshot().measurement.value).toBeGreaterThan(normal.measurement.value);
    model.setRunning(true); model.step(0.25);
    expect(model.snapshot().angularSpeed).toBeLessThan(normal.angularSpeed);
    expect(model.snapshot().generatorOutputLevel).toBeGreaterThan(0);
    for (let frame = 0; frame < 600; frame += 1) model.step(1 / 60);
    expect(model.snapshot().measurement.value).toBe(0);
    expect(model.snapshot().generatorOutputLevel).toBe(0);
  });

  it("raises and lowers transformer output voltage from the secondary coil handle", () => {
    const model = new ElectromagnetismModel("transformer");
    model.drag({ x: 0.3, y: 0.78 });
    const stepDown = model.snapshot();
    model.drag({ x: 0.7, y: 0.78 });
    const stepUp = model.snapshot();
    expect(stepDown.secondaryTurns).toBe(20);
    expect(stepUp.secondaryTurns).toBe(160);
    expect(stepUp.measurement.value).toBeGreaterThan(stepDown.measurement.value * 4);
    expect(stepUp.graphMarker).toEqual({ x: 2, y: stepUp.measurement.value });
    model.setApplianceTargetVoltage(6);
    expect(model.snapshot().applianceTargetVoltage).toBe(6);
  });

  it("connects sandbox charges and probes to field and potential calculations", () => {
    const model = new ElectromagnetismModel("sandbox");
    model.addSandboxObject("charge", 2e-6);
    model.addSandboxObject("probe");
    const initial = model.snapshot();
    expect(initial.fieldSamples).toHaveLength(216);
    expect(initial.measurement.label).toBe("탐침 전기장");
    expect(initial.measurement.value).toBeGreaterThan(0);
    expect(initial.secondaryMeasurement?.label).toBe("탐침 전위");
    const probe = initial.sandboxObjects.find((object) => object.kind === "probe")!;
    model.moveSandboxObject(probe.id, { x: 0.9, y: 0.85 });
    expect(model.snapshot().measurement.value).toBeLessThan(initial.measurement.value);
    expect(model.snapshot().graphMarker?.y).toBeCloseTo(model.snapshot().measurement.value);
  });

  it("builds dense electric-field arrows and finite field lines from positive to negative charge", () => {
    const model = new ElectromagnetismModel("electric-field");
    const snapshot = model.snapshot();

    expect(snapshot.fieldSamples).toHaveLength(216);
    expect(snapshot.fieldLines.length).toBeGreaterThanOrEqual(12);
    expect(snapshot.fieldLines.every((line) => line.points.length > 6)).toBe(true);
    expect(snapshot.fieldLines.flatMap((line) => line.points).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    const positive = snapshot.sign === 1 ? { x: 0.35, y: 0.42 } : { x: 0.35, y: 0.66 };
    const negative = snapshot.sign === 1 ? { x: 0.35, y: 0.66 } : { x: 0.35, y: 0.42 };
    expect(snapshot.fieldLines.some((line) => {
      const start = line.points[0]; const end = line.points[line.points.length - 1];
      return Math.hypot(start.x - positive.x, start.y - positive.y) < 0.05
        && Math.hypot(end.x - negative.x, end.y - negative.y) < 0.08;
    })).toBe(true);
  });

  it("runs current only through a directly wired closed sandbox circuit", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery");
    const resistor = model.addSandboxObject("resistor");
    const bulb = model.addSandboxObject("bulb");
    expect(model.snapshot().sandboxMetrics.current).toBe(0);
    expect(model.connectSandboxObjects(battery.id, resistor.id)).toBe(true);
    expect(model.connectSandboxObjects(resistor.id, bulb.id)).toBe(true);
    expect(model.snapshot().sandboxMetrics.current).toBe(0);
    expect(model.connectSandboxObjects(bulb.id, battery.id)).toBe(true);
    expect(model.snapshot().sandboxMetrics.current).toBeCloseTo(9 / 16.2);
    expect(model.snapshot().sandboxConnections.every((connection) => connection.kind === "wire")).toBe(true);
    expect(model.snapshot().graphMarker?.x).toBeCloseTo(16);
    expect(model.snapshot().graphMarker?.y).toBeCloseTo(9 / 16.2);
    model.moveSandboxObject(resistor.id, { x: 0.95, y: 0.9 });
    expect(model.snapshot().sandboxMetrics.current).toBeCloseTo(9 / 16.2);
  });

  it("solves battery series and parallel wiring from the selected component terminals", () => {
    const single = new ElectromagnetismModel("sandbox");
    const singleBattery = single.addSandboxObject("battery"); const singleBulb = single.addSandboxObject("bulb");
    single.connectSandboxObjects(singleBattery.id, singleBulb.id, "b", "a");
    single.connectSandboxObjects(singleBulb.id, singleBattery.id, "b", "a");
    const singleState = single.snapshot();
    expect(singleState.sandboxMetrics.batteryArrangement).toBe("single");

    const series = new ElectromagnetismModel("sandbox");
    const seriesBatteryA = series.addSandboxObject("battery"); const seriesBatteryB = series.addSandboxObject("battery"); const seriesBulb = series.addSandboxObject("bulb");
    series.connectSandboxObjects(seriesBatteryA.id, seriesBatteryB.id, "b", "a");
    series.connectSandboxObjects(seriesBatteryB.id, seriesBulb.id, "b", "a");
    series.connectSandboxObjects(seriesBulb.id, seriesBatteryA.id, "b", "a");
    const seriesState = series.snapshot();
    expect(seriesState.sandboxMetrics.batteryArrangement).toBe("series");
    expect(seriesState.sandboxMetrics.circuitVoltage).toBeGreaterThan(singleState.sandboxMetrics.circuitVoltage * 1.9);
    expect(seriesState.sandboxMetrics.loadPower).toBeGreaterThan(singleState.sandboxMetrics.loadPower * 3.5);

    const parallel = new ElectromagnetismModel("sandbox");
    const parallelBatteryA = parallel.addSandboxObject("battery"); const parallelBatteryB = parallel.addSandboxObject("battery"); const parallelBulb = parallel.addSandboxObject("bulb");
    parallel.connectSandboxObjects(parallelBatteryA.id, parallelBulb.id, "b", "a");
    parallel.connectSandboxObjects(parallelBatteryA.id, parallelBulb.id, "a", "b");
    parallel.connectSandboxObjects(parallelBatteryB.id, parallelBulb.id, "b", "a");
    parallel.connectSandboxObjects(parallelBatteryB.id, parallelBulb.id, "a", "b");
    const parallelState = parallel.snapshot();
    expect(parallelState.sandboxMetrics.batteryArrangement).toBe("parallel");
    expect(parallelState.sandboxMetrics.circuitVoltage).toBeLessThan(seriesState.sandboxMetrics.circuitVoltage * 0.55);
    expect(parallelState.sandboxMetrics.loadPower).toBeGreaterThan(singleState.sandboxMetrics.loadPower);
  });

  it("maps bulb power continuously to visible brightness", () => {
    expect(sandboxBulbBrightness(0, 6)).toBe(0);
    expect(sandboxBulbBrightness(1, 6)).toBeGreaterThan(sandboxBulbBrightness(0.5, 6));
    expect(sandboxBulbBrightness(2, 6)).toBeGreaterThan(0.99);
  });

  it("opens and closes a directly wired circuit with its switch", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery");
    const bulb = model.addSandboxObject("bulb");
    const toggle = model.addSandboxObject("switch");
    model.connectSandboxObjects(battery.id, bulb.id);
    model.connectSandboxObjects(bulb.id, toggle.id);
    model.connectSandboxObjects(toggle.id, battery.id);
    expect(model.snapshot().sandboxMetrics.current).toBeGreaterThan(0);
    expect(model.toggleSandboxSwitch(toggle.id)).toBe(true);
    expect(model.snapshot().sandboxMetrics.current).toBe(0);
  });

  it("recalculates magnetic field lines from every sandbox magnet pole", () => {
    const model = new ElectromagnetismModel("sandbox");
    const first = model.addSandboxObject("magnet");
    const second = model.addSandboxObject("magnet");
    model.moveSandboxObject(first.id, { x: 0.32, y: 0.48 });
    model.moveSandboxObject(second.id, { x: 0.68, y: 0.48 });
    const aligned = model.snapshot().magneticFieldLines;
    expect(aligned.length).toBeGreaterThanOrEqual(20);
    expect(aligned.flatMap((line) => line.points).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(aligned.some((line) => {
      const start = line.points[0]; const end = line.points[line.points.length - 1];
      return Math.hypot(start.x - 0.63, start.y - 0.48) < 0.06
        && Math.hypot(end.x - 0.37, end.y - 0.48) < 0.08;
    })).toBe(true);
    model.moveSandboxObject(second.id, { x: 0.55, y: 0.72 });
    expect(model.snapshot().magneticFieldLines).not.toEqual(aligned);
  });

  it("creates the charge sign selected by the separate sandbox tools", () => {
    const model = new ElectromagnetismModel("sandbox");
    expect(model.addSandboxObject("charge", 2e-6).value).toBeGreaterThan(0);
    expect(model.addSandboxObject("charge", -2e-6).value).toBeLessThan(0);
  });

  it("starts the sandbox as a genuinely empty laboratory", () => {
    const snapshot = new ElectromagnetismModel("sandbox").snapshot();
    expect(snapshot.sandboxObjects).toEqual([]);
    expect(snapshot.sandboxConnections).toEqual([]);
    expect(snapshot.fieldLines).toEqual([]);
    expect(snapshot.magneticFieldLines).toEqual([]);
  });

  it("edits each selected sandbox apparatus without rebuilding the world", () => {
    const model = new ElectromagnetismModel("sandbox");
    const negative = model.addSandboxObject("charge", -2e-6);
    const battery = model.addSandboxObject("battery");
    const resistor = model.addSandboxObject("resistor");
    const coil = model.addSandboxObject("coil");
    expect(model.setSandboxObjectValue(negative.id, 4e-6)).toBe(true);
    expect(model.setSandboxObjectValue(battery.id, 4.5)).toBe(true);
    expect(model.setSandboxObjectValue(resistor.id, 20)).toBe(true);
    expect(model.setSandboxObjectValue(coil.id, 140)).toBe(true);
    const byId = new Map(model.snapshot().sandboxObjects.map((object) => [object.id, object]));
    expect(byId.get(negative.id)?.value).toBe(-4e-6);
    expect(byId.get(battery.id)?.value).toBe(4.5);
    expect(byId.get(resistor.id)?.value).toBe(20);
    expect(byId.get(coil.id)?.value).toBe(140);
    expect(model.snapshot().sandboxObjects).toHaveLength(4);
    expect(model.toggleSandboxCharge(negative.id)).toBe(true);
    expect(model.snapshot().sandboxObjects.find((object) => object.id === negative.id)?.value).toBe(4e-6);
    const copy = model.duplicateSandboxObject(resistor.id);
    expect(copy).toMatchObject({ kind: "resistor", value: 20 });
    expect(model.snapshot().sandboxObjects).toHaveLength(5);
  });

  it("disconnects one sandbox apparatus without deleting the other devices", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery");
    const resistor = model.addSandboxObject("resistor");
    model.connectSandboxObjects(battery.id, resistor.id);
    expect(model.disconnectSandboxObject(resistor.id)).toBe(true);
    expect(model.snapshot().sandboxConnections).toEqual([]);
    expect(model.snapshot().sandboxObjects).toHaveLength(2);
  });

  it("flips a sandbox magnet and reverses the calculated pole field", () => {
    const model = new ElectromagnetismModel("sandbox");
    const magnet = model.addSandboxObject("magnet");
    const before = model.snapshot();
    expect(magnet.direction).toBe(1);
    expect(model.toggleSandboxMagnet(magnet.id)).toBe(true);
    const after = model.snapshot();
    expect(after.sandboxObjects[0].direction).toBe(-1);
    expect(after.magneticFieldLines).not.toEqual(before.magneticFieldLines);
    model.setSandboxObjectValue(magnet.id, 1.5);
    expect(model.snapshot().magneticFieldLines.length).toBeGreaterThan(after.magneticFieldLines.length);
  });

  it("builds editable capacitor and current-wire experiments in the sandbox", () => {
    const capacitorModel = new ElectromagnetismModel("sandbox");
    const capacitor = capacitorModel.addSandboxObject("capacitor");
    expect(capacitorModel.snapshot().measurement.label).toBe("전기용량");
    const initialCapacitance = capacitorModel.snapshot().measurement.value;
    capacitorModel.setSandboxObjectValue(capacitor.id, 10);
    capacitorModel.setSandboxObjectSecondaryValue(capacitor.id, 4.5);
    expect(capacitorModel.snapshot().measurement.value).toBeLessThan(initialCapacitance);
    expect(capacitorModel.snapshot().sandboxObjects[0].secondaryValue).toBe(4.5);
    expect(capacitorModel.snapshot().sandboxGraph.title).toContain("판 간격");

    const wireModel = new ElectromagnetismModel("sandbox");
    const wire = wireModel.addSandboxObject("current-wire");
    const probe = wireModel.addSandboxObject("probe");
    wireModel.moveSandboxObject(probe.id, { x: 0.7, y: 0.5 });
    const before = wireModel.snapshot();
    expect(before.measurement.label).toBe("탐침 자기장");
    expect(before.measurement.value).toBeGreaterThan(0);
    expect(wireModel.toggleSandboxCurrent(wire.id)).toBe(true);
    const after = wireModel.snapshot();
    expect(after.sandboxMetrics.magneticField.x).toBeCloseTo(-before.sandboxMetrics.magneticField.x);
    expect(after.sandboxMetrics.magneticField.y).toBeCloseTo(-before.sandboxMetrics.magneticField.y);
  });

  it("couples sandbox magnets and current-carrying wires through magnetic force", () => {
    const model = new ElectromagnetismModel("sandbox");
    const magnet = model.addSandboxObject("magnet");
    const wire = model.addSandboxObject("current-wire");
    model.moveSandboxObject(magnet.id, { x: 0.35, y: 0.5 });
    model.moveSandboxObject(wire.id, { x: 0.65, y: 0.62 });
    const before = model.snapshot();
    expect(before.measurement.label).toBe("도선에 작용하는 힘");
    expect(before.sandboxForces).toHaveLength(1);
    expect(Math.hypot(before.sandboxForces[0].vector.x, before.sandboxForces[0].vector.y)).toBeGreaterThan(0);
    model.toggleSandboxCurrent(wire.id);
    const after = model.snapshot();
    expect(after.sandboxForces[0].vector.x).toBeCloseTo(-before.sandboxForces[0].vector.x);
    expect(after.sandboxForces[0].vector.y).toBeCloseTo(-before.sandboxForces[0].vector.y);
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

  it("curves a launched charge in opposite directions when the perpendicular magnetic field flips", () => {
    const launch = (reversed: boolean) => {
      const model = new ElectromagnetismModel("sandbox");
      const field = model.addSandboxObject("field-region");
      const charge = model.addSandboxObject("charge", 2e-6);
      model.moveSandboxObject(field.id, { x: 0.55, y: 0.5 });
      model.moveSandboxObject(charge.id, { x: 0.3, y: 0.5 });
      model.setSandboxChargeVelocityFromHandle(charge.id, { x: 0.43, y: 0.5 });
      if (reversed) model.toggleSandboxFieldDirection(field.id);
      model.setSandboxChargeMotion(charge.id, true);
      model.setRunning(true);
      for (let frame = 0; frame < 45; frame += 1) model.step(1 / 60);
      return model.snapshot().sandboxObjects.find((object) => object.id === charge.id)!;
    };
    const outward = launch(false); const inward = launch(true);
    expect(outward.position.y).toBeLessThan(0.49);
    expect(inward.position.y).toBeGreaterThan(0.51);
    expect(outward.trail!.length).toBeGreaterThan(6);
    expect(outward.history!.length).toBeGreaterThan(6);
  });

  it("accelerates a launched charge through the electric field made by another charge", () => {
    const model = new ElectromagnetismModel("sandbox");
    const source = model.addSandboxObject("charge", 2e-6);
    const moving = model.addSandboxObject("charge", 2e-6);
    model.moveSandboxObject(source.id, { x: 0.62, y: 0.5 });
    model.moveSandboxObject(moving.id, { x: 0.3, y: 0.5 });
    model.setSandboxChargeVelocityFromHandle(moving.id, { x: 0.3, y: 0.37 });
    model.setSandboxChargeMotion(moving.id, true);
    model.setRunning(true);
    for (let frame = 0; frame < 40; frame += 1) model.step(1 / 60);
    expect(model.snapshot().sandboxObjects.find((object) => object.id === moving.id)!.position.x).toBeLessThan(0.295);
  });

  it("turns a wired coil into an electromagnet whose poles reverse with current", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery");
    const resistor = model.addSandboxObject("resistor");
    const coil = model.addSandboxObject("coil");
    model.connectSandboxObjects(battery.id, resistor.id);
    model.connectSandboxObjects(resistor.id, coil.id);
    model.connectSandboxObjects(coil.id, battery.id);
    const powered = model.snapshot();
    expect(powered.sandboxMetrics.current).toBeGreaterThan(0);
    expect(Math.abs(powered.sandboxCurrents.find((entry) => entry.objectId === coil.id)?.current ?? 0)).toBeGreaterThan(0);
    expect(powered.magneticFieldLines.length).toBeGreaterThan(8);
  });

  it("lights a closed coil-and-bulb circuit with current induced by a moving magnet", () => {
    const model = new ElectromagnetismModel("sandbox");
    const coil = model.addSandboxObject("coil");
    const bulb = model.addSandboxObject("bulb");
    const toggle = model.addSandboxObject("switch");
    const magnet = model.addSandboxObject("magnet");
    model.connectSandboxObjects(coil.id, bulb.id);
    model.connectSandboxObjects(bulb.id, toggle.id);
    model.connectSandboxObjects(toggle.id, coil.id);
    model.moveSandboxObject(coil.id, { x: 0.68, y: 0.5 });
    model.moveSandboxObject(magnet.id, { x: 0.2, y: 0.5 }, 0);
    model.moveSandboxObject(magnet.id, { x: 0.48, y: 0.5 }, 0.08);
    const induced = model.snapshot();
    expect(Math.abs(induced.sandboxMetrics.inducedVoltage)).toBeGreaterThan(0);
    expect(Math.abs(induced.sandboxMetrics.current)).toBeGreaterThan(0);
    expect(Math.abs(induced.sandboxCurrents.find((entry) => entry.objectId === bulb.id)?.current ?? 0)).toBeGreaterThan(0);
  });

  it("uses the same wired circuit model for sandbox generators and motors", () => {
    const generatorCircuit = new ElectromagnetismModel("sandbox");
    const generator = generatorCircuit.addSandboxObject("generator", 9);
    const bulb = generatorCircuit.addSandboxObject("bulb", 6);
    generatorCircuit.connectSandboxObjects(generator.id, bulb.id, "b", "a");
    generatorCircuit.connectSandboxObjects(bulb.id, generator.id, "b", "a");
    expect(generatorCircuit.snapshot().sandboxMetrics.current).toBe(0);
    generatorCircuit.toggleSandboxGenerator(generator.id);
    expect(generatorCircuit.snapshot().sandboxMetrics.current).toBeGreaterThan(0);
    expect(generatorCircuit.snapshot().sandboxMetrics.loadPower).toBeGreaterThan(0);

    const motorCircuit = new ElectromagnetismModel("sandbox");
    const battery = motorCircuit.addSandboxObject("battery", 9);
    const motor = motorCircuit.addSandboxObject("motor", 6);
    motorCircuit.connectSandboxObjects(battery.id, motor.id, "b", "a");
    motorCircuit.connectSandboxObjects(motor.id, battery.id, "b", "a");
    expect(motorCircuit.snapshot().sandboxCurrents.find((entry) => entry.objectId === motor.id)!.current).not.toBe(0);
  });

  it("pulls a sandbox iron load toward an energized coil", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery", 9);
    const coil = model.addSandboxObject("coil", 140);
    const load = model.addSandboxObject("iron-load", 1);
    model.moveSandboxObject(coil.id, { x: 0.5, y: 0.5 });
    model.moveSandboxObject(load.id, { x: 0.7, y: 0.5 });
    model.connectSandboxObjects(battery.id, coil.id, "b", "a");
    model.connectSandboxObjects(coil.id, battery.id, "b", "a");
    const before = model.snapshot().sandboxObjects.find((object) => object.id === load.id)!.position.x;
    model.setRunning(true);
    for (let frame = 0; frame < 180; frame += 1) model.step(1 / 60);
    const after = model.snapshot().sandboxObjects.find((object) => object.id === load.id)!.position.x;
    expect(after).toBeLessThan(before);
  });

  it("solves a four-terminal ideal transformer inside the sandbox circuit", () => {
    const model = new ElectromagnetismModel("sandbox");
    const battery = model.addSandboxObject("battery", 4.5);
    const transformer = model.addSandboxObject("transformer", 160);
    const bulb = model.addSandboxObject("bulb", 6);
    model.connectSandboxObjects(battery.id, transformer.id, "b", "a");
    model.connectSandboxObjects(transformer.id, battery.id, "b", "a");
    model.connectSandboxObjects(transformer.id, bulb.id, "c", "a");
    model.connectSandboxObjects(bulb.id, transformer.id, "b", "d");
    const snapshot = model.snapshot();
    const bulbCurrent = snapshot.sandboxCurrents.find((entry) => entry.objectId === bulb.id)!.current;
    expect(Math.abs(bulbCurrent)).toBeGreaterThan(1);
    expect(snapshot.sandboxMetrics.loadPower).toBeGreaterThan(6);
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
