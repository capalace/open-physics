/** Foundational optics models for the 2D physics environment. */

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** Law of reflection: θi = θr. */
export const reflectionAngle = (incidentAngle: number): number => incidentAngle;

/** Snell's law: n1 sin θ1 = n2 sin θ2. */
export const refractionAngle = (
  n1: number,
  n2: number,
  incidentAngle: number,
): number => {
  requirePositive(n1, "Refractive index 1");
  requirePositive(n2, "Refractive index 2");
  const value = (n1 / n2) * Math.sin(incidentAngle);
  if (Math.abs(value) > 1) throw new RangeError("Total internal reflection: no refracted ray.");
  return Math.asin(value);
};

/** Critical angle for total internal reflection: sin θc = n2/n1, n1 > n2. */
export const criticalAngle = (n1: number, n2: number): number => {
  requirePositive(n1, "Refractive index 1");
  requirePositive(n2, "Refractive index 2");
  if (n1 <= n2) throw new RangeError("Critical angle requires n1 > n2.");
  return Math.asin(n2 / n1);
};

/** Thin lens equation: 1/f = 1/do + 1/di. */
export const imageDistance = (focalLength: number, objectDistance: number): number => {
  if (focalLength === 0 || objectDistance === 0) {
    throw new RangeError("Focal length and object distance must be non-zero.");
  }
  const denominator = 1 / focalLength - 1 / objectDistance;
  if (denominator === 0) return Infinity;
  return 1 / denominator;
};

/** Magnification: m = -di/do. */
export const lensMagnification = (imageDistanceValue: number, objectDistance: number): number => {
  if (objectDistance === 0) throw new RangeError("Object distance must be non-zero.");
  return -imageDistanceValue / objectDistance;
};

/** Mirror equation: 1/f = 1/do + 1/di. */
export const mirrorImageDistance = imageDistance;

/** Spherical mirror focal length: f = R/2. */
export const focalLengthFromRadius = (radius: number): number => radius / 2;

/** Refractive index: n = c/v. */
export const refractiveIndex = (lightSpeedInVacuum: number, lightSpeedInMedium: number): number => {
  requirePositive(lightSpeedInVacuum, "Vacuum light speed");
  requirePositive(lightSpeedInMedium, "Medium light speed");
  return lightSpeedInVacuum / lightSpeedInMedium;
};

/** Speed of light in a medium: v = c/n. */
export const lightSpeedInMedium = (vacuumSpeed: number, index: number): number => {
  requirePositive(vacuumSpeed, "Vacuum light speed");
  requirePositive(index, "Refractive index");
  return vacuumSpeed / index;
};

/** Double-slit constructive condition: d sin θ = mλ. */
export const doubleSlitBrightAngle = (
  slitSeparation: number,
  wavelength: number,
  order: number,
): number => {
  requirePositive(slitSeparation, "Slit separation");
  requirePositive(wavelength, "Wavelength");
  const value = order * wavelength / slitSeparation;
  if (Math.abs(value) > 1) throw new RangeError("No far-field maximum exists for this order.");
  return Math.asin(value);
};

/** Double-slit destructive condition: d sin θ = (m + 1/2)λ. */
export const doubleSlitDarkAngle = (
  slitSeparation: number,
  wavelength: number,
  order: number,
): number => {
  requirePositive(slitSeparation, "Slit separation");
  requirePositive(wavelength, "Wavelength");
  const value = (order + 0.5) * wavelength / slitSeparation;
  if (Math.abs(value) > 1) throw new RangeError("No far-field minimum exists for this order.");
  return Math.asin(value);
};

/** Single-slit minima: a sin θ = mλ, m = 1,2,... */
export const singleSlitMinimumAngle = (
  slitWidth: number,
  wavelength: number,
  order: number,
): number => {
  requirePositive(slitWidth, "Slit width");
  requirePositive(wavelength, "Wavelength");
  requirePositive(order, "Order");
  const value = order * wavelength / slitWidth;
  if (Math.abs(value) > 1) throw new RangeError("No far-field minimum exists for this order.");
  return Math.asin(value);
};

/** Photon energy: E = hf = hc/λ. */
export const photonEnergyFromFrequency = (frequency: number, planckConstant: number): number =>
  planckConstant * frequency;

export const photonEnergyFromWavelength = (
  planckConstant: number,
  vacuumSpeed: number,
  wavelength: number,
): number => {
  requirePositive(wavelength, "Wavelength");
  return planckConstant * vacuumSpeed / wavelength;
};
