import type { Module, SOSConfig, CircuitState } from '../types.js';
import type { VitalsAggregator } from '../vitals.js';
import type { ClawmEmitter } from '../events.js';

export class SOSModule implements Module {
  readonly name = 'sos';
  private circuitState: CircuitState = 'closed';
  private consecutiveErrors = 0;
  private halfOpenSuccesses = 0;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private operationListener: ((data: { success: boolean; latency: number }) => void) | null = null;

  constructor(
    private readonly config: SOSConfig,
    private readonly _vitals: VitalsAggregator,
    private readonly emitter: ClawmEmitter,
  ) {}

  get state(): CircuitState {
    return this.circuitState;
  }

  /** Check if operations are allowed through the circuit. */
  isOpen(): boolean {
    return this.circuitState === 'open';
  }

  /** Record a successful operation. */
  recordSuccess(): void {
    this.consecutiveErrors = 0;

    if (this.circuitState === 'half-open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccesses) {
        this.close();
      }
    }
  }

  /** Record a failed operation. */
  recordFailure(error?: Error): void {
    this.consecutiveErrors++;
    this.halfOpenSuccesses = 0;

    if (this.consecutiveErrors >= this.config.tripAfter && this.circuitState !== 'open') {
      this.trip(error?.message ?? `${this.consecutiveErrors} consecutive errors`);
    }
  }

  /** Manually trip the circuit breaker — a safety pull, not a kill switch. */
  trip(reason: string): void {
    this.circuitState = 'open';
    this.emitter.emit('trip', { reason, module: this.name });

    this.clearCooldownTimer();
    this.cooldownTimer = setTimeout(() => {
      this.halfOpen();
    }, this.config.cooldownMs);
    if (this.cooldownTimer.unref) this.cooldownTimer.unref();
  }

  /** Manually reset the circuit breaker. */
  close(): void {
    this.circuitState = 'closed';
    this.consecutiveErrors = 0;
    this.halfOpenSuccesses = 0;
    this.clearCooldownTimer();
    this.emitter.emit('reset', { module: this.name });
  }

  private halfOpen(): void {
    this.circuitState = 'half-open';
    this.halfOpenSuccesses = 0;
    this.emitter.emit('halfOpen', { module: this.name });
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  start(): void {
    // Listen to operation events for auto-trip
    this.operationListener = ({ success }) => {
      if (success) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }
    };
    this.emitter.on('operation', this.operationListener);
  }

  stop(): void {
    if (this.operationListener) {
      this.emitter.off('operation', this.operationListener);
      this.operationListener = null;
    }
    this.clearCooldownTimer();
  }

  destroy(): void {
    this.stop();
  }
}
