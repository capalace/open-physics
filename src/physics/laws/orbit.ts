import { SI } from "../quantities";

/** Circular-orbit speed: v = √(GM/r). */
export const circularOrbitSpeed = (
  centralMass: number,
  radius: number,
  gravitationalConstant = SI.gravitationalConstant,
): number => {
  if (centralMass <= 0 || radius <= 0 || gravitationalConstant <= 0) {
    throw new RangeError("Central mass, radius, and G must be greater than zero.");
  }
  return Math.sqrt(gravitationalConstant * centralMass / radius);
};

/** Circular-orbit period: T = 2π√(r³/GM). */
export const circularOrbitPeriod = (
  centralMass: number,
  radius: number,
  gravitationalConstant = SI.gravitationalConstant,
): number => 2 * Math.PI * Math.sqrt(radius ** 3 / (gravitationalConstant * centralMass));

/** Escape speed: v = √(2GM/r). */
export const escapeSpeed = (
  centralMass: number,
  radius: number,
  gravitationalConstant = SI.gravitationalConstant,
): number => {
  if (centralMass <= 0 || radius <= 0 || gravitationalConstant <= 0) {
    throw new RangeError("Central mass, radius, and G must be greater than zero.");
  }
  return Math.sqrt(2 * gravitationalConstant * centralMass / radius);
};

/** Gravitational potential energy: U = -GMm/r. */
export const gravitationalPotentialEnergyOrbit = (
  centralMass: number,
  orbitingMass: number,
  radius: number,
  gravitationalConstant = SI.gravitationalConstant,
): number => -gravitationalConstant * centralMass * orbitingMass / radius;

/** Total energy of a circular orbit: E = -GMm/(2r). */
export const circularOrbitEnergy = (
  centralMass: number,
  orbitingMass: number,
  radius: number,
  gravitationalConstant = SI.gravitationalConstant,
): number => -gravitationalConstant * centralMass * orbitingMass / (2 * radius);

/** Kepler's third law in two-body form: T² = 4π²a³ / G(M+m). */
export const keplerPeriod = (
  semiMajorAxis: number,
  centralMass: number,
  orbitingMass = 0,
  gravitationalConstant = SI.gravitationalConstant,
): number => 2 * Math.PI * Math.sqrt(
  semiMajorAxis ** 3 / (gravitationalConstant * (centralMass + orbitingMass)),
);
