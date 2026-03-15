import type { ClawmConfig, ClawmEvents, ClawmEventName, Vitals } from './types.js';
import { ClawmEmitter } from './events.js';
import { VitalsAggregator } from './vitals.js';
import { defineConfig } from './config.js';
import { CheckInModule } from './modules/check-in.js';
import { SOSModule } from './modules/sos.js';
import { BreatheModule } from './modules/breathe.js';

type Listener<T> = (data: T) => void;

export class Clawm {
  readonly config: ClawmConfig;
  readonly emitter: ClawmEmitter;
  readonly vitals: VitalsAggregator;
  readonly checkIn: CheckInModule;
  readonly sos: SOSModule;
  readonly breathe: BreatheModule;

  constructor(config: Partial<ClawmConfig> & { agentId: string }) {
    this.config = defineConfig(config);
    this.emitter = new ClawmEmitter();
    this.vitals = new VitalsAggregator(this.config.thresholds, this.emitter);

    this.checkIn = new CheckInModule(this.config.checkIn, this.vitals, this.emitter);
    this.sos = new SOSModule(this.config.sos, this.vitals, this.emitter);
    this.breathe = new BreatheModule(this.config.breathe, this.vitals, this.emitter);

    // Start modules
    this.sos.start();
    if (this.config.checkIn.autoStart) {
      this.checkIn.start();
    }
    this.breathe.start();
  }

  /** Take a pulse. */
  pulse(): Vitals {
    return this.checkIn.pulse();
  }

  /** Record an operation result. */
  recordOperation(success: boolean, latency: number): void {
    this.vitals.recordOperation(success, latency);
  }

  /** Subscribe to wellness events. */
  on<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.on(event, listener);
    return this;
  }

  /** Subscribe to a wellness event once. */
  once<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.once(event, listener);
    return this;
  }

  /** Unsubscribe from a wellness event. */
  off<K extends ClawmEventName>(event: K, listener: Listener<ClawmEvents[K]>): this {
    this.emitter.off(event, listener);
    return this;
  }

  /** Wind down — graceful shutdown. */
  windDown(): void {
    this.checkIn.destroy();
    this.sos.destroy();
    this.breathe.destroy();
    this.emitter.removeAllListeners();
  }
}
