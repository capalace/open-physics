import { describe, expect, it } from "vitest";
// Node types are intentionally absent from the browser app; Vitest still runs this file in Node.
// @ts-expect-error -- node:fs is available in the test runtime.
import { readFileSync } from "node:fs";

const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("progressive web app shell", () => {
  it("publishes favicon, install metadata, and mobile theme colors", () => {
    expect(markup).toContain('rel="icon" href="./favicon.svg"');
    expect(markup).toContain('rel="apple-touch-icon" href="./icons/apple-touch-icon.png"');
    expect(markup).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(markup).toContain('name="theme-color" content="#1d2940"');
    expect(markup).toContain('id="pwa-install"');
  });

  it("provides installable manifest icons and standalone launch settings", () => {
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      const bytes = readFileSync(new URL(`../../public/icons/${icon}`, import.meta.url));
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });

  it("registers a base-aware service worker and exposes the native install prompt", () => {
    expect(bootstrap).toContain('window.addEventListener("beforeinstallprompt"');
    expect(bootstrap).toContain("promptEvent.prompt()");
    expect(bootstrap).toContain('navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`');
    expect(serviceWorker).toContain('new URL("./", self.location.href)');
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker).toContain("caches.open(CACHE_NAME)");
  });
});
