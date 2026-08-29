import { describe, expect, it } from "vitest";
import {
  collisionPredictionSummary,
  horizontalMotionDirection,
  motionDirectionLabel,
} from "./experiment-learning";

describe("experiment learning helpers", () => {
  it("classifies horizontal movement with a small stopped range", () => {
    expect(horizontalMotionDirection(-0.4)).toBe("left");
    expect(horizontalMotionDirection(0.1)).toBe("stop");
    expect(horizontalMotionDirection(0.4)).toBe("right");
  });

  it("describes prediction progress and comparison", () => {
    expect(collisionPredictionSummary({ a: null, b: null }, null)).toContain("먼저");
    expect(collisionPredictionSummary({ a: "right", b: "left" }, null)).toContain("저장");
    expect(collisionPredictionSummary(
      { a: "right", b: "left" },
      { a: "right", b: "left" },
    )).toContain("모두 예상과 같아요");
  });

  it("uses child-readable direction labels", () => {
    expect(motionDirectionLabel("left")).toBe("왼쪽 ←");
    expect(motionDirectionLabel("stop")).toBe("멈춤");
    expect(motionDirectionLabel("right")).toBe("오른쪽 →");
  });
});
