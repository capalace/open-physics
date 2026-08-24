import type { Force, ForceLaw, ForceLawContext } from "../quantities";
import type { BodyState } from "../core";

const TWO_PI = 2 * Math.PI;

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** Angular frequency of a mass-spring oscillator: ω = √(k/m). */
export const angularFrequency = (stiffness: number, mass: number): number => {
  requirePositive(stiffness, "Stiffness");
  requirePositive(mass, "Mass");
  return Math.sqrt(stiffness / mass);
};

/** Period of simple harmonic motion: T = 2π/ω. */
export const periodFromAngularFrequency = (omega: number): number => {
  requirePositive(omega, "Angular frequency");
  return TWO_PI / omega;
};

/** Frequency: f = 1/T = ω/(2π). */
export const frequencyFromAngularFrequency = (omega: number): number => {
  requirePositive(omega, "Angular frequency");
  return omega / TWO_PI;
};

/** Displacement: x(t) = A cos(ωt + φ). */
export const harmonicDisplacement = (
  amplitude: number,
  omega: number,
  time: number,
  phase = 0,
): number => amplitude * Math.cos(omega * time + phase);

/** Velocity: v(t) = -Aω sin(ωt + φ). */
export const harmonicVelocity = (
  amplitude: number,
  omega: number,
  time: number,
  phase = 0,
): number => -amplitude * omega * Math.sin(omega * time + phase);

/** Acceleration: a(t) = -ω²x(t). */
export const harmonicAcceleration = (displacement: number, omega: number): number =>
  -omega ** 2 * displacement;

export const maximumSpeed = (amplitude: number, omega: number): number =>
  Math.abs(amplitude) * omega;

export const maximumAcceleration = (amplitude: number, omega: number): number =>
  Math.abs(amplitude) * omega ** 2;

/** Total oscillator energy: E = ½kA². */
export const harmonicEnergy = (stiffness: number, amplitude: number): number =>
  0.5 * stiffness * amplitude ** 2;

/** Small-angle simple pendulum period: T = 2π√(L/g). */
export const pendulumPeriod = (length: number, gravityMagnitude: number): number => {
  requirePositive(length, "Length");
  requirePositive(gravityMagnitude, "Gravity magnitude");
  return TWO_PI * Math.sqrt(length / gravityMagnitude);
};

/** Small-angle simple pendulum angular frequency: ω = √(g/L). */
export const pendulumAngularFrequency = (
  length: number,
  gravityMagnitude: number,
): number => {
  requirePositive(length, "Length");
  requirePositive(gravityMagnitude, "Gravity magnitude");
  return Math.sqrt(gravityMagnitude / length);
};

/**
 * Hooking force for a one-dimensional mass-spring oscillator.
 * The displacement is measured from equilibrium: F = -kx.
 */
export class SpringOscillatorForce implements ForceLaw {
  readonly id = "oscillation.spring";

  constructor(public readonly stiffness: number) {
    requirePositive(stiffness, "Stiffness");
  }

  force(state: BodyState, _context: ForceLawContext): Force {
    return {
      vector: {
        x: -this.stiffness * state.position.x,
        y: -this.stiffness * state.position.y,
      },
      source: this.id,
    };
  }
}
