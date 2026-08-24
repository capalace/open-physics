import type { Vector2 } from "../core";

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** Coulomb force magnitude: F = k |q1 q2| / r². */
export const coulombForceMagnitude = (
  charge1: number,
  charge2: number,
  distance: number,
  coulombConstant = 8.9875517923e9,
): number => {
  requirePositive(distance, "Distance");
  return coulombConstant * Math.abs(charge1 * charge2) / distance ** 2;
};

/** Electric field magnitude from a point charge: E = k |q| / r². */
export const pointChargeElectricField = (
  charge: number,
  distance: number,
  coulombConstant = 8.9875517923e9,
): number => {
  requirePositive(distance, "Distance");
  return coulombConstant * Math.abs(charge) / distance ** 2;
};

/** Electric force from field: F = qE. */
export const electricForce = (charge: number, field: number): number =>
  charge * field;

/** Electric potential from a point charge: V = kq/r. */
export const pointChargePotential = (
  charge: number,
  distance: number,
  coulombConstant = 8.9875517923e9,
): number => {
  requirePositive(distance, "Distance");
  return coulombConstant * charge / distance;
};

/** Electric potential energy: U = qV. */
export const electricPotentialEnergy = (charge: number, potential: number): number =>
  charge * potential;

/** Ohm's law: V = IR. */
export const voltageFromCurrent = (current: number, resistance: number): number =>
  current * resistance;

export const currentFromVoltage = (voltage: number, resistance: number): number => {
  requirePositive(resistance, "Resistance");
  return voltage / resistance;
};

export const resistanceFromVoltageCurrent = (voltage: number, current: number): number => {
  if (current === 0) throw new RangeError("Current must be non-zero.");
  return voltage / current;
};

/** Electrical power: P = VI = I²R = V²/R. */
export const electricalPower = (voltage: number, current: number): number =>
  voltage * current;

/** Series resistance: R = ΣRi. */
export const seriesResistance = (resistances: readonly number[]): number =>
  resistances.reduce((sum, resistance) => sum + resistance, 0);

/** Parallel resistance: 1/R = Σ(1/Ri). */
export const parallelResistance = (resistances: readonly number[]): number => {
  if (resistances.length === 0) throw new RangeError("At least one resistance is required.");
  for (const resistance of resistances) requirePositive(resistance, "Resistance");
  return 1 / resistances.reduce((sum, resistance) => sum + 1 / resistance, 0);
};

/** Capacitance: C = Q/V. */
export const capacitance = (charge: number, voltage: number): number => {
  if (voltage === 0) throw new RangeError("Voltage must be non-zero.");
  return charge / voltage;
};

/** Energy stored in a capacitor: U = ½CV². */
export const capacitorEnergy = (capacitanceValue: number, voltage: number): number =>
  0.5 * capacitanceValue * voltage ** 2;

/** Magnetic force on a moving charge: F = qvB sinθ. */
export const magneticForceMagnitude = (
  charge: number,
  speed: number,
  magneticField: number,
  angleRadians: number,
): number => Math.abs(charge * speed * magneticField * Math.sin(angleRadians));

/** Magnetic force on a current-carrying wire: F = BIL sinθ. */
export const currentWireMagneticForce = (
  magneticField: number,
  current: number,
  length: number,
  angleRadians: number,
): number => Math.abs(magneticField * current * length * Math.sin(angleRadians));

/** Faraday's law: ε = -N ΔΦ/Δt. */
export const inducedEmf = (
  turns: number,
  fluxChange: number,
  timeChange: number,
): number => {
  requirePositive(timeChange, "Time change");
  return -turns * fluxChange / timeChange;
};

/** Magnetic flux: Φ = BA cosθ. */
export const magneticFlux = (
  magneticField: number,
  area: number,
  angleRadians: number,
): number => magneticField * area * Math.cos(angleRadians);

/** Lorentz force vector: F = q(E + v × B), using B as a scalar z-field in 2D. */
export const lorentzForce2D = (
  charge: number,
  electricField: Vector2,
  velocity: Vector2,
  magneticFieldZ: number,
): Vector2 => ({
  x: charge * (electricField.x + velocity.y * magneticFieldZ),
  y: charge * (electricField.y - velocity.x * magneticFieldZ),
});
