import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BreatheModule } from '../../src/modules/breathe.js';
import { VitalsAggregator } from '../../src/vitals.js';
import { ClawmEmitter } from '../../src/events.js';
import { DEFAULT_THRESHOLDS } from '../../src/config.js';

describe('BreatheModule', () => {
  let breathe: BreatheModule;
  let vitals: VitalsAggregator;
  let emitter: ClawmEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    emitter = new ClawmEmitter();
    vitals = new VitalsAggregator(DEFAULT_THRESHOLDS, emitter);
    breathe = new BreatheModule(
      { defaultCooldownMs: 5000, contextWarningThreshold: 0.7 },
      vitals,
      emitter,
    );
  });

  afterEach(() => {
    breathe?.destroy();
    vi.useRealTimers();
  });

  it('cooldown() resolves after duration', async () => {
    let resolved = false;
    const p = breathe.cooldown(100).then(() => { resolved = true; });

    expect(resolved).toBe(false);
    vi.advanceTimersByTime(100);
    await p;
    expect(resolved).toBe(true);
  });

  it('cooldown() uses default duration if not specified', async () => {
    let resolved = false;
    const p = breathe.cooldown().then(() => { resolved = true; });

    vi.advanceTimersByTime(4999);
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await p;
    expect(resolved).toBe(true);
  });

  it('cooldown() emits cooldown and cooldownEnd events', async () => {
    const cooldowns: any[] = [];
    const cooldownEnds: any[] = [];
    emitter.on('cooldown', (e) => cooldowns.push(e));
    emitter.on('cooldownEnd', (e) => cooldownEnds.push(e));

    const p = breathe.cooldown(200);
    expect(cooldowns).toHaveLength(1);
    expect(cooldowns[0].duration).toBe(200);

    vi.advanceTimersByTime(200);
    await p;

    expect(cooldownEnds).toHaveLength(1);
    expect(cooldownEnds[0].duration).toBe(200);
  });

  it('setContextUsage() updates vitals', () => {
    breathe.setContextUsage(0.5);
    expect(breathe.contextUsage()).toBe(0.5);
  });

  it('contextUsage() returns current usage', () => {
    expect(breathe.contextUsage()).toBe(0);
    breathe.setContextUsage(0.42);
    expect(breathe.contextUsage()).toBe(0.42);
  });

  it('stop() clears active cooldowns', () => {
    breathe.cooldown(10000); // start a long cooldown
    breathe.stop(); // should clear it
    // No assertion needed — just verifying it doesn't throw or hang
  });
});
