import { describe, it, expect, afterEach, vi } from 'vitest';
import { Clawm } from '../../src/clawm.js';
import { createMiddleware } from '../../src/middleware/index.js';

describe('createMiddleware', () => {
  let hs: Clawm;

  afterEach(() => {
    hs?.windDown();
    vi.useRealTimers();
  });

  it('wraps a sync function', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const mw = createMiddleware(hs);
    const add = (a: number, b: number) => a + b;
    const wrapped = mw.wrap(add);

    const result = await wrapped(2, 3);
    expect(result).toBe(5);
  });

  it('wraps an async function', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const mw = createMiddleware(hs);
    const asyncAdd = async (a: number, b: number) => a + b;
    const wrapped = mw.wrap(asyncAdd);

    const result = await wrapped(2, 3);
    expect(result).toBe(5);
  });

  it('records successful operations', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const mw = createMiddleware(hs);
    const fn = () => 'ok';
    const wrapped = mw.wrap(fn);

    await wrapped();
    const vitals = hs.pulse();
    expect(vitals.errorRate).toBe(0);
  });

  it('records failed operations', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const mw = createMiddleware(hs);
    const fn = () => { throw new Error('boom'); };
    const wrapped = mw.wrap(fn);

    await expect(wrapped()).rejects.toThrow('boom');
    const vitals = hs.pulse();
    expect(vitals.errorRate).toBe(1);
  });

  it('blocks when circuit is open', async () => {
    vi.useFakeTimers();
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    const mw = createMiddleware(hs);

    hs.sos.trip('test');
    const wrapped = mw.wrap(() => 'ok');

    await expect(wrapped()).rejects.toThrow('Circuit is open');
    vi.useRealTimers();
  });

  it('calls before hook', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    let beforeCalled = false;
    const mw = createMiddleware(hs, {
      before: () => { beforeCalled = true; },
    });

    const wrapped = mw.wrap(() => 'ok');
    await wrapped();
    expect(beforeCalled).toBe(true);
  });

  it('calls after hook with result', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    let afterResult: unknown;
    const mw = createMiddleware(hs, {
      after: (_ctx, result) => { afterResult = result; },
    });

    const wrapped = mw.wrap(() => 42);
    await wrapped();
    expect(afterResult).toBe(42);
  });

  it('calls onError hook on failure', async () => {
    hs = new Clawm({ agentId: 'test', checkIn: { interval: 0, autoStart: false } });
    let errorMsg: string | undefined;
    const mw = createMiddleware(hs, {
      onError: (_ctx, err) => { errorMsg = err.message; },
    });

    const wrapped = mw.wrap(() => { throw new Error('oops'); });
    await expect(wrapped()).rejects.toThrow('oops');
    expect(errorMsg).toBe('oops');
  });
});
