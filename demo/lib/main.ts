import { Clawm } from '../../src/index.js';
import { SimulatedAgent } from './SimulatedAgent.js';
import { NarrationEngine } from './NarrationEngine.js';
import { ChaosController, type ChaosMode } from './ChaosController.js';
import { UIRenderer } from './UIRenderer.js';
import { mulberry32 } from './prng.js';

const CHAOS_MODES: ChaosMode[] = ['api-failures', 'corrupt-context', 'slow-responses', 'overload'];
const AUTO_START_DELAY = 2000;

function getSeedFromURL(): number {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  return seed ? parseInt(seed, 10) : Date.now();
}

function getInitialChaosFromURL(): ChaosMode | null {
  const params = new URLSearchParams(window.location.search);
  const chaos = params.get('chaos');
  if (chaos && CHAOS_MODES.includes(chaos as ChaosMode)) return chaos as ChaosMode;
  return null;
}

function init(): void {
  const seed = getSeedFromURL();
  const rand = mulberry32(seed);

  const ui = new UIRenderer();
  const chaos = new ChaosController();

  let agentA: SimulatedAgent;
  let agentB: SimulatedAgent;
  let narration: NarrationEngine;
  let clawmInstance: Clawm;

  function createAgents(): void {
    // Agent A: no Clawm
    agentA = new SimulatedAgent(null, rand);

    // Agent B: with Clawm
    clawmInstance = new Clawm({
      agentId: 'mirror-experiment-b',
      checkIn: { interval: 0, autoStart: false },
    });
    agentB = new SimulatedAgent(clawmInstance, rand);

    // Narration engine for Agent B
    narration = new NarrationEngine(rand);
    narration.onNarrate((text, done) => ui.updateNarration(text, done));

    // Wire Clawm events to narration
    clawmInstance.on('stateChange', (data) => {
      narration.handleStateChange(data);
      ui.updateSpectrum('b', data.to);
    });
    clawmInstance.on('pulse', (data) => narration.handlePulse(data));
    clawmInstance.on('trip', (data) => narration.handleTrip(data));
    clawmInstance.on('cooldown', (data) => narration.handleCooldown(data));
    clawmInstance.on('cooldownEnd', (data) => narration.handleCooldownEnd(data));
    clawmInstance.on('reset', (data) => narration.handleReset(data));

    // Wire agent events to UI
    agentA.onAgentEvent(ui.bindAgent('a', () => agentA.getElapsedSeconds()));
    agentB.onAgentEvent(ui.bindAgent('b', () => agentB.getElapsedSeconds()));

    // Agent A tracks its own approximate state via error counting
    let agentAErrors = 0;
    let agentAOps = 0;
    agentA.onAgentEvent((event) => {
      if (event.kind === 'task:complete') {
        agentAOps++;
        agentAErrors = Math.max(0, agentAErrors - 1);
      }
      if (event.kind === 'task:error') {
        agentAOps++;
        agentAErrors++;
      }
      const rate = agentAOps > 0 ? agentAErrors / agentAOps : 0;
      const state =
        rate > 0.7
          ? 'critical'
          : rate > 0.5
            ? 'stressed'
            : rate > 0.3
              ? 'strained'
              : rate > 0.1
                ? 'balanced'
                : 'thriving';
      ui.updateSpectrum('a', state);
    });
  }

  // Chaos → agents
  chaos.onStateChange((state) => {
    agentA.setChaos(state);
    agentB.setChaos(state);
  });

  // Bind chaos buttons
  const chaosButtons = document.querySelectorAll<HTMLButtonElement>('[data-chaos]');
  chaosButtons.forEach((btn) => {
    const mode = btn.dataset.chaos as ChaosMode;
    btn.addEventListener('click', () => {
      const active = chaos.toggle(mode);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  });

  // Reset button
  const resetBtn = document.getElementById('btn-reset')!;
  resetBtn.addEventListener('click', () => {
    // Full teardown
    agentA.destroy();
    agentB.destroy();
    narration.cancel();
    chaos.reset();
    ui.clearAll();

    // Reset button states
    chaosButtons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });

    // Create fresh agents
    createAgents();
    agentA.start();
    agentB.start();
  });

  // Start button — nothing runs until the user clicks
  const startBtn = document.getElementById('btn-start')!;
  const controlsSection = document.querySelector('.controls') as HTMLElement;
  controlsSection.style.display = 'none';

  startBtn.addEventListener('click', () => {
    startBtn.remove();
    controlsSection.style.display = '';

    createAgents();
    agentA.start();
    agentB.start();

    // Auto-trigger chaos after calm period
    const initialChaos = getInitialChaosFromURL();
    setTimeout(() => {
      const mode = initialChaos ?? 'api-failures';
      chaos.toggle(mode);
      const btn = document.querySelector<HTMLButtonElement>(`[data-chaos="${mode}"]`);
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
    }, AUTO_START_DELAY);
  });

  // Update seed in URL for shareability
  if (!window.location.search.includes('seed=')) {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    window.history.replaceState({}, '', url.toString());
  }

  // GoatCounter event tracking
  if (typeof (window as any).goatcounter !== 'undefined') {
    const gc = (window as any).goatcounter;
    chaosButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        gc.count({ path: `experiment-chaos-${btn.dataset.chaos}`, event: true });
      });
    });
    resetBtn.addEventListener('click', () => {
      gc.count({ path: 'experiment-reset', event: true });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
