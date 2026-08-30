import { describe, expect, it } from "vitest";
import { validateSubjectDefinition } from "../subject-experience";
import { THERMAL_LAB_IDS, thermalDefinition } from "./catalog";

describe("thermal catalog", () => {
  it("contains each of the eight curriculum labs exactly once", () => {
    expect(thermalDefinition.labs.map((lab) => lab.id)).toEqual(THERMAL_LAB_IDS);
    expect(() => validateSubjectDefinition(thermalDefinition, THERMAL_LAB_IDS)).not.toThrow();
  });

  it("gives every lab a unique manipulation and measurable graph", () => {
    expect(new Set(thermalDefinition.labs.flatMap((lab) => lab.controls)).size).toBe(8);
    expect(new Set(thermalDefinition.labs.map((lab) => lab.graph.title)).size).toBe(8);
    expect(thermalDefinition.labs.find((lab) => lab.id === "gas")?.graph.kind).toBe("pv");
    expect(thermalDefinition.labs.find((lab) => lab.id === "particles")?.graph.kind).toBe("distribution");
  });
});
