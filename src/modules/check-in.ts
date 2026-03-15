import type { Module, CheckInConfig, Vitals } from '../types.js';
import type { VitalsAggregator } from '../vitals.js';
import type { ClawmEmitter } from '../events.js';

export class CheckInModule implements Module {
  readonly name = 'check-in';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: CheckInConfig,
    private readonly vitals: VitalsAggregator,
    private readonly emitter: ClawmEmitter,
  ) {}

  /** Take a pulse — a gentle check-in, not an interrogation. */
  pulse(): Vitals {
    const vitals = this.vitals.getVitals();
    this.emitter.emit('pulse', { vitals });
    return vitals;
  }

  /** Start automatic check-ins at the configured interval. */
  start(): void {
    if (this.timer) return;
    if (this.config.interval <= 0) return;
    this.timer = setInterval(() => this.pulse(), this.config.interval);
    // Prevent the timer from keeping the process alive
    if (this.timer.unref) this.timer.unref();
  }

  /** Stop automatic check-ins. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
  }
}
