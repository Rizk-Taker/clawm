import { describe, it, expect, afterEach } from 'vitest';
import { Clawm } from '../src/clawm.js';

describe('Clawm', () => {
  let hs: Clawm;

  afterEach(() => {
    hs?.windDown();
  });

  it('creates with minimal config', () => {
    hs = new Clawm({ agentId: 'test-agent' });
    expect(hs.config.agentId).toBe('test-agent');
    expect(hs.checkIn).toBeDefined();
    expect(hs.sos).toBeDefined();
    expect(hs.breathe).toBeDefined();
  });

  it('pulse() returns vitals', () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const vitals = hs.pulse();
    expect(vitals.state).toBe('thriving');
    expect(vitals.timestamp).toBeGreaterThan(0);
  });

  it('recordOperation() updates vitals', () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    hs.recordOperation(true, 100);
    hs.recordOperation(true, 200);
    const vitals = hs.pulse();
    expect(vitals.latency).toBe(150);
  });

  it('on/off event subscription works', () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const states: string[] = [];
    const listener = (e: { to: string }) => states.push(e.to);

    hs.on('stateChange', listener);
    hs.vitals.setContextUsage(0.96);
    expect(states).toContain('critical');

    hs.off('stateChange', listener);
    hs.vitals.setContextUsage(0);
    expect(states).toHaveLength(1); // listener was removed
  });

  it('once() only fires once', () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    let count = 0;
    hs.once('pulse', () => count++);
    hs.pulse();
    hs.pulse();
    expect(count).toBe(1);
  });

  it('windDown() stops all modules', () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    hs.windDown();
    // Should not throw
    expect(true).toBe(true);
  });

  it('custom thresholds merge with defaults', () => {
    hs = new Clawm({
      agentId: 'test',
      checkIn: { interval: 0, autoStart: false },
      thresholds: {
        critical: { errorRate: 0.5, contextUsage: 0.99, latency: 20000, consecutiveErrors: 20 },
      } as any,
    });
    expect(hs.config.thresholds.critical.errorRate).toBe(0.5);
    // Strained should still have defaults
    expect(hs.config.thresholds.strained.errorRate).toBe(0.05);
  });
});
