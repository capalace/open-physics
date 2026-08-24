/** Fluid mechanics models used by the simplified physics world. */

/** Density: ρ = m/V. */
export const fluidDensity = (mass: number, volume: number): number => {
  if (volume <= 0) throw new RangeError("Volume must be greater than zero.");
  return mass / volume;
};

/** Pressure: p = F/A. */
export const fluidPressure = (force: number, area: number): number => {
  if (area <= 0) throw new RangeError("Area must be greater than zero.");
  return force / area;
};

/** Hydrostatic pressure difference: Δp = ρgh. */
export const hydrostaticPressure = (
  density: number,
  gravityMagnitude: number,
  depth: number,
): number => density * gravityMagnitude * depth;

/** Buoyant force: F_b = ρ_fluid g V_displaced. */
export const buoyantForce = (
  fluidDensityValue: number,
  gravityMagnitude: number,
  displacedVolume: number,
): number => fluidDensityValue * gravityMagnitude * displacedVolume;

/** Archimedes net vertical force relative to object weight. */
export const buoyancyNetForce = (
  fluidDensityValue: number,
  objectDensity: number,
  gravityMagnitude: number,
  objectVolume: number,
): number =>
  (fluidDensityValue - objectDensity) * gravityMagnitude * objectVolume;

/** Fraction submerged for a floating object: V_sub/V = ρ_object/ρ_fluid. */
export const floatingSubmergedFraction = (objectDensity: number, fluidDensityValue: number): number => {
  if (fluidDensityValue <= 0) throw new RangeError("Fluid density must be greater than zero.");
  return objectDensity / fluidDensityValue;
};

/** Idealized dynamic pressure: q = ½ρv². */
export const dynamicPressure = (density: number, speed: number): number =>
  0.5 * density * speed ** 2;

/** Continuity equation for incompressible flow: A₁v₁ = A₂v₂. */
export const continuityVelocity = (
  areaIn: number,
  velocityIn: number,
  areaOut: number,
): number => {
  if (areaOut <= 0) throw new RangeError("Output area must be greater than zero.");
  return areaIn * velocityIn / areaOut;
};

/** Bernoulli pressure relation along a streamline. */
export const bernoulliPressure = (
  p1: number,
  density: number,
  velocity1: number,
  velocity2: number,
  height1: number,
  height2: number,
  gravityMagnitude: number,
): number =>
  p1 + 0.5 * density * (velocity1 ** 2 - velocity2 ** 2) +
  density * gravityMagnitude * (height1 - height2);
