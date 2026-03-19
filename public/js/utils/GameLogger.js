/**
 * Lightweight game logger. Always prints info/warn/error to console.
 * Set window.DEBUG_GAME = true in console to enable verbose (debug-level) logs.
 */
const LOG_PREFIX = '[2D MC]';

export const gameLogger = {
  get enabled() {
    return typeof window !== 'undefined' && !!window.DEBUG_GAME;
  },

  info(...args) {
    console.log(LOG_PREFIX, ...args);
  },

  log(...args) {
    if (this.enabled) console.log(LOG_PREFIX, '[DBG]', ...args);
  },

  warn(...args) {
    console.warn(LOG_PREFIX, '[WARN]', ...args);
  },

  error(...args) {
    console.error(LOG_PREFIX, '[ERR]', ...args);
    this._lastError = { msg: args.join(' '), time: Date.now() };
  },

  scene(sceneName, event, ...extra) {
    console.log(LOG_PREFIX, `[${sceneName}]`, event, ...extra);
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
    if (mem) this.info('Memory:', mem);
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
