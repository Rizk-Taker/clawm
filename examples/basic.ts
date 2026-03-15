import { Clawm, createMiddleware } from '../src/index.js';

async function main() {
  // Create a Clawm instance for your agent
  const hs = new Clawm({
    agentId: 'demo-agent',
    checkIn: { interval: 0, autoStart: false }, // manual pulses for this demo
  });

  // Listen for state changes
  hs.on('stateChange', ({ from, to, vitals }) => {
    console.log(`  State: ${from} → ${to} (errorRate: ${vitals.errorRate.toFixed(2)}, ctx: ${vitals.contextUsage.toFixed(2)})`);
  });

  // Listen for circuit breaker events
  hs.on('trip', ({ reason }) => {
    console.log(`  Circuit tripped: ${reason}`);
  });

  hs.on('reset', () => {
    console.log(`  Circuit reset — back to normal`);
  });

  // ─── Demo: Basic Pulse ──────────────────────────────────────
  console.log('\n--- Pulse Check ---');
  const vitals = hs.pulse();
  console.log(`  State: ${vitals.state}`);
  console.log(`  Error rate: ${vitals.errorRate}`);
  console.log(`  Context: ${vitals.contextUsage}`);

  // ─── Demo: Simulating Operations ────────────────────────────
  console.log('\n--- Simulating Operations ---');

  // Some successful operations
  for (let i = 0; i < 10; i++) {
    hs.recordOperation(true, 100 + Math.random() * 200);
  }
  console.log(`  After 10 successes: ${hs.pulse().state}`);

  // ─── Demo: Context Usage ────────────────────────────────────
  console.log('\n--- Context Usage ---');
  hs.breathe.setContextUsage(0.42);
  console.log(`  Context at 42%: ${hs.pulse().state}`);

  hs.breathe.setContextUsage(0.85);
  console.log(`  Context at 85%: ${hs.pulse().state}`);

  // ─── Demo: Cooldown ─────────────────────────────────────────
  console.log('\n--- Cooldown ---');
  console.log('  Taking a 100ms breather...');
  await hs.breathe.cooldown(100);
  console.log('  Feeling refreshed!');

  // ─── Demo: Circuit Breaker ──────────────────────────────────
  console.log('\n--- Circuit Breaker ---');
  console.log(`  Circuit state: ${hs.sos.state}`);

  // Simulate a cascade of errors
  for (let i = 0; i < 5; i++) {
    hs.recordOperation(false, 5000);
  }
  console.log(`  After 5 errors: circuit is ${hs.sos.state}`);

  // Reset manually
  hs.sos.close();
  console.log(`  After manual reset: circuit is ${hs.sos.state}`);

  // ─── Demo: Middleware ───────────────────────────────────────
  console.log('\n--- Middleware ---');
  const mw = createMiddleware(hs);

  const riskyOperation = async (x: number) => {
    if (x > 5) throw new Error('too big!');
    return x * 2;
  };

  const safeOperation = mw.wrap(riskyOperation);

  try {
    const result = await safeOperation(3);
    console.log(`  safeOperation(3) = ${result}`);
  } catch {
    // won't happen
  }

  try {
    await safeOperation(10);
  } catch (e) {
    console.log(`  safeOperation(10) caught: ${(e as Error).message}`);
  }

  // Final state
  console.log('\n--- Final State ---');
  const final = hs.pulse();
  console.log(`  State: ${final.state}`);
  console.log(`  Error rate: ${final.errorRate.toFixed(3)}`);
  console.log(`  Uptime: ${final.uptime}ms`);

  // Clean up
  hs.windDown();
  console.log('\n  Agent wound down. Namaste.\n');
}

main().catch(console.error);
