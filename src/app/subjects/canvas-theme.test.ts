import { describe, expect, it } from "vitest";
import { drawInteractionAffordance, interactionHitRadius } from "./canvas-theme";

function recordingContext(): { context: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const context = new Proxy({}, {
    get: (_target, key) => (...args: unknown[]) => calls.push(`${String(key)}:${args.join(",")}`),
    set: (_target, key, value) => { calls.push(`${String(key)}=${String(value)}`); return true; },
  }) as CanvasRenderingContext2D;
  return { context, calls };
}

describe("Canvas interaction affordances", () => {
  it("renders direct objects and dedicated handles as unmistakably different controls", () => {
    const direct = recordingContext();
    drawInteractionAffordance(direct.context, { x: 120, y: 100 }, { kind: "object", radius: 34 });
    const handle = recordingContext();
    drawInteractionAffordance(handle.context, { x: 120, y: 100 }, { kind: "handle", axis: "x" });

    expect(direct.calls.join(" ")).toContain("fillText:직접 끌기");
    expect(handle.calls.join(" ")).toContain("fillText:좌우 조절");
    expect(handle.calls.join(" ")).toContain("fillStyle=#e05c3f");
    expect(direct.calls).not.toEqual(handle.calls);
  });

  it("keeps mobile hit targets finger-sized in world coordinates", () => {
    const canvas = {
      getBoundingClientRect: () => ({ width: 360, height: 216 }),
    } as HTMLCanvasElement;

    expect(interactionHitRadius(canvas, 1000, 600)).toBeCloseTo(66.67, 1);
    expect(interactionHitRadius(canvas, 1000, 600, 42, 12)).toBe(42);
  });

  it("does not activate a handle far outside its visible desktop control", () => {
    const canvas = {
      getBoundingClientRect: () => ({ width: 800, height: 500 }),
    } as HTMLCanvasElement;
    const radius = interactionHitRadius(canvas, 960, 600);

    expect(radius * 800 / 960).toBeLessThanOrEqual(28);
    expect(radius * 500 / 600).toBeLessThanOrEqual(28);
  });

});
