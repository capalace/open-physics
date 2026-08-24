# Open Physics — Product Guidelines

> **Status:** Foundational guideline  
> **Purpose:** Define the product goal, simulation philosophy, and content navigation before implementation decisions are made.

## 1. Product Goal

Open Physics is not primarily a collection of physics lessons or isolated simulations.

It is a **physics sandbox in which users can directly manipulate objects and observe physics models operating on them**.

The core product experience is:

> **Place, move, change, and connect things in a physical world, then observe what the physics does.**

The intended audience is broad: children, students, and anyone who wants to explore physics visually. The product should not assume that the user is a high-school student, even though high-school physics provides a useful reference point for selecting and organizing concepts.

### Core principles

- **One physical world:** Physics should feel like one coherent space rather than a collection of unrelated mini-applications.
- **Direct manipulation:** Users should be able to create, place, drag, connect, and modify objects.
- **Model-based physics:** Objects interact according to the equations and assumptions of the active physical model rather than attempting to reproduce every detail of the real world.
- **Progressive complexity:** The same world can expose simple or more advanced physical models depending on the current section, preset, or user configuration.
- **Exploration over instruction:** Guided content should help users get started, but it must not turn the sandbox into a rigid sequence of button presses.
- **Presets are starting states:** A preset configures a useful physical situation. Users should be able to modify it and continue experimenting.
- **Visual understanding:** Important physical quantities and relationships should be observable through motion, vectors, fields, graphs, energy displays, waves, particles, and other appropriate visualizations.
- **Physics first, curriculum second:** The product structure should represent physics naturally. Educational curricula are references for coverage and progression, not hard architectural boundaries.
- **Client-side first:** The simulation should run entirely in the browser. A backend is not required for the core physics experience.

## 2. Simulation Philosophy: Physics as a Model

Open Physics does **not** aim to reproduce the complete physical complexity of the real world.

A simulation represents a **defined physical situation under explicit assumptions**, using the equations appropriate to that model.

For example, a free-fall simulation may assume a uniform gravitational field:

```text
F = ma
F = mg
→ a = g
```

It does not need to simulate air turbulence, microscopic surface effects, or other phenomena unless those effects are explicitly part of the model.

The important question is therefore not:

> "Is this identical to reality?"

but:

> "Does this simulation correctly apply the intended physical model and make its consequences observable?"

### Example laws

```text
Newton's second law
F = ma

Gravity near a surface
F = mg

Spring force
F = -kx

Universal gravitation
F = Gm₁m₂ / r²

Momentum
p = mv

Kinetic energy
K = ½mv²

Coulomb's law
F = kq₁q₂ / r²

Electric field
E = F/q

Ohm's law
V = IR

Thin lens equation
1/f = 1/dₒ + 1/dᵢ
```

These equations are examples of **physics models**, not merely formulas displayed to the user.

## 3. Equation-Based Physics Core

The core simulation architecture should be organized around:

```text
Physics World
    ↓
Physical Model
    ↓
Objects + Parameters + Conditions
    ↓
Equations
    ↓
Numerical Solver
    ↓
New World State
    ↓
Visualization
```

A physical law defines relationships between variables. A solver determines how the system evolves over time according to those relationships.

### Physics law and numerical solver are separate

A law such as:

```text
F = ma
```

must not be tightly coupled to one particular numerical integration method.

The same physical model may later use different numerical methods depending on the requirements of the simulation:

```text
Physics Law
    ≠
Numerical Solver
```

Possible solvers include Euler, Verlet, Runge-Kutta methods, or specialized solvers where appropriate.

The exact solver should be selected based on the behavior and educational purpose of each model rather than on a requirement to reproduce a general-purpose real-world physics engine.

## 4. Physics Models as Composable Modules

Physical laws should be represented as reusable modules that can be combined to create simulations.

Conceptually:

```text
Gravity
Spring
Friction
Coulomb Force
Electric Field
Ohm's Law
Snell's Law
Lens Equation
Ideal Gas Law
...
```

A model can be viewed as:

```text
Input Variables
    ↓
Equation / Rules
    ↓
Calculated Quantities
    ↓
World State Update
```

For example:

```text
Double Pendulum
= Rigid Bodies
+ Constraints
+ Gravity
```

```text
Electric Field
= Charges
+ Field Calculation
+ Force Calculation
+ Field Visualization
```

```text
Double Slit
= Wave Sources
+ Boundary Conditions
+ Superposition
+ Screen Visualization
```

The long-term goal is therefore **not to build one bespoke simulator per content item**. The goal is to build a relatively small set of reusable physical models and primitives from which many phenomena can be composed.

## 5. Scope of Physical Models

The same physical topic can expose progressively more sophisticated models.

For example:

```text
Gravity
    ↓
Uniform gravitational field
    ↓
Two-body gravitational interaction
    ↓
Multiple-body gravitational interaction
```

This is not about removing physics from the sandbox. It is about controlling the **scope and complexity of the assumptions and equations** so that the same environment remains approachable while supporting deeper exploration.

A section therefore defines, directly or indirectly, which physical models are currently relevant and available.

## 6. One World, Progressive Physics

The product should be understood as a single **Physics World** with multiple physical models and visualization systems.

Conceptually:

```text
Physics World
├── Objects
├── Environment
├── Physics Models
└── Visualization
```

The user can manipulate the world, while the active model determines how those objects behave.

This allows the product to preserve the important idea that an object is not merely an animation asset. When the applicable model says that an object should fall, accelerate, interact with a field, reflect a wave, or exchange energy, the simulation should calculate and visualize that behavior.

## 7. Client-Side Architecture

