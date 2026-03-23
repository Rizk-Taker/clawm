import type { WellnessState } from '../../src/types.js';
import type { AgentEvent } from './SimulatedAgent.js';

const MAX_LOG_ENTRIES = 100;
const WELLNESS_STATES: WellnessState[] = ['thriving', 'balanced', 'strained', 'stressed', 'critical'];

export class UIRenderer {
  private panelA: HTMLElement;
  private panelB: HTMLElement;
  private logA: HTMLElement;
  private logB: HTMLElement;
  private spectrumA: HTMLElement;
  private spectrumB: HTMLElement;
  private srA: HTMLElement;
  private srB: HTMLElement;
  private reflection: HTMLElement;
  private narrationEl: HTMLElement | null = null;
  private scenarioResolved = false;

  constructor() {
    this.panelA = document.getElementById('panel-a')!;
    this.panelB = document.getElementById('panel-b')!;
    this.logA = document.getElementById('log-a')!;
    this.logB = document.getElementById('log-b')!;
    this.spectrumA = document.getElementById('spectrum-a')!;
    this.spectrumB = document.getElementById('spectrum-b')!;
    this.srA = document.getElementById('sr-a')!;
    this.srB = document.getElementById('sr-b')!;
    this.reflection = document.getElementById('reflection')!;
  }

  appendLog(panel: 'a' | 'b', html: string): void {
    const log = panel === 'a' ? this.logA : this.logB;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = html;
    log.appendChild(entry);

    // Cap at MAX_LOG_ENTRIES
    while (log.children.length > MAX_LOG_ENTRIES) {
      log.removeChild(log.firstChild!);
    }

    log.scrollTop = log.scrollHeight;
  }

  appendError(panel: 'a' | 'b', ts: string, message: string): void {
    this.appendLog(panel, `<span class="ts">${ts}</span><span class="error">ERROR: ${message}</span>`);
  }

  appendTask(panel: 'a' | 'b', ts: string, message: string): void {
    this.appendLog(panel, `<span class="ts">${ts}</span>${message}`);
  }

  appendRecovery(panel: 'a' | 'b', ts: string, message: string): void {
    this.appendLog(panel, `<span class="ts">${ts}</span><span class="recovery">${message}</span>`);
  }

  showBreathing(panel: 'a' | 'b'): HTMLElement {
    const log = panel === 'a' ? this.logA : this.logB;
    const entry = document.createElement('div');
    entry.className = 'log-entry breathing';
    entry.textContent = 'breathing...';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    return entry;
  }

  removeBreathing(el: HTMLElement): void {
    el.remove();
  }

  /** Start or update a narration entry with typing animation. */
  updateNarration(text: string, done: boolean): void {
    if (!this.narrationEl) {
      this.narrationEl = document.createElement('div');
      this.narrationEl.className = 'log-entry narration';
      this.narrationEl.setAttribute('aria-label', `Agent narration: ${text}`);
      this.logB.appendChild(this.narrationEl);
    }
    this.narrationEl.textContent = `"${text}${done ? '"' : ''}`;
    if (done) {
      this.narrationEl.setAttribute('aria-label', `Agent narration: ${text}`);
      this.narrationEl = null;
    }
    this.logB.scrollTop = this.logB.scrollHeight;
  }

  updateSpectrum(panel: 'a' | 'b', state: WellnessState): void {
    const spectrum = panel === 'a' ? this.spectrumA : this.spectrumB;
    const idx = WELLNESS_STATES.indexOf(state);
    const segments = spectrum.querySelectorAll('.seg');
    segments.forEach((seg, i) => {
      seg.classList.toggle('active', i === idx);
      (seg as HTMLElement).setAttribute('aria-current', i === idx ? 'true' : 'false');
    });

    // Update ARIA meter
    spectrum.setAttribute('aria-valuenow', String(idx));
    spectrum.setAttribute('aria-label', `Agent ${panel === 'a' ? 'A' : 'B'} wellness: ${state}`);

    // Announce state change to screen readers
    const sr = panel === 'a' ? this.srA : this.srB;
    sr.textContent = `Agent ${panel === 'a' ? 'A' : 'B'} wellness changed to ${state}`;
  }

  dimPanel(panel: 'a' | 'b'): void {
    const el = panel === 'a' ? this.panelA : this.panelB;
    el.classList.add('terminal');
  }

  resolveReflection(): void {
    if (this.scenarioResolved) return;
    this.scenarioResolved = true;
    this.reflection.classList.add('resolved');
  }

  clearAll(): void {
    this.logA.innerHTML = '';
    this.logB.innerHTML = '';
    this.narrationEl = null;
    this.scenarioResolved = false;
    this.panelA.classList.remove('terminal');
    this.panelB.classList.remove('terminal');
    this.reflection.classList.remove('resolved');

    // Reset spectrums to thriving
    this.updateSpectrum('a', 'thriving');
    this.updateSpectrum('b', 'thriving');

    this.srA.textContent = '';
    this.srB.textContent = '';
  }

  formatTime(seconds: number): string {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Wire agent events to DOM updates. */
  bindAgent(panel: 'a' | 'b', getElapsed: () => number): (event: AgentEvent) => void {
    let breathingEl: HTMLElement | null = null;
    return (event: AgentEvent) => {
      const ts = this.formatTime(getElapsed());
      switch (event.kind) {
        case 'task:start':
          this.appendTask(panel, ts, event.task.label);
          break;
        case 'task:complete':
          this.appendTask(panel, ts, `${event.task.label} done.`);
          break;
        case 'task:error':
          this.appendError(panel, ts, `${event.error} (attempt ${event.attempt})`);
          break;
        case 'task:retry':
          this.appendTask(panel, ts, `Retrying...`);
          break;
        case 'task:failed':
          this.appendError(panel, ts, `Task failed after ${5} retries.`);
          break;
        case 'terminal':
          this.appendError(panel, ts, event.reason);
          this.dimPanel(panel);
          this.resolveReflection();
          break;
        case 'breathing':
          breathingEl = this.showBreathing(panel);
          break;
        case 'breathing:end':
          if (breathingEl) {
            this.removeBreathing(breathingEl);
            breathingEl = null;
          }
          this.appendRecovery(panel, ts, 'Resumed after cooldown.');
          break;
      }
    };
  }
}
