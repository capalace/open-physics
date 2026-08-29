/** Owns listener lifetimes for stable hosts and frequently replaced inspector DOM. */
export class LightEventScopes {
  private readonly lifetime = new AbortController();
  private guide = new AbortController();
  private palette = new AbortController();

  get lifetimeSignal(): AbortSignal { return this.lifetime.signal; }

  nextGuideSignal(): AbortSignal {
    this.guide.abort();
    this.guide = new AbortController();
    return this.guide.signal;
  }

  nextPaletteSignal(): AbortSignal {
    this.palette.abort();
    this.palette = new AbortController();
    return this.palette.signal;
  }

  dispose(): void {
    this.guide.abort();
    this.palette.abort();
    this.lifetime.abort();
  }
}
