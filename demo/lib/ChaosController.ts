export type ChaosMode = 'api-failures' | 'corrupt-context' | 'slow-responses' | 'overload';

export interface ChaosState {
  errorRate: number;
  latencyMultiplier: number;
  contextCorruptionProbability: number;
}

const CHAOS_EFFECTS: Record<ChaosMode, Partial<ChaosState>> = {
  'api-failures': { errorRate: 0.7 },
  'corrupt-context': { contextCorruptionProbability: 0.5 },
  'slow-responses': { latencyMultiplier: 4 },
  'overload': { errorRate: 0.4, latencyMultiplier: 2, contextCorruptionProbability: 0.3 },
};

const DEBOUNCE_MS = 300;

export class ChaosController {
  private activeModes = new Set<ChaosMode>();
  private lastToggleTime = 0;
  private onChange: ((state: ChaosState) => void) | null = null;

  onStateChange(cb: (state: ChaosState) => void): void {
    this.onChange = cb;
  }

  toggle(mode: ChaosMode): boolean {
    const now = Date.now();
    if (now - this.lastToggleTime < DEBOUNCE_MS) return this.activeModes.has(mode);
    this.lastToggleTime = now;

    if (this.activeModes.has(mode)) {
      this.activeModes.delete(mode);
    } else {
      this.activeModes.add(mode);
    }
    this.notify();
    return this.activeModes.has(mode);
  }

  isActive(mode: ChaosMode): boolean {
    return this.activeModes.has(mode);
  }

  getState(): ChaosState {
    const state: ChaosState = { errorRate: 0, latencyMultiplier: 1, contextCorruptionProbability: 0 };
    for (const mode of this.activeModes) {
      const effect = CHAOS_EFFECTS[mode];
      state.errorRate = Math.min(1, state.errorRate + (effect.errorRate ?? 0));
      state.latencyMultiplier = Math.max(state.latencyMultiplier, effect.latencyMultiplier ?? 1);
      state.contextCorruptionProbability = Math.min(
        1,
        state.contextCorruptionProbability + (effect.contextCorruptionProbability ?? 0),
      );
    }
    return state;
  }

  reset(): void {
    this.activeModes.clear();
    this.notify();
  }

  private notify(): void {
    this.onChange?.(this.getState());
  }
}
