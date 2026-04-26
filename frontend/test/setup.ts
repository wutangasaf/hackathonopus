import "@testing-library/jest-dom/vitest";

// Polyfills for jsdom + framer-motion. `whileInView` (used heavily on the
// Landing page) needs IntersectionObserver; the responsive / motion bits
// query matchMedia. Both are absent from jsdom by default.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
}
// @ts-expect-error jsdom has no IntersectionObserver
globalThis.IntersectionObserver = IO;

if (!("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
