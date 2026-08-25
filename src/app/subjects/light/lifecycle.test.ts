import { describe, expect, it, vi } from "vitest";
import { LightEventScopes } from "./lifecycle";

describe("light experience event lifecycle", () => {
  it("replaces inspector listeners by render scope and aborts every listener on unmount", () => {
    const scopes = new LightEventScopes();
    const target = new EventTarget();
    const staleGuide = vi.fn();
    const currentGuide = vi.fn();
    const palette = vi.fn();
    const lifetime = vi.fn();

    target.addEventListener("guide", staleGuide, { signal: scopes.nextGuideSignal() });
    target.addEventListener("guide", currentGuide, { signal: scopes.nextGuideSignal() });
    target.addEventListener("palette", palette, { signal: scopes.nextPaletteSignal() });
    target.addEventListener("lifetime", lifetime, { signal: scopes.lifetimeSignal });
    target.dispatchEvent(new Event("guide"));
    target.dispatchEvent(new Event("palette"));
    target.dispatchEvent(new Event("lifetime"));

    expect(staleGuide).not.toHaveBeenCalled();
    expect(currentGuide).toHaveBeenCalledOnce();
    expect(palette).toHaveBeenCalledOnce();
    expect(lifetime).toHaveBeenCalledOnce();

    scopes.dispose();
    target.dispatchEvent(new Event("guide"));
    target.dispatchEvent(new Event("palette"));
    target.dispatchEvent(new Event("lifetime"));
    expect(currentGuide).toHaveBeenCalledOnce();
    expect(palette).toHaveBeenCalledOnce();
    expect(lifetime).toHaveBeenCalledOnce();
  });
});
