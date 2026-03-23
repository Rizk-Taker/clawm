import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NarrationEngine } from '../../demo/lib/NarrationEngine.js';
import { mulberry32 } from '../../demo/lib/prng.js';
import type { Vitals, WellnessState } from '../../src/types.js';

function makeVitals(overrides: Partial<Vitals> = {}): Vitals {
  return {
    state: 'balanced' as WellnessState,
    errorRate: 0,
    contextUsage: 0,
    latency: 100,
    consecutiveErrors: 0,
    uptime: 1000,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('NarrationEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires narration callback on stateChange', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    const texts: string[] = [];
    engine.onNarrate((text, done) => {
      if (done) texts.push(text);
    });
    engine.handleStateChange({
      from: 'balanced',
      to: 'strained',
      vitals: makeVitals({ state: 'strained' }),
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(texts.length).toBe(1);
    expect(texts[0].length).toBeGreaterThan(10);
  });

  it('produces different narration variants across seeds', async () => {
    const results: string[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      const engine = new NarrationEngine(mulberry32(seed));
      let result = '';
      engine.onNarrate((text, done) => {
        if (done) result = text;
      });
      engine.handleStateChange({
        from: 'balanced',
        to: 'stressed',
        vitals: makeVitals({ state: 'stressed', errorRate: 0.6 }),
      });
      await vi.advanceTimersByTimeAsync(10000);
      results.push(result);
    }
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it('interpolates pulse variables', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    let result = '';
    engine.onNarrate((text, done) => {
      if (done) result = text;
    });
    engine.handlePulse({
      vitals: makeVitals({ errorRate: 0.6, consecutiveErrors: 2 }),
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('{');
  });

  it('uses circles template when consecutiveErrors > 3', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    let result = '';
    engine.onNarrate((text, done) => {
      if (done) result = text;
    });
    engine.handlePulse({
      vitals: makeVitals({ errorRate: 0.7, consecutiveErrors: 5 }),
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.includes('circles') ||
      result.includes('repeating') ||
      result.includes('not making real progress'),
    ).toBe(true);
  });

  it('interpolates trip reason', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    let result = '';
    engine.onNarrate((text, done) => {
      if (done) result = text;
    });
    engine.handleTrip({ reason: 'API timeout storm', module: 'sos' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(result).toContain('API timeout storm');
  });

  it('interpolates reset module', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    let result = '';
    engine.onNarrate((text, done) => {
      if (done) result = text;
    });
    engine.handleReset({ module: 'sos' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(result).toContain('sos');
  });

  it('cancel stops in-progress typing', async () => {
    const engine = new NarrationEngine(mulberry32(42));
    const calls: boolean[] = [];
    engine.onNarrate((_text, done) => {
      calls.push(done);
    });
    engine.handleStateChange({
      from: 'balanced',
      to: 'strained',
      vitals: makeVitals({ state: 'strained' }),
    });
    // Let a couple chars type
    await vi.advanceTimersByTimeAsync(50);
    engine.cancel();
    await vi.advanceTimersByTimeAsync(10000);
    const doneCount = calls.filter(Boolean).length;
    expect(doneCount).toBe(0);
  });
});
