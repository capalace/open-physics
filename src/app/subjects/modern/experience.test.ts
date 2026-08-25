import { describe, expect, it, vi } from "vitest";
import { modernGraphLegendMarkup, ModernListenerRegistry } from "./experience";
import { modernDefinition } from "./catalog";

describe("modern experience helpers", () => {
  it("renders every graph series label with its catalog color", () => {
    for (const lab of modernDefinition.labs) {
      const markup = modernGraphLegendMarkup(lab.graph);
      for (const series of lab.graph.series) {
        expect(markup).toContain(series.label);
        expect(markup).toContain(series.color);
      }
    }
  });
  it("replaces inspector listeners and clears all listeners on unmount", () => {
    const registry = new ModernListenerRegistry(); const persistent = new EventTarget(); const oldInspector = new EventTarget(); const nextInspector = new EventTarget();
    const persistentAction = vi.fn(); const oldAction = vi.fn(); const nextAction = vi.fn();
    registry.listen(persistent, "click", persistentAction); registry.listen(oldInspector, "click", oldAction, "inspector");
    registry.clearInspector(); registry.listen(nextInspector, "click", nextAction, "inspector");
    oldInspector.dispatchEvent(new Event("click")); persistent.dispatchEvent(new Event("click")); nextInspector.dispatchEvent(new Event("click"));
    expect(oldAction).not.toHaveBeenCalled(); expect(persistentAction).toHaveBeenCalledOnce(); expect(nextAction).toHaveBeenCalledOnce();
    registry.disposeAll(); persistent.dispatchEvent(new Event("click")); nextInspector.dispatchEvent(new Event("click"));
    expect(persistentAction).toHaveBeenCalledOnce(); expect(nextAction).toHaveBeenCalledOnce();
  });
});
