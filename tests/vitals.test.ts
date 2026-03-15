import { describe, it, expect, beforeEach } from 'vitest';
import { VitalsAggregator } from '../src/vitals.js';
import { ClawmEmitter } from '../src/events.js';
import { DEFAULT_THRESHOLDS } from '../src/config.js';

describe('VitalsAggregator', () => {
  let vitals: VitalsAggregator;
  let emitter: ClawmEmitter;

  beforeEach(() => {
    emitter = new ClawmEmitter();
    vitals = new VitalsAggregator(DEFAULT_THRESHOLDS, emitter);
  });

  it('starts in thriving state', () => {
    const v = vitals.getVitals();
    expect(v.state).toBe('thriving');
    expect(v.errorRate).toBe(0);
    expect(v.consecutiveErrors).toBe(0);
  });

  it('tracks successful operations', () => {
    vitals.recordOperation(true, 100);
    vitals.recordOperation(true, 200);
    const snap = vitals.getSnapshot();
    expect(snap.totalOperations).toBe(2);
    expect(snap.totalErrors).toBe(0);
    expect(snap.errorRate).toBe(0);
    expect(snap.latency).toBe(150);
  });

  it('tracks failed operations', () => {
    vitals.recordOperation(true, 100);
    vitals.recordOperation(false, 200);
    const snap = vitals.getSnapshot();
    expect(snap.totalOperations).toBe(2);
    expect(snap.totalErrors).toBe(1);
    expect(snap.errorRate).toBe(0.5);
    expect(snap.consecutiveErrors).toBe(1);
  });

  it('resets consecutive errors on success', () => {
    vitals.recordOperation(false, 100);
    vitals.recordOperation(false, 100);
    expect(vitals.getSnapshot().consecutiveErrors).toBe(2);
    vitals.recordOperation(true, 100);
    expect(vitals.getSnapshot().consecutiveErrors).toBe(0);
  });

  it('clamps context usage between 0 and 1', () => {
    vitals.setContextUsage(1.5);
    expect(vitals.getSnapshot().contextUsage).toBe(1);
    vitals.setContextUsage(-0.5);
    expect(vitals.getSnapshot().contextUsage).toBe(0);
  });

  it('determines strained state from error rate', () => {
    // Default strained errorRate threshold is 0.05
    // Need errorRate >= 0.05 but < 0.15
    for (let i = 0; i < 100; i++) {
      vitals.recordOperation(i < 6 ? false : true, 100);
    }
    expect(vitals.getVitals().state).toBe('strained');
  });

  it('determines stressed state from consecutive errors', () => {
    // Default stressed consecutiveErrors threshold is 5
    // Add successes first to keep error rate below critical (0.3)
    for (let i = 0; i < 20; i++) {
      vitals.recordOperation(true, 100);
    }
    for (let i = 0; i < 5; i++) {
      vitals.recordOperation(false, 100);
    }
    // errorRate = 5/25 = 0.2 (stressed range), consecutiveErrors = 5 (stressed)
    expect(vitals.getVitals().state).toBe('stressed');
  });

  it('determines critical state from high context usage', () => {
    vitals.setContextUsage(0.96);
    expect(vitals.getVitals().state).toBe('critical');
  });

  it('emits stateChange event on transition', () => {
    const changes: Array<{ from: string; to: string }> = [];
    emitter.on('stateChange', (e) => changes.push({ from: e.from, to: e.to }));

    vitals.setContextUsage(0.96);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ from: 'thriving', to: 'critical' });
  });

  it('emits operation event', () => {
    const ops: Array<{ success: boolean; latency: number }> = [];
    emitter.on('operation', (e) => ops.push(e));

    vitals.recordOperation(true, 42);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ success: true, latency: 42 });
  });

  it('resets all state', () => {
    vitals.recordOperation(false, 500);
    vitals.setContextUsage(0.8);
    vitals.reset();

    const snap = vitals.getSnapshot();
    expect(snap.totalOperations).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.contextUsage).toBe(0);
    expect(snap.latency).toBe(0);
  });
});
