# Open Physics — Product Guidelines

> **Status:** Foundational guideline  
> **Purpose:** Define the product goal and content navigation before implementation decisions are made.

## 1. Product Goal

Open Physics is not primarily a collection of physics lessons or isolated simulations.

It is a **physics sandbox in which users can directly manipulate objects and observe physical laws operating on them**.

The core product experience is:

> **Place, move, change, and connect things in a physical world, then observe what the physics does.**

The intended audience is broad: children, students, and anyone who wants to explore physics visually. The product should not assume that the user is a high-school student, even though high-school physics provides a useful reference point for selecting and organizing concepts.

### Core principles

- **One physical world:** Physics should feel like one coherent space rather than a collection of unrelated mini-applications.
- **Direct manipulation:** Users should be able to create, place, drag, connect, and modify objects.
- **Physics is real within the selected model:** Objects interact according to the active physical laws rather than merely playing an animation.
- **Progressive complexity:** The same world can expose simple or more advanced physical models depending on the current section, preset, or user configuration.
- **Exploration over instruction:** Guided content should help users get started, but it must not turn the sandbox into a rigid sequence of button presses.
- **Presets are starting states:** A preset configures a useful physical situation. Users should be able to modify it and continue experimenting.
- **Visual understanding:** Important physical quantities and relationships should be observable through motion, vectors, fields, graphs, energy displays, waves, particles, and other appropriate visualizations.
- **Physics first, curriculum second:** The product structure should represent physics naturally. Educational curricula are references for coverage and progression, not hard architectural boundaries.

## 2. One World, Progressive Physics

The product should be understood as a single **Physics World** with multiple physical models and visualization systems.

Conceptually:

```text
Physics World
├── Objects
├── Environment
├── Physics Models
└── Visualization
```

The available laws and models may be intentionally limited or simplified in an introductory context and expanded as the user moves into more advanced content.

For example, gravity can progress from:

```text
Uniform gravity
    ↓
Two-body gravitational interaction
    ↓
Multiple-body gravitational interaction
```

This is not about removing physics from the sandbox. It is about controlling the **scope and complexity of the model** so that the same environment remains approachable while supporting deeper exploration.

## 3. Guided Content and Free Exploration

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

## 4. Presets

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

## 5. Content Navigation

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

### 5.1 Mechanics

1. Motion
2. Forces
3. Collisions
4. Energy
5. Rotation
6. Oscillation
7. Gravity and Orbits
8. Fluids

### 5.2 Electromagnetism

1. Charge
2. Electric Field
3. Electric Potential
4. Circuits
5. Capacitors
6. Magnetic Field
7. Electromagnetic Force
8. Electromagnetic Induction

### 5.3 Waves

1. Making Waves
2. Wave Propagation
3. Superposition and Interference
4. Standing Waves
5. Resonance
6. Sound
7. Doppler Effect

### 5.4 Light

1. Straight-Line Propagation
2. Reflection
3. Refraction
4. Lenses
5. Prisms and Color
6. Interference and Diffraction
7. Polarization
8. Optical Instruments

### 5.5 Thermal Physics

1. Temperature and Particles
2. Heat Transfer
3. Phase Changes
4. Gases
5. Heat and Energy
6. Heat Engines
7. Entropy

### 5.6 Modern Physics

1. Relativity
2. Atoms
3. Photoelectric Effect
4. Matter Waves
5. Quantum Physics
6. Quantum Tunneling
7. Atomic Nuclei
8. Semiconductors

This gives the product **46 content sections**.

## 6. Content Is Not the Physics Engine

The content structure and the simulation architecture are separate concerns.

A section such as **Electric Field** does not imply a dedicated application. It can be implemented using reusable simulation capabilities such as:

```text
Charges
+ Field Solver
+ Force Calculation
+ Field Visualization
+ User Interaction
```

Likewise:

```text
Double Pendulum
= Rigid Bodies
+ Constraints
+ Gravity
```

```text
Newton's Cradle
= Rigid Bodies
+ Collision
+ Constraints
```

```text
Double Slit
= Wave Sources
+ Boundary Conditions
+ Superposition
+ Screen Visualization
```

The long-term goal is therefore **not to build one bespoke simulator per content item**. The goal is to build a relatively small set of powerful, reusable physical primitives from which many phenomena can be composed.

## 7. Curriculum as a Reference

Educational curricula, including Korean school curricula, are useful references for:

- identifying important concepts;
- checking conceptual coverage;
- finding reasonable progression;
- identifying terminology;
- avoiding major omissions.

They are **not the primary product taxonomy** and should not unnecessarily constrain the simulation architecture.

The product should be able to serve users below, at, and above a particular school curriculum level.

## 8. Scope of This Guideline

This document establishes the foundational product direction only.

It does **not** yet define:

- the technology stack;
- the physics engine implementation;
- numerical methods;
- object/component schemas;
- rendering architecture;
- UI design;
- exact lesson sequences;
- MVP priorities;
- assessment or grading systems.

Those decisions should be made later while remaining consistent with the principles above.

## 9. North Star

The product should make this interaction feel natural:

```text
I have an idea.
    ↓
I place some objects in the world.
    ↓
I change their properties or environment.
    ↓
Physics responds.
    ↓
I can see why it responded that way.
    ↓
I change something else and try again.
```

**The user should be exploring physics, not operating a physics calculator.**
