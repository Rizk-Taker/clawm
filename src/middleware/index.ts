import type { Clawm } from '../clawm.js';
import type { BeforeHook, AfterHook, ErrorHook, MiddlewareContext } from '../types.js';

export interface MiddlewareOptions {
  before?: BeforeHook;
  after?: AfterHook;
  onError?: ErrorHook;
}

export interface Middleware {
  wrap<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult>;
}

export function createMiddleware(clawm: Clawm, options: MiddlewareOptions = {}): Middleware {
  return {
    wrap<TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult | Promise<TResult>,
    ): (...args: TArgs) => Promise<TResult> {
      return async (...args: TArgs): Promise<TResult> => {
        // Block if circuit is open
        if (clawm.sos.isOpen()) {
          const error = new Error('Circuit is open — agent needs recovery time');
          error.name = 'CircuitOpenError';
          throw error;
        }

        const startTime = Date.now();
        const ctx: MiddlewareContext = {
          startTime,
          vitals: clawm.pulse(),
        };

        if (options.before) {
          await options.before(ctx);
        }

        try {
          const result = await fn(...args);
          const latency = Date.now() - startTime;

          clawm.recordOperation(true, latency);

          if (options.after) {
            await options.after(ctx, result);
          }

          return result;
        } catch (err) {
          const latency = Date.now() - startTime;
          const error = err instanceof Error ? err : new Error(String(err));

          clawm.recordOperation(false, latency);

          if (options.onError) {
            await options.onError(ctx, error);
          }

          throw err;
        }
      };
    },
  };
}
