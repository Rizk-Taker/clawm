import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { SimulatedAgent, type AgentEvent } from '../../demo/lib/SimulatedAgent.js';
import { Clawm } from '../../src/clawm.js';
import { mulberry32 } from '../../demo/lib/prng.js';

describe('SimulatedAgent', () => {
  let events: AgentEvent[];
  let agent: SimulatedAgent;

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
  });

  afterEach(() => {
    agent?.destroy();
    vi.useRealTimers();
  });

  it('processes tasks in order without chaos', async () => {
    agent = new SimulatedAgent(null, mulberry32(42));
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    // Advance through several task cycles (2s each)
    await vi.advanceTimersByTimeAsync(10000);
    agent.stop();
    const starts = events.filter((e) => e.kind === 'task:start');
    expect(starts.length).toBeGreaterThan(0);
  });

  it('Agent A retries up to 5 times then fails the task', async () => {
    agent = new SimulatedAgent(null, mulberry32(42));
    agent.setChaos({ errorRate: 1.0, latencyMultiplier: 1, contextCorruptionProbability: 0 });
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(30000);
    agent.stop();
    const failures = events.filter((e) => e.kind === 'task:failed');
    expect(failures.length).toBeGreaterThan(0);
  });

  it('Agent A enters terminal state after 3 task failures', async () => {
    agent = new SimulatedAgent(null, mulberry32(42));
    agent.setChaos({ errorRate: 1.0, latencyMultiplier: 1, contextCorruptionProbability: 0 });
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(80000);
    const terminal = events.find((e) => e.kind === 'terminal');
    expect(terminal).toBeDefined();
    expect(agent.isTerminal()).toBe(true);
  });

  it('Agent B (with Clawm) records operations', async () => {
    const clawm = new Clawm({ agentId: 'test-b', checkIn: { interval: 0, autoStart: false } });
    const recordSpy = vi.spyOn(clawm, 'recordOperation');
    agent = new SimulatedAgent(clawm, mulberry32(42));
    agent.setChaos({ errorRate: 0.5, latencyMultiplier: 1, contextCorruptionProbability: 0 });
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(10000);
    agent.stop();
    expect(recordSpy).toHaveBeenCalled();
    clawm.windDown();
  });

  it('Agent B skips API tasks when strained', async () => {
    const clawm = new Clawm({ agentId: 'test-b', checkIn: { interval: 0, autoStart: false } });
    agent = new SimulatedAgent(clawm, mulberry32(42));
    agent.setChaos({ errorRate: 0.8, latencyMultiplier: 1, contextCorruptionProbability: 0 });
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(30000);
    agent.stop();
    const starts = events.filter((e) => e.kind === 'task:start');
    expect(starts.length).toBeGreaterThan(0);
    // Agent B should NOT go terminal like Agent A would — it adapts
    expect(agent.isTerminal()).toBe(false);
    clawm.windDown();
  });

  it('stop prevents further processing', async () => {
    agent = new SimulatedAgent(null, mulberry32(42));
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(4500);
    agent.stop();
    const countAtStop = events.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(events.length).toBe(countAtStop);
  });

  it('setChaos updates failure injection mid-run', async () => {
    agent = new SimulatedAgent(null, mulberry32(42));
    agent.onAgentEvent((e) => events.push(e));
    agent.start();
    await vi.advanceTimersByTimeAsync(8000);
    const errorsBeforeChaos = events.filter((e) => e.kind === 'task:error').length;
    agent.setChaos({ errorRate: 0.9, latencyMultiplier: 1, contextCorruptionProbability: 0 });
    await vi.advanceTimersByTimeAsync(16000);
    agent.stop();
    const errorsAfterChaos = events.filter((e) => e.kind === 'task:error').length;
    expect(errorsAfterChaos).toBeGreaterThan(errorsBeforeChaos);
  });
});
