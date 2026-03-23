import { describe, it, expect, vi } from 'vitest';
import { ClawmEmitter } from '../src/events.js';

describe('ClawmEmitter (browser-native)', () => {
  it('fires listeners on emit', () => {
    const emitter = new ClawmEmitter();
    const fn = vi.fn();
    emitter.on('pulse', fn);
    emitter.emit('pulse', { vitals: {} as any });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('returns false when no listeners exist', () => {
    const emitter = new ClawmEmitter();
    expect(emitter.emit('pulse', { vitals: {} as any })).toBe(false);
  });

  it('returns true when listeners exist', () => {
    const emitter = new ClawmEmitter();
    emitter.on('pulse', () => {});
    expect(emitter.emit('pulse', { vitals: {} as any })).toBe(true);
  });

  it('once listener fires only once', () => {
    const emitter = new ClawmEmitter();
    const fn = vi.fn();
    emitter.once('trip', fn);
    emitter.emit('trip', { reason: 'test', module: 'sos' });
    emitter.emit('trip', { reason: 'test', module: 'sos' });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('off removes a listener', () => {
    const emitter = new ClawmEmitter();
    const fn = vi.fn();
    emitter.on('pulse', fn);
    emitter.off('pulse', fn);
    emitter.emit('pulse', { vitals: {} as any });
    expect(fn).not.toHaveBeenCalled();
  });

  it('off removes a once-registered listener by original ref', () => {
    const emitter = new ClawmEmitter();
    const fn = vi.fn();
    emitter.once('trip', fn);
    emitter.off('trip', fn);
    emitter.emit('trip', { reason: 'test', module: 'sos' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears specific event', () => {
    const emitter = new ClawmEmitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on('pulse', fn1);
    emitter.on('trip', fn2);
    emitter.removeAllListeners('pulse');
    emitter.emit('pulse', { vitals: {} as any });
    emitter.emit('trip', { reason: 'test', module: 'sos' });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('removeAllListeners with no arg clears all events', () => {
    const emitter = new ClawmEmitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on('pulse', fn1);
    emitter.on('trip', fn2);
    emitter.removeAllListeners();
    emitter.emit('pulse', { vitals: {} as any });
    emitter.emit('trip', { reason: 'test', module: 'sos' });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('emit isolates listener errors', () => {
    const emitter = new ClawmEmitter();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn1 = vi.fn(() => { throw new Error('boom'); });
    const fn2 = vi.fn();
    emitter.on('pulse', fn1);
    emitter.on('pulse', fn2);
    emitter.emit('pulse', { vitals: {} as any });
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled(); // fn2 still fires despite fn1 throwing
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});
