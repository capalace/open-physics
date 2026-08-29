import { describe, expect, it, vi } from "vitest";
import { WavesListenerRegistry } from "./experience";

describe("waves experience lifecycle", () => {
  it("drops old inspector listeners immediately and all remaining listeners on unmount", () => {
    const listeners = new WavesListenerRegistry();
    const persistent = new EventTarget();
    const oldInspector = new EventTarget();
    const nextInspector = new EventTarget();
    const persistentAction = vi.fn();
    const oldAction = vi.fn();
    const nextAction = vi.fn();
    listeners.listen(persistent, "click", persistentAction);
    listeners.listen(oldInspector, "click", oldAction, "inspector");
    listeners.clearInspector();
    listeners.listen(nextInspector, "click", nextAction, "inspector");

    oldInspector.dispatchEvent(new Event("click"));
    persistent.dispatchEvent(new Event("click"));
    nextInspector.dispatchEvent(new Event("click"));
    expect(oldAction).not.toHaveBeenCalled();
    expect(persistentAction).toHaveBeenCalledOnce();
    expect(nextAction).toHaveBeenCalledOnce();

    listeners.disposeAll();
    persistent.dispatchEvent(new Event("click"));
    nextInspector.dispatchEvent(new Event("click"));
    expect(persistentAction).toHaveBeenCalledOnce();
    expect(nextAction).toHaveBeenCalledOnce();
  });
});
