/** Small, unit-aware optics relations used by the light subject experience. */

const requirePositive = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be greater than zero.`);
};

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

/** Direction angle after specular reflection around a surface-normal angle. */
export const reflectedAngle = (incidentAngle: number, normalAngle: number): number =>
  2 * normalAngle - incidentAngle + Math.PI;

/** Law-of-reflection angle magnitude retained for physics-law consumers. */
export const reflectionAngle = (incidentAngle: number): number => incidentAngle;

/** Snell's law. Returns null when total internal reflection occurs. */
export const refractedAngle = (
  incidentFromNormal: number,
  refractiveIndex1: number,
  refractiveIndex2: number,
): number | null => {
  requirePositive(refractiveIndex1, "First refractive index");
  requirePositive(refractiveIndex2, "Second refractive index");
  const sine = refractiveIndex1 * Math.sin(incidentFromNormal) / refractiveIndex2;
  return Math.abs(sine) > 1 ? null : Math.asin(clampUnit(sine));
};

/** Snell's law variant that reports total internal reflection as an invalid refracted ray. */
export const refractionAngle = (n1: number, n2: number, incidentAngle: number): number => {
  const result = refractedAngle(incidentAngle, n1, n2);
  if (result === null) throw new RangeError("Total internal reflection: no refracted ray.");
  return result;
};

export const criticalAngle = (refractiveIndex1: number, refractiveIndex2: number): number => {
  requirePositive(refractiveIndex1, "First refractive index");
  requirePositive(refractiveIndex2, "Second refractive index");
  if (refractiveIndex1 <= refractiveIndex2) throw new RangeError("Critical angle requires n1 > n2.");
  return Math.asin(refractiveIndex2 / refractiveIndex1);
};

/** Thin-lens equation with positive real-object and converging-lens convention. */
export const lensImageDistance = (focalLength: number, objectDistance: number): number => {
  if (!Number.isFinite(focalLength) || focalLength === 0) throw new RangeError("Focal length must be non-zero.");
  requirePositive(objectDistance, "Object distance");
  const denominator = 1 / focalLength - 1 / objectDistance;
  return Math.abs(denominator) < 1e-12 ? Number.POSITIVE_INFINITY : 1 / denominator;
};

/** Signed thin-lens / spherical-mirror relation retained for virtual-object models. */
export const imageDistance = (focalLength: number, objectDistance: number): number => {
  if (focalLength === 0 || objectDistance === 0) {
    throw new RangeError("Focal length and object distance must be non-zero.");
  }
  const denominator = 1 / focalLength - 1 / objectDistance;
  return denominator === 0 ? Number.POSITIVE_INFINITY : 1 / denominator;
};

export const mirrorImageDistance = imageDistance;
export const focalLengthFromRadius = (radius: number): number => radius / 2;

export const lensMagnification = (imageDistance: number, objectDistance: number): number => {
  if (objectDistance === 0) throw new RangeError("Object distance must be non-zero.");
  return -imageDistance / objectDistance;
};

export const refractiveIndex = (lightSpeedInVacuum: number, lightSpeedInMediumValue: number): number => {
  requirePositive(lightSpeedInVacuum, "Vacuum light speed");
  requirePositive(lightSpeedInMediumValue, "Medium light speed");
  return lightSpeedInVacuum / lightSpeedInMediumValue;
};

export const lightSpeedInMedium = (vacuumSpeed: number, index: number): number => {
  requirePositive(vacuumSpeed, "Vacuum light speed");
  requirePositive(index, "Refractive index");
  return vacuumSpeed / index;
};

/** Approximate minimum-deviation relation for a thin prism. */
export const prismDeviation = (refractiveIndex: number, apexAngle: number): number => {
  requirePositive(refractiveIndex, "Refractive index");
  requirePositive(apexAngle, "Apex angle");
  return (refractiveIndex - 1) * apexAngle;
};

const sinc = (value: number): number => Math.abs(value) < 1e-12 ? 1 : Math.sin(value) / value;

/** Normalized Fraunhofer double-slit intensity including a single-slit envelope. */
export const doubleSlitIntensity = (
  angle: number,
  wavelength: number,
  slitSeparation: number,
  slitWidth: number,
): number => {
  requirePositive(wavelength, "Wavelength");
  requirePositive(slitSeparation, "Slit separation");
  requirePositive(slitWidth, "Slit width");
  const phase = Math.PI * slitSeparation * Math.sin(angle) / wavelength;
  const envelopePhase = Math.PI * slitWidth * Math.sin(angle) / wavelength;
  return Math.cos(phase) ** 2 * sinc(envelopePhase) ** 2;
};

export const doubleSlitBrightAngle = (slitSeparation: number, wavelength: number, order: number): number => {
  requirePositive(slitSeparation, "Slit separation");
  requirePositive(wavelength, "Wavelength");
  const sine = order * wavelength / slitSeparation;
  if (Math.abs(sine) > 1) throw new RangeError("No far-field maximum exists for this order.");
  return Math.asin(sine);
};

export const doubleSlitDarkAngle = (slitSeparation: number, wavelength: number, order: number): number => {
  requirePositive(slitSeparation, "Slit separation");
  requirePositive(wavelength, "Wavelength");
  const sine = (order + 0.5) * wavelength / slitSeparation;
  if (Math.abs(sine) > 1) throw new RangeError("No far-field minimum exists for this order.");
  return Math.asin(sine);
};

/** Normalized single-slit Fraunhofer diffraction intensity. */
export const singleSlitIntensity = (angle: number, wavelength: number, slitWidth: number): number => {
  requirePositive(wavelength, "Wavelength");
  requirePositive(slitWidth, "Slit width");
  return sinc(Math.PI * slitWidth * Math.sin(angle) / wavelength) ** 2;
};

export const singleSlitMinimumAngle = (slitWidth: number, wavelength: number, order: number): number => {
  requirePositive(slitWidth, "Slit width");
  requirePositive(wavelength, "Wavelength");
  requirePositive(order, "Order");
  const sine = order * wavelength / slitWidth;
  if (Math.abs(sine) > 1) throw new RangeError("No far-field minimum exists for this order.");
  return Math.asin(sine);
};

/** Malus's law for ideal linear polarizers. */
export const polarizedIntensity = (initialIntensity: number, relativeAngle: number): number => {
  if (!Number.isFinite(initialIntensity) || initialIntensity < 0) {
    throw new RangeError("Initial intensity must be non-negative.");
  }
  return initialIntensity * Math.cos(relativeAngle) ** 2;
};

/** Angular magnification of an astronomical telescope. */
export const telescopeMagnification = (objectiveFocalLength: number, eyepieceFocalLength: number): number => {
  requirePositive(objectiveFocalLength, "Objective focal length");
  requirePositive(eyepieceFocalLength, "Eyepiece focal length");
  return -objectiveFocalLength / eyepieceFocalLength;
};

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
