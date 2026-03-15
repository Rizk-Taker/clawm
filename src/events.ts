import { EventEmitter } from 'node:events';
import type { ClawmEvents, ClawmEventName } from './types.js';

type Listener<T> = (data: T) => void;

export class ClawmEmitter {
  private emitter = new EventEmitter();

  on<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.on(event, listener);
    return this;
  }

  once<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.once(event, listener);
    return this;
  }

  off<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.off(event, listener);
    return this;
  }

  emit<K extends ClawmEventName>(event: K, data: ClawmEvents[K]): boolean {
    return this.emitter.emit(event, data);
  }

  removeAllListeners(event?: ClawmEventName): this {
    this.emitter.removeAllListeners(event);
    return this;
  }
}
