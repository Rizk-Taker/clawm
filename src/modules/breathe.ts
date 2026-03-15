import type { Module, BreatheConfig } from '../types.js';
import type { VitalsAggregator } from '../vitals.js';
import type { ClawmEmitter } from '../events.js';

export class BreatheModule implements Module {
  readonly name = 'breathe';
  private activeCooldowns = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly config: BreatheConfig,
    private readonly vitals: VitalsAggregator,
    private readonly emitter: ClawmEmitter,
  ) {}

  /** Take a breather — pause between tasks to prevent burnout. */
  cooldown(durationMs?: number): Promise<void> {
    const duration = durationMs ?? this.config.defaultCooldownMs;

    this.emitter.emit('cooldown', { duration });

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.activeCooldowns.delete(timer);
        this.emitter.emit('cooldownEnd', { duration });
        resolve();
      }, duration);

      this.activeCooldowns.add(timer);
    });
  }

  /** Report how much context the agent has consumed (0-1). */
  setContextUsage(usage: number): void {
    // VitalsAggregator handles state change detection and emission
    this.vitals.setContextUsage(usage);
  }

  /** Get current context usage. */
  contextUsage(): number {
    return this.vitals.getSnapshot().contextUsage;
  }

  start(): void {
    // Breathe module is passive — no scheduled work
  }

  stop(): void {
    for (const timer of this.activeCooldowns) {
      clearTimeout(timer);
    }
    this.activeCooldowns.clear();
  }

  destroy(): void {
    this.stop();
  }
}