The core product must run entirely in the browser.

```text
Browser
│
├── UI
├── Physics World
├── Physics Core
├── Numerical Solvers
├── Renderer
└── Content / Presets
```

There is no backend dependency for the core simulation loop.

Conceptually:

```text
User Input
    ↓
World State
    ↓
Physics Model
    ↓
Solver
    ↓
Updated World State
    ↓
Renderer
    ↓
User Input
```

Persistence and sharing, if introduced later, should be based on serializable world state rather than requiring a server-side simulation.

For example, a world may eventually be represented as data such as:

```json
{
  "gravity": [0, 9.81],
  "objects": [
    {
      "type": "ball",
      "mass": 1,
      "position": [2, 4],
      "velocity": [3, 0]
    }
  ]
}
```

This makes presets, local persistence, import/export, and potentially shareable simulations possible without making a backend part of the simulation architecture.

## 8. Rendering Dimension

The initial product should be **2D**.

2D is the preferred starting point because it makes direct manipulation and visualization of physical quantities especially clear:

- force, velocity, and acceleration vectors;
- trajectories;
- electric and magnetic fields;
- waves and interference;
- optical rays;
- particles and thermal motion;
- graphs and measurements.

The product should not attempt to reproduce every three-dimensional detail when a 2D representation of the intended physical model is clearer.

The architecture should nevertheless avoid unnecessarily coupling the physics model to the renderer so that a 3D renderer can be introduced later if a specific class of phenomena genuinely benefits from it.

Conceptually:

```text
Physics Core
      │
      ├── 2D Renderer
      │
      └── Future 3D Renderer (if justified)
```

## 9. Guided Content and Free Exploration

Content navigation exists to prevent the user from being dropped into an empty sandbox with no idea what to investigate.

A typical experience can move from:

```text
Content
  ↓
Guided experiment
  ↓
Direct manipulation
  ↓
Observation
  ↓
Free exploration
```

Guided experiments should configure an initial state, suggest useful actions, and expose relevant visualizations. They should not fundamentally restrict the underlying sandbox.

A section may therefore contain:

- introductory setups;
- guided experiments;
- presets;
- variations of the same physical situation;
- a free-experiment entry point.

## 10. Presets

A preset is **not a separate simulation implementation**.

It is a predefined world state containing some combination of:

- objects;
- object properties;
- initial positions;
- initial velocities;
- constraints;
- environmental conditions;
- active physics models;
- visualization settings.

Examples include:

- free fall;
- Newton's cradle;
- double pendulum;
- planetary orbit;
- electric field around charges;
- double slit;
- lens optical system;
- heat engine.

A user should generally be able to open a preset and then modify it freely.

## 11. Content Navigation

The top-level navigation is organized around six broad areas of physics.

```text
Mechanics
Electromagnetism
Waves
Light
Thermal Physics
Modern Physics
```

The following sections form the current baseline navigation. This list is intentionally broad rather than exhaustive.

### 11.1 Mechanics

1. Motion
2. Forces
3. Collisions
4. Energy
5. Rotation
6. Oscillation
7. Gravity and Orbits
8. Fluids

### 11.2 Electromagnetism

1. Charge
2. Electric Field
3. Electric Potential
4. Circuits
5. Capacitors
6. Magnetic Field
7. Electromagnetic Force
8. Electromagnetic Induction

### 11.3 Waves

1. Making Waves
2. Wave Propagation
3. Superposition and Interference
4. Standing Waves
5. Resonance
6. Sound
7. Doppler Effect

### 11.4 Light

1. Straight-Line Propagation
2. Reflection
3. Refraction
4. Lenses
5. Prisms and Color
6. Interference and Diffraction
7. Polarization
8. Optical Instruments

### 11.5 Thermal Physics

1. Temperature and Particles
2. Heat Transfer
3. Phase Changes
4. Gases
5. Heat and Energy
6. Heat Engines
7. Entropy

### 11.6 Modern Physics

1. Relativity
2. Atoms
3. Photoelectric Effect
4. Matter Waves
5. Quantum Physics
6. Quantum Tunneling
7. Atomic Nuclei
8. Semiconductors

This gives the product **46 content sections**.

## 12. Content Is Not the Physics Engine

The content structure and the simulation architecture are separate concerns.

A section such as **Electric Field** does not imply a dedicated application. It can be implemented using reusable simulation capabilities.

Content determines things such as:

- which objects are initially present;
- which physical models are active;
- which parameters are exposed;
- which visualizations are shown;
- which guided experiments are offered.

The underlying Physics Core remains reusable.

## 13. Curriculum as a Reference

Educational curricula, including Korean school curricula, are useful references for:

- identifying important concepts;
- checking conceptual coverage;
- finding reasonable progression;
- identifying terminology;
- avoiding major omissions.

They are **not the primary product taxonomy** and should not unnecessarily constrain the simulation architecture.

The product should be able to serve users below, at, and above a particular school curriculum level.

## 14. Scope of This Guideline

This document establishes the foundational product direction only.

It does **not** yet define:

- the final technology stack;
- exact numerical methods for every model;
- object/component schemas;
- rendering implementation details;
- UI design;
- exact lesson sequences;
- MVP priorities;
- assessment or grading systems.

Those decisions should be made later while remaining consistent with the principles above.

## 15. North Star

The product should make this interaction feel natural:

```text
I have an idea.
    ↓
I place some objects in the world.
    ↓
I change their properties or environment.
    ↓
Physics responds according to the selected model.
    ↓
I can see why it responded that way.
    ↓
I change something else and try again.
```

**The user should be exploring physics, not operating a physics calculator or a game physics engine.**
