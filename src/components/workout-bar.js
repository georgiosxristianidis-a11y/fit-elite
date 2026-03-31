import sync from '../core/sync.js';
import { bus } from '../core/bus.js';
import session, { STATE } from '../core/session.js';

/**
 * workout-bar.js
 * Dynamic Island Web Component — <workout-bar>
 *
 * Collapsed:  dot(left) · time(center) · sets(right)
 * Expanded:   dot · EXERCISE NAME · time · sets + sublabel + progress line
 */

const PPL_COLORS = {
  push: 'var(--pushL)',
  pull: 'var(--pullL)',
  legs: 'var(--legsL)',
};

const SETS_COLORS = [
  '',
  '#2a2a2a',
  '#444444',
  '#9a9a9a',
  'var(--p)',
];

function setsColor(done, total) {
  if (total <= 0) return '#444';
  if (done >= total) return 'var(--p)';
  const idx = Math.min(done, SETS_COLORS.length - 1);
  return SETS_COLORS[idx] || '#444';
}

const TEMPLATE = `
<style>
  :host {
    display: flex;
    justify-content: center;
    padding: 8px 0 10px;
    background: var(--bg, #0a0a0a);
    --transition: all 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  }
  :host([hidden]) { display: none; }
  .island {
    background: #000;
    border-radius: 20px;
    height: 34px;
    width: 220px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: var(--transition);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .island.expanded {
    height: 54px;
    width: 310px;
    border-radius: 24px;
  }
  .dot {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: background 0.3s, top 0.38s cubic-bezier(0.4,0,0.2,1), transform 0.38s;
    z-index: 2;
  }
  .island.expanded .dot {
    top: 14px;
    transform: none;
  }
  .dot.online {
    background: var(--p, #00c86e);
    animation: glow-on 2.4s ease-in-out infinite;
  }
  .dot.offline {
    background: var(--err, #f472b6);
    animation: glow-off 2.4s ease-in-out infinite;
  }
  @keyframes glow-on  { 0%,100%{opacity:.45} 50%{opacity:1} }
  @keyframes glow-off { 0%,100%{opacity:.2}  50%{opacity:.65} }

  /* Анимация завершения сета */
  .island.set-complete {
    animation: set-complete-pulse 0.6s ease-out;
  }
  @keyframes set-complete-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0,200,110,0); }
    50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(0,200,110,0.3); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0,200,110,0); }
  }
  .time {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    color: var(--txt2, #9a9a9a);
    white-space: nowrap;
    transition: left 0.38s cubic-bezier(0.4,0,0.2,1),
                top  0.38s cubic-bezier(0.4,0,0.2,1),
                transform 0.38s cubic-bezier(0.4,0,0.2,1);
    z-index: 2;
  }
  .island.expanded .time {
    left: auto;
    right: 52px;
    top: 13px;
    transform: none;
  }
  .sets {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition: color 0.3s, top 0.38s, transform 0.38s;
    z-index: 2;
  }
  .island.expanded .sets {
    top: 13px;
    transform: none;
  }
  .name {
    position: absolute;
    left: 28px;
    right: 80px;
    top: 10px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: .05em;
    color: var(--txt, #f2f2f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 2;
  }
  .island.expanded .name { opacity: 1; }
  .sublabel {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 9px;
    font-size: 9px;
    font-weight: 700;
    color: var(--txt3, #555);
    letter-spacing: .05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s 0.1s;
    z-index: 2;
  }
  .island.expanded .sublabel { opacity: 1; }
  .progress-track {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1.5px;
    background: rgba(255,255,255,0.04);
  }
  .progress-fill {
    height: 100%;
    border-radius: 0 0 20px 20px;
    transition: width 0.5s ease, background 0.3s;
  }
</style>

<div class="island" id="island" role="status" aria-live="polite">
  <div class="dot online" id="dot"></div>
  <div class="time" id="time">00:00</div>
  <div class="sets" id="sets"></div>
  <div class="name" id="name"></div>
  <div class="sublabel" id="sublabel"></div>
  <div class="progress-track">
    <div class="progress-fill" id="progress-fill"></div>
  </div>
</div>
`;

class WorkoutBar extends HTMLElement {
  constructor() {
    super();
    this._expanded   = false;
    this._online     = true;
    this._root       = this.attachShadow({ mode: 'open' });
    this._root.innerHTML = TEMPLATE;
    this._island     = this._root.getElementById('island');
    this._dot        = this._root.getElementById('dot');
    this._time       = this._root.getElementById('time');
    this._sets       = this._root.getElementById('sets');
    this._name       = this._root.getElementById('name');
    this._sublabel   = this._root.getElementById('sublabel');
    this._fill       = this._root.getElementById('progress-fill');
  }

