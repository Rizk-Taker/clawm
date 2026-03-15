import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SOSModule } from '../../src/modules/sos.js';
import { VitalsAggregator } from '../../src/vitals.js';
import { ClawmEmitter } from '../../src/events.js';
import { DEFAULT_THRESHOLDS } from '../../src/config.js';

describe('SOSModule', () => {
  let sos: SOSModule;
  let vitals: VitalsAggregator;
  let emitter: ClawmEmitter;

  beforeEach(() => {
    emitter = new ClawmEmitter();
    vitals = new VitalsAggregator(DEFAULT_THRESHOLDS, emitter);
    sos = new SOSModule(
      { tripAfter: 3, cooldownMs: 1000, halfOpenSuccesses: 2 },
      vitals,
      emitter,
    );
  });

  afterEach(() => {
    sos?.destroy();
    vi.useRealTimers();
  });

  it('starts in closed state', () => {
    expect(sos.state).toBe('closed');
    expect(sos.isOpen()).toBe(false);
  });

  it('trips after consecutive errors', () => {
    const trips: any[] = [];
    emitter.on('trip', (e) => trips.push(e));

    sos.recordFailure();
    sos.recordFailure();
    expect(sos.state).toBe('closed');

    sos.recordFailure(); // 3rd error = trip
    expect(sos.state).toBe('open');
    expect(sos.isOpen()).toBe(true);
    expect(trips).toHaveLength(1);
  });

  it('success resets consecutive error count', () => {
    sos.recordFailure();
    sos.recordFailure();
    sos.recordSuccess(); // resets counter
    sos.recordFailure();
    expect(sos.state).toBe('closed');
  });

  it('manual trip() works', () => {
    vi.useFakeTimers();
    sos.trip('manual intervention');
    expect(sos.state).toBe('open');
    vi.useRealTimers();
  });

  it('transitions to half-open after cooldown', () => {
    vi.useFakeTimers();
    const halfOpens: any[] = [];
    emitter.on('halfOpen', (e) => halfOpens.push(e));

    sos.trip('test');
    vi.advanceTimersByTime(1000);

    expect(sos.state).toBe('half-open');
    expect(halfOpens).toHaveLength(1);
  });

  it('closes after enough successes in half-open', () => {
    vi.useFakeTimers();
    const resets: any[] = [];
    emitter.on('reset', (e) => resets.push(e));

    sos.trip('test');
    vi.advanceTimersByTime(1000); // -> half-open

    sos.recordSuccess();
    expect(sos.state).toBe('half-open');
    sos.recordSuccess(); // 2nd success -> closed
    expect(sos.state).toBe('closed');
    expect(resets).toHaveLength(1);
  });

  it('failure in half-open re-trips', () => {
    vi.useFakeTimers();
    sos.trip('test');
    vi.advanceTimersByTime(1000); // -> half-open

    // Need tripAfter consecutive failures to trip again
    for (let i = 0; i < 3; i++) {
      sos.recordFailure();
    }
    expect(sos.state).toBe('open');
  });

  it('close() manually resets', () => {
    vi.useFakeTimers();
    sos.trip('test');
    sos.close();
    expect(sos.state).toBe('closed');
    expect(sos.isOpen()).toBe(false);
  });

  it('auto-trips from operation events when started', () => {
    vi.useFakeTimers();
    sos.start();

    emitter.emit('operation', { success: false, latency: 100 });
    emitter.emit('operation', { success: false, latency: 100 });
    emitter.emit('operation', { success: false, latency: 100 });

    expect(sos.state).toBe('open');
  });

  it('stop() removes event listener', () => {
    sos.start();
    sos.stop();

    emitter.emit('operation', { success: false, latency: 100 });
    emitter.emit('operation', { success: false, latency: 100 });
    emitter.emit('operation', { success: false, latency: 100 });

    expect(sos.state).toBe('closed');
  });
});
