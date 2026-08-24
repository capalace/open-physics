/** Foundational modern-physics models. */

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** Mass-energy equivalence: E = mc². */
export const massEnergy = (mass: number, lightSpeed: number): number => {
  requirePositive(mass, "Mass");
  requirePositive(lightSpeed, "Light speed");
  return mass * lightSpeed ** 2;
};

/** Relativistic momentum: p = γmv. */
export const relativisticMomentum = (mass: number, velocity: number, lightSpeed: number): number => {
  requirePositive(mass, "Mass");
  requirePositive(lightSpeed, "Light speed");
  if (Math.abs(velocity) >= lightSpeed) throw new RangeError("Velocity must be below light speed.");
  const gamma = 1 / Math.sqrt(1 - (velocity / lightSpeed) ** 2);
  return gamma * mass * velocity;
};

/** Lorentz factor: γ = 1/√(1-v²/c²). */
export const lorentzFactor = (velocity: number, lightSpeed: number): number => {
  requirePositive(lightSpeed, "Light speed");
  if (Math.abs(velocity) >= lightSpeed) throw new RangeError("Velocity must be below light speed.");
  return 1 / Math.sqrt(1 - (velocity / lightSpeed) ** 2);
};

/** Relativistic kinetic energy: K = (γ - 1)mc². */
export const relativisticKineticEnergy = (mass: number, velocity: number, lightSpeed: number): number =>
  (lorentzFactor(velocity, lightSpeed) - 1) * mass * lightSpeed ** 2;

/** de Broglie wavelength: λ = h/p. */
export const deBroglieWavelength = (planckConstant: number, momentum: number): number => {
  requirePositive(planckConstant, "Planck constant");
  requirePositive(momentum, "Momentum");
  return planckConstant / momentum;
};

/** Photon energy: E = hf. */
export const photonEnergy = (planckConstant: number, frequency: number): number => {
  requirePositive(planckConstant, "Planck constant");
  requirePositive(frequency, "Frequency");
  return planckConstant * frequency;
};

/** Photoelectric equation: Kmax = hf - φ. */
export const photoelectronMaximumKineticEnergy = (
  planckConstant: number,
  frequency: number,
  workFunction: number,
): number => planckConstant * frequency - workFunction;

/** Threshold frequency: f₀ = φ/h. */
export const photoelectricThresholdFrequency = (
  workFunction: number,
  planckConstant: number,
): number => {
  requirePositive(workFunction, "Work function");
  requirePositive(planckConstant, "Planck constant");
  return workFunction / planckConstant;
};

/** Bohr energy level for hydrogen: E_n = -13.6 eV/n² (with supplied energy unit). */
export const hydrogenBohrEnergyLevel = (n: number, groundStateEnergy: number): number => {
  requirePositive(n, "Principal quantum number");
  return groundStateEnergy / n ** 2;
};

/** Hydrogen spectral transition: ΔE = |E_final - E_initial|. */
export const energyTransition = (initialEnergy: number, finalEnergy: number): number =>
  Math.abs(finalEnergy - initialEnergy);

/** Radioactive decay: N(t) = N₀ 2^(-t/T½). */
export const remainingParticles = (
  initialParticles: number,
  time: number,
  halfLife: number,
): number => {
  requirePositive(initialParticles, "Initial particles");
  requirePositive(halfLife, "Half-life");
  return initialParticles * 2 ** (-time / halfLife);
};

/** Activity: A = λN. */
export const radioactiveActivity = (decayConstant: number, particleCount: number): number =>
  decayConstant * particleCount;

/** Decay constant: λ = ln(2)/T½. */
export const decayConstantFromHalfLife = (halfLife: number): number => {
  requirePositive(halfLife, "Half-life");
  return Math.LN2 / halfLife;
};

/** Nuclear binding-energy equivalent: E = Δmc². */
export const massDefectEnergy = (massDefect: number, lightSpeed: number): number =>
  massDefect * lightSpeed ** 2;
