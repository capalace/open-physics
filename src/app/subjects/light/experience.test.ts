import { describe, expect, it } from "vitest";
import { lightGraphHeading } from "./experience";

describe("light experience graph headings", () => {
  it("replaces the previous guided axes with sandbox path units", () => {
    expect(lightGraphHeading("sandbox")).toEqual({
      title: "장치 순서에 따른 광선 경로",
      axes: "만난 장치 (번째) · 진행 방향 (°)",
    });
    expect(lightGraphHeading("reflection").axes).toBe("입사각 (°) · 반사각 (°)");
  });
});
