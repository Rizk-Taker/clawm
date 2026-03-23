import type { ClawmEvents, ClawmEventName } from './types.js';

type Listener<T> = (data: T) => void;

/**
 * Browser-native event emitter — replaces node:events dependency.
 * Supports on, once, off, emit, removeAllListeners.
 * Error isolation: listener exceptions are caught and logged,
 * never crash other listeners or the emitter itself.
 */
export class ClawmEmitter {
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private onceWrapped = new WeakMap<Listener<unknown>, Listener<unknown>>();

  on<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
    return this;
  }

  once<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    const wrapped: Listener<ClawmEvents[K]> = (data) => {
      this.off(event, wrapped);
      listener(data);
    };
    this.onceWrapped.set(listener as Listener<unknown>, wrapped as Listener<unknown>);
    this.on(event, wrapped);
    return this;
  }

  off<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    const set = this.listeners.get(event);
    if (!set) return this;
    // Try removing the listener directly
    if (set.delete(listener as Listener<unknown>)) return this;
    // If it was registered via once(), remove the wrapper
    const wrapped = this.onceWrapped.get(listener as Listener<unknown>);
    if (wrapped) {
      set.delete(wrapped);
      this.onceWrapped.delete(listener as Listener<unknown>);
    }
    return this;
  }

  emit<K extends ClawmEventName>(event: K, data: ClawmEvents[K]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of [...set]) {
      try {
        (listener as Listener<ClawmEvents[K]>)(data);
      } catch (err) {
        console.error(`[ClawmEmitter] Error in "${event}" listener:`, err);
      }
    }
    return true;
  }

  removeAllListeners(event?: ClawmEventName): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
