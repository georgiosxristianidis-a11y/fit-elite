/**
 * bus.js
 * Minimal event bus — pub/sub across components.
 * No dependencies.
 *
 * Usage:
 *   import { bus } from './bus.js';
 *   bus.on('session:tick', handler);
 *   bus.emit('session:tick', { elapsed_sec: 42 });
 *   bus.off('session:tick', handler);
 */

class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, payload = {}) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(payload); }
      catch (e) { console.error(`[bus] ${event}`, e); }
    });
  }

  once(event, fn) {
    const wrapper = payload => { fn(payload); this.off(event, wrapper); };
    this.on(event, wrapper);
  }
}

export const bus = new EventBus();
export default bus;
