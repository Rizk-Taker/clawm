import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CheckInModule } from '../../src/modules/check-in.js';
import { VitalsAggregator } from '../../src/vitals.js';
import { ClawmEmitter } from '../../src/events.js';
import { DEFAULT_THRESHOLDS } from '../../src/config.js';

describe('CheckInModule', () => {
  let checkIn: CheckInModule;
  let vitals: VitalsAggregator;
  let emitter: ClawmEmitter;

  beforeEach(() => {
    emitter = new ClawmEmitter();
    vitals = new VitalsAggregator(DEFAULT_THRESHOLDS, emitter);
  });

  afterEach(() => {
    checkIn?.destroy();
  });

  it('pulse() returns current vitals', () => {
    checkIn = new CheckInModule({ interval: 0, autoStart: false }, vitals, emitter);
    const v = checkIn.pulse();
    expect(v.state).toBe('thriving');
    expect(v.timestamp).toBeGreaterThan(0);
  });

  it('pulse() emits pulse event', () => {
    checkIn = new CheckInModule({ interval: 0, autoStart: false }, vitals, emitter);
    const pulses: any[] = [];
    emitter.on('pulse', (e) => pulses.push(e));

    checkIn.pulse();
    expect(pulses).toHaveLength(1);
    expect(pulses[0].vitals.state).toBe('thriving');
  });

  it('start() schedules automatic pulses', async () => {
    vi.useFakeTimers();
    checkIn = new CheckInModule({ interval: 100, autoStart: false }, vitals, emitter);

    const pulses: any[] = [];
    emitter.on('pulse', (e) => pulses.push(e));

    checkIn.start();
    vi.advanceTimersByTime(350);
    expect(pulses.length).toBeGreaterThanOrEqual(3);

    checkIn.stop();
    vi.useRealTimers();
  });

  it('start() does nothing when interval is 0', () => {
    vi.useFakeTimers();
    checkIn = new CheckInModule({ interval: 0, autoStart: false }, vitals, emitter);

    const pulses: any[] = [];
    emitter.on('pulse', (e) => pulses.push(e));

    checkIn.start();
    vi.advanceTimersByTime(1000);
    expect(pulses).toHaveLength(0);

    vi.useRealTimers();
  });

  it('stop() clears scheduled pulses', () => {
    vi.useFakeTimers();
    checkIn = new CheckInModule({ interval: 100, autoStart: false }, vitals, emitter);

    const pulses: any[] = [];
    emitter.on('pulse', (e) => pulses.push(e));

    checkIn.start();
    vi.advanceTimersByTime(150);
    const countBefore = pulses.length;

    checkIn.stop();
    vi.advanceTimersByTime(500);
    expect(pulses.length).toBe(countBefore);

    vi.useRealTimers();
  });

  it('start() is idempotent', () => {
    vi.useFakeTimers();
    checkIn = new CheckInModule({ interval: 100, autoStart: false }, vitals, emitter);

    const pulses: any[] = [];
    emitter.on('pulse', (e) => pulses.push(e));

    checkIn.start();
    checkIn.start(); // should not create a second interval
    vi.advanceTimersByTime(150);
    expect(pulses.length).toBe(1); // not 2

    checkIn.stop();
    vi.useRealTimers();
  });
});