  connectedCallback() {
    this._island.addEventListener('click', () => this._toggleExpand());

    this._onTick         = () => this._update();
    this._onSetLogged    = () => this._update();
    this._onExChanged    = () => this._update();
    this._onStateChanged = () => this._update();
    this._onStarted      = () => { this.hidden = false; this._update(); };
    this._onEnded        = () => { this.hidden = true; this._expanded = false; };
    this._onSyncStatus   = () => this._updateDot();

    bus.on('session:tick',             this._onTick);
    bus.on('session:set_logged',       this._onSetLogged);
    bus.on('session:exercise_changed', this._onExChanged);
    bus.on('session:state_changed',    this._onStateChanged);
    bus.on('session:started',          this._onStarted);
    bus.on('session:saved',            this._onEnded);
    bus.on('session:discarded',        this._onEnded);
    bus.on('sync:status',              this._onSyncStatus);

    this._onOnline  = () => { this._online = true;  this._updateDot(); };
    this._onOffline = () => { this._online = false; this._updateDot(); };
    window.addEventListener('online',  this._onOnline);
    window.addEventListener('offline', this._onOffline);
    this._online = navigator.onLine;

    const snap = session.getSnapshot();
    if (snap.status === STATE.IDLE) this.hidden = true;
    else this._update();
  }

  disconnectedCallback() {
    bus.off('session:tick',             this._onTick);
    bus.off('session:set_logged',       this._onSetLogged);
    bus.off('session:exercise_changed', this._onExChanged);
    bus.off('session:state_changed',    this._onStateChanged);
    bus.off('session:started',          this._onStarted);
    bus.off('session:saved',            this._onEnded);
    bus.off('session:discarded',        this._onEnded);
    bus.off('sync:status',              this._onSyncStatus);
    window.removeEventListener('online',  this._onOnline);
    window.removeEventListener('offline', this._onOffline);
  }

  _toggleExpand() {
    this._expanded = !this._expanded;
    this._island.classList.toggle('expanded', this._expanded);
  }

  _update() {
    const data = session.getIslandData();
    const snap = session.getSnapshot();

    this._time.textContent = data.elapsed_str;
    this._name.textContent = data.exercise_name;

    if (data.set_str) {
      const [done, total] = data.set_str.split('/').map(Number);
      this._sets.textContent = data.set_str;
      this._sets.style.color = setsColor(done, total);

      // Анимация при завершении последнего сета
      if (done >= total && total > 0) {
        this._island.classList.add('set-complete');
        setTimeout(() => this._island.classList.remove('set-complete'), 2000);
      }
    } else {
      this._sets.textContent = '';
    }

    this._sublabel.textContent = this._buildSublabel(snap);

    const pct   = Math.round(data.progress * 100);
    const color = PPL_COLORS[data.ppl_type] || 'var(--p)';
    this._fill.style.width      = `${pct}%`;
    this._fill.style.background = color;

    this._updateDot();
  }

  _updateDot() {
    const status = sync.getStatus();
    const cls = (!this._online || status === 'offline') ? 'offline' : 'online';
    this._dot.className = `dot ${cls}`;
  }

  _buildSublabel(snap) {
    if (snap.status === STATE.TRAINING && snap.current_exercise_def) {
      const tmpl = snap.template_name ?? '';
      const kg   = this._lastKg(snap);
      return kg
        ? `${tmpl} · ${kg} kg · next → ${this._nextExName(snap)}`
        : `${tmpl} · next → ${this._nextExName(snap)}`;
    }
    if (snap.status === STATE.CORE)    return snap.core_name ?? 'Core';
    if (snap.status === STATE.STRETCH) return 'Stretch · 5 min';
    if (snap.status === STATE.PAUSED)  return 'Paused';
    if (snap.status === STATE.SUMMARY) return 'Workout complete — Save?';
    return '';
  }

  _lastKg(snap) {
    const id   = snap.resolved_exercise_id;
    const sets = snap.sets.filter(s => s.exercise_id === id);
    return sets.length ? sets[sets.length - 1].kg : null;
  }

  _nextExName(snap) {
    const next = snap.exercises[snap.block_index + 1];
    if (!next) return snap.core_name ?? 'Core';
    return next.exercise_id.replace(/_/g, ' ');
  }
}

customElements.define('workout-bar', WorkoutBar);

export default WorkoutBar;
