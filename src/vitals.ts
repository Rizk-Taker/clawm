import type { Vitals, VitalsSnapshot, WellnessState, Thresholds } from './types.js';
import { ClawmEmitter } from './events.js';

export class VitalsAggregator {
  private totalOperations = 0;
  private totalErrors = 0;
  private consecutiveErrors = 0;
  private contextUsage = 0;
  private latencySum = 0;
  private latencyCount = 0;
  private startTime = Date.now();
  private lastState: WellnessState = 'thriving';

  constructor(
    private readonly thresholds: Thresholds,
    private readonly emitter: ClawmEmitter,
  ) {}

  recordOperation(success: boolean, latency: number): void {
    this.totalOperations++;
    this.latencySum += latency;
    this.latencyCount++;

    if (success) {
      this.consecutiveErrors = 0;
    } else {
      this.totalErrors++;
      this.consecutiveErrors++;
    }

    this.emitter.emit('operation', { success, latency });
    this.checkStateChange();
  }

  setContextUsage(usage: number): void {
    this.contextUsage = Math.max(0, Math.min(1, usage));
    this.checkStateChange();
  }

  getSnapshot(): VitalsSnapshot {
    return {
      totalOperations: this.totalOperations,
      totalErrors: this.totalErrors,
      errorRate: this.totalOperations > 0 ? this.totalErrors / this.totalOperations : 0,
      contextUsage: this.contextUsage,
      latency: this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0,
      consecutiveErrors: this.consecutiveErrors,
      uptime: Date.now() - this.startTime,
    };
  }

  getVitals(): Vitals {
    const snapshot = this.getSnapshot();
    return {
      state: this.determineState(snapshot),
      errorRate: snapshot.errorRate,
      contextUsage: snapshot.contextUsage,
      latency: snapshot.latency,
      consecutiveErrors: snapshot.consecutiveErrors,
      uptime: snapshot.uptime,
      timestamp: Date.now(),
    };
  }

  determineState(snapshot: VitalsSnapshot): WellnessState {
    const { critical, stressed, strained } = this.thresholds;

    if (
      snapshot.errorRate >= critical.errorRate ||
      snapshot.contextUsage >= critical.contextUsage ||
      snapshot.latency >= critical.latency ||
      snapshot.consecutiveErrors >= critical.consecutiveErrors
    ) {
      return 'critical';
    }

    if (
      snapshot.errorRate >= stressed.errorRate ||
      snapshot.contextUsage >= stressed.contextUsage ||
      snapshot.latency >= stressed.latency ||
      snapshot.consecutiveErrors >= stressed.consecutiveErrors
    ) {
      return 'stressed';
    }

    if (
      snapshot.errorRate >= strained.errorRate ||
      snapshot.contextUsage >= strained.contextUsage ||
      snapshot.latency >= strained.latency ||
      snapshot.consecutiveErrors >= strained.consecutiveErrors
    ) {
      return 'strained';
    }

    if (snapshot.totalOperations === 0) {
      return 'thriving';
    }

    return snapshot.errorRate === 0 && snapshot.contextUsage < 0.3 ? 'thriving' : 'balanced';
  }

  private checkStateChange(): void {
    const vitals = this.getVitals();
    if (vitals.state !== this.lastState) {
      this.emitter.emit('stateChange', {
        from: this.lastState,
        to: vitals.state,
        vitals,
      });
      this.lastState = vitals.state;
    }
  }

  reset(): void {
    this.totalOperations = 0;
    this.totalErrors = 0;
    this.consecutiveErrors = 0;
    this.contextUsage = 0;
    this.latencySum = 0;
    this.latencyCount = 0;
    this.startTime = Date.now();
    this.lastState = 'thriving';
  }
}
