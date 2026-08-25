/** Foundational thermal physics models. */

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** Heat transfer: Q = mcΔT. */
export const sensibleHeat = (mass: number, specificHeat: number, deltaTemperature: number): number =>
  mass * specificHeat * deltaTemperature;

/** Phase-change heat: Q = mL. */
export const latentHeat = (mass: number, specificLatentHeat: number): number =>
  mass * specificLatentHeat;

/** Linear thermal expansion: ΔL = αL₀ΔT. */
export const linearExpansion = (
  initialLength: number,
  expansionCoefficient: number,
  deltaTemperature: number,
): number => initialLength * expansionCoefficient * deltaTemperature;

/** Ideal gas law: PV = nRT. */
export const idealGasPressure = (
  amount: number,
  temperature: number,
  volume: number,
  gasConstant: number,
): number => {
  requirePositive(amount, "Amount");
  requirePositive(temperature, "Temperature");
  requirePositive(volume, "Volume");
  return amount * gasConstant * temperature / volume;
};

export const idealGasVolume = (
  amount: number,
  temperature: number,
  pressure: number,
  gasConstant: number,
): number => {
  requirePositive(amount, "Amount");
  requirePositive(temperature, "Temperature");
  requirePositive(pressure, "Pressure");
  return amount * gasConstant * temperature / pressure;
};

/** Microscopic ideal-gas relation: PV = NkT. */
export const idealGasPressureFromParticles = (
  particleCount: number,
  temperature: number,
  volume: number,
  boltzmannConstant: number,
): number => {
  requirePositive(particleCount, "Particle count");
  requirePositive(temperature, "Temperature");
  requirePositive(volume, "Volume");
  return particleCount * boltzmannConstant * temperature / volume;
};

/** Internal energy change: ΔU = Q - W, where W is work done by the system. */
export const internalEnergyChange = (heatAdded: number, workDoneBySystem: number): number =>
  heatAdded - workDoneBySystem;

/** Efficiency η = useful output / input. */
export const thermalEfficiency = (usefulEnergy: number, inputEnergy: number): number => {
  requirePositive(inputEnergy, "Input energy");
  return usefulEnergy / inputEnergy;
};

/** Heat transfer by conduction: Q/t = kAΔT/L. */
export const conductionHeatRate = (
  conductivity: number,
  area: number,
  deltaTemperature: number,
  thickness: number,
): number => {
  requirePositive(thickness, "Thickness");
  return conductivity * area * deltaTemperature / thickness;
};

/** Mean translational kinetic energy: E = 3/2 kT. */
export const meanParticleKineticEnergy = (temperature: number, boltzmannConstant: number): number =>
  1.5 * boltzmannConstant * temperature;

/** RMS speed of an ideal-gas molecule: v_rms = √(3RT/M). */
export const rmsMolecularSpeed = (
  gasConstant: number,
  temperature: number,
  molarMass: number,
): number => {
  requirePositive(temperature, "Temperature");
  requirePositive(molarMass, "Molar mass");
  return Math.sqrt(3 * gasConstant * temperature / molarMass);
};

/** Carnot upper-bound efficiency: η = 1 - Tc/Th. */
export const carnotEfficiency = (hotTemperature: number, coldTemperature: number): number => {
  requirePositive(hotTemperature, "Hot temperature");
  requirePositive(coldTemperature, "Cold temperature");
  if (coldTemperature > hotTemperature) {
    throw new RangeError("Cold temperature must not exceed hot temperature.");
  }
  return 1 - coldTemperature / hotTemperature;
};

/** Entropy change for reversible heating at constant heat capacity: ΔS = C ln(T₂/T₁). */
export const entropyChangeForHeating = (
  heatCapacity: number,
  initialTemperature: number,
  finalTemperature: number,
): number => {
  requirePositive(heatCapacity, "Heat capacity");
  requirePositive(initialTemperature, "Initial temperature");
  requirePositive(finalTemperature, "Final temperature");
  return heatCapacity * Math.log(finalTemperature / initialTemperature);
};

/** Entropy created while two equal heat capacities reach their mean temperature. */
export const entropyCreatedByMixing = (
  heatCapacityEach: number,
  firstTemperature: number,
  secondTemperature: number,
): number => {
  requirePositive(heatCapacityEach, "Heat capacity");
  requirePositive(firstTemperature, "First temperature");
  requirePositive(secondTemperature, "Second temperature");
  const equilibrium = (firstTemperature + secondTemperature) / 2;
  return entropyChangeForHeating(heatCapacityEach, firstTemperature, equilibrium)
    + entropyChangeForHeating(heatCapacityEach, secondTemperature, equilibrium);
};
