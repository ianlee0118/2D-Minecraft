/**
 * Lightweight game logger. Logs errors and optionally memory stats.
 * Set window.DEBUG_GAME = true in console to enable verbose logs.
 */
const LOG_PREFIX = '[2D MC]';

export const gameLogger = {
  enabled: typeof window !== 'undefined' && !!window.DEBUG_GAME,

  log(...args) {
    if (this.enabled) console.log(LOG_PREFIX, ...args);
  },

  warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  },

  error(...args) {
    console.error(LOG_PREFIX, ...args);
    this._lastError = { msg: args.join(' '), time: Date.now() };
  },

  _lastError: null,

  getMemoryInfo() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const m = performance.memory;
      return {
        used: Math.round(m.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(m.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(m.jsHeapSizeLimit / 1024 / 1024) + ' MB',
      };
    }
    return null;
  },

  logMemory() {
    const mem = this.getMemoryInfo();
    if (mem) this.log('Memory:', mem);
    return mem;
  },
};

export function wrapUpdate(sceneName, fn) {
  return function (...args) {
    try {
      return fn.apply(this, args);
    } catch (err) {
      gameLogger.error(`[${sceneName}] update error (recovered):`, err);
      gameLogger.logMemory();
    }
  };
}
