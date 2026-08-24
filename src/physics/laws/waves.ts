/** Fundamental wave models. */

function requirePositive(value: number, name: string): void {
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

/** v = fλ */
export const waveSpeed = (frequency: number, wavelength: number): number => {
  requirePositive(frequency, "Frequency");
  requirePositive(wavelength, "Wavelength");
  return frequency * wavelength;
};

/** f = 1/T */
export const frequencyFromPeriod = (period: number): number => {
  requirePositive(period, "Period");
  return 1 / period;
};

/** k = 2π/λ */
export const waveNumber = (wavelength: number): number => {
  requirePositive(wavelength, "Wavelength");
  return 2 * Math.PI / wavelength;
};

/** ω = 2πf */
export const angularFrequencyFromFrequency = (frequency: number): number =>
  2 * Math.PI * frequency;

/** y(x,t) = A sin(kx - ωt + φ) */
export const travelingWave = (
  amplitude: number,
  waveNumberValue: number,
  angularFrequency: number,
  x: number,
  time: number,
  phase = 0,
): number => amplitude * Math.sin(waveNumberValue * x - angularFrequency * time + phase);

/** Intensity is proportional to amplitude squared. */
export const relativeIntensity = (amplitude: number): number => amplitude ** 2;

/** Constructive interference for path difference mλ. */
export const constructivePathDifference = (order: number, wavelength: number): number =>
  order * wavelength;

/** Destructive interference for path difference (m + 1/2)λ. */
export const destructivePathDifference = (order: number, wavelength: number): number =>
  (order + 0.5) * wavelength;

/** Standing-wave node spacing is λ/2. */
export const nodeSpacing = (wavelength: number): number => {
  requirePositive(wavelength, "Wavelength");
  return wavelength / 2;
};

/** String fixed at both ends: f_n = n v/(2L). */
export const fixedStringHarmonicFrequency = (
  harmonic: number,
  speed: number,
  length: number,
): number => {
  requirePositive(harmonic, "Harmonic");
  requirePositive(speed, "Wave speed");
  requirePositive(length, "Length");
  return harmonic * speed / (2 * length);
};

/** Open pipe harmonic frequency: f_n = n v/(2L). */
export const openPipeHarmonicFrequency = fixedStringHarmonicFrequency;

/** Closed pipe odd harmonics: f_n = (2n-1)v/(4L), n = 1,2,... */
export const closedPipeHarmonicFrequency = (
  harmonicIndex: number,
  speed: number,
  length: number,
): number => {
  requirePositive(harmonicIndex, "Harmonic index");
  requirePositive(speed, "Wave speed");
  requirePositive(length, "Length");
  return (2 * harmonicIndex - 1) * speed / (4 * length);
};

/** Sound intensity level: β = 10 log10(I/I₀). */
export const soundIntensityLevel = (intensity: number, referenceIntensity = 1e-12): number => {
  requirePositive(intensity, "Intensity");
  requirePositive(referenceIntensity, "Reference intensity");
  return 10 * Math.log10(intensity / referenceIntensity);
};

/** Classical Doppler effect: f' = f (v ± vo)/(v ∓ vs). */
export const dopplerFrequency = (
  sourceFrequency: number,
  waveSpeedValue: number,
  observerVelocity: number,
  sourceVelocity: number,
): number => {
  requirePositive(sourceFrequency, "Source frequency");
  requirePositive(waveSpeedValue, "Wave speed");
  const denominator = waveSpeedValue - sourceVelocity;
  if (denominator === 0) throw new RangeError("Source velocity cannot equal wave speed.");
  return sourceFrequency * (waveSpeedValue + observerVelocity) / denominator;
};
