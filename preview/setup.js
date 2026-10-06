/* Minimal browser polyfills react-native-web expects inside jsdom. */
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

/* React Native's dev flag — the app's screens read it directly. */
if (typeof global.__DEV__ === 'undefined') {
  global.__DEV__ = true;
}
