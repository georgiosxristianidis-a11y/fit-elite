/**
 * home.js
 * Home screen — dashboard view
 *
 * Sections (top → bottom):
 *   1. Greeting + avatar
 *   2. Hero metric — last max weight for a key exercise (Bench Press default)
 *   3. PPL day selector (Push / Pull / Legs)
 *   4. Today's Plan card (template preview, tap → Train)
 *   5. Week stat cards (Workouts / Volume / Time / Next day)
 *   6. AI Coach nudge (level 2, dismissable)
 *   7. Last workout card
 */

import session, { STATE } from '../core/session.js';
import { bus } from '../core/bus.js';
import db from '../core/db.js';
import templates from '../data/templates.json' with { type: 'json' };

// ─── Constants ───────────────────────────────────────────────────────────────

const PPL_COLOR = {
  push: 'var(--pushL)',
  pull: 'var(--pullL)',
  legs: 'var(--legsL)',
};

const PPL_META = {
  push: { icon: 'fitness_center',    label: 'Push', labelRu: 'Пуш', sub: 'Chest · Shoulders', subRu: 'Грудь · Плечи' },
  pull: { icon: 'sports_gymnastics', label: 'Pull', labelRu: 'Пул', sub: 'Back · Biceps',      subRu: 'Спина · Бицепс' },
  legs: { icon: 'directions_run',    label: 'Legs', labelRu: 'Ноги', sub: 'Quads · Hamstrings', subRu: 'Квадры · Хамстринг' },
};

// Hero exercise — which exercise powers the hero metric
const HERO_EXERCISE_ID = 'bench_press';

// ─── Module state ─────────────────────────────────────────────────────────────

let _el         = null;
let _lang       = 'en';
let _pplDay     = 'push';
let _nudgeDismissed = false;

// Async data cache
let _heroRecord  = null;   // { kg, reps, ts }
let _weekStats   = null;   // { workouts, volume_kg, time_sec, next_type }
let _lastWorkout = null;   // workout object | null

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function mount(el, lang = 'en') {
  _el   = el;
  _lang = lang;

  _renderSkeleton();
  await _loadData();
  _render();
  _bindBus();
}

export function unmount() {
  _unbindBus();
}

// ─── Data loading ────────────────────────────────────────────────────────────

async function _loadData() {
  const [records, history, workouts] = await Promise.all([
    db.getPersonalRecords(),
    db.getVolumeHistory(),
    db.getWorkouts(),
  ]);

  // Hero record
  _heroRecord = records[HERO_EXERCISE_ID] ?? null;

  // Week stats
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const thisWeek = history.filter(h => new Date(h.date) >= monday);

  _weekStats = {
    workouts:  thisWeek.length,
    volume_kg: Math.round(thisWeek.reduce((a, h) => a + h.volume_kg, 0)),
    time_sec:  thisWeek.reduce((a, h) => a + h.elapsed_sec, 0),
    next_type: _nextPPLType(thisWeek),
  };

  // Last workout
  _lastWorkout = workouts[0] ?? null;

  // Auto-select PPL day based on next recommended
  if (_weekStats.next_type) _pplDay = _weekStats.next_type;
}

/**
 * Simple PPL rotation: find what's least done this week
 */
function _nextPPLType(weekHistory) {
  const counts = { push: 0, pull: 0, legs: 0 };
  weekHistory.forEach(h => { if (h.ppl_type) counts[h.ppl_type]++; });
  return Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
}

// ─── Bus ─────────────────────────────────────────────────────────────────────

function _bindBus() {
  bus.on('session:saved', _onWorkoutSaved);
}

function _unbindBus() {
  bus.off('session:saved', _onWorkoutSaved);
}

async function _onWorkoutSaved() {
  await _loadData();
  _render();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _renderSkeleton() {
  if (!_el) return;
  _el.innerHTML = `<div class="home-skeleton screen-in"><div class="skel skel-hero"></div><div class="skel skel-cards"></div></div>`;
}

function _render() {
  if (!_el) return;
  _el.innerHTML = `
    <div class="home screen-in">

      ${_renderGreeting()}
      ${_renderHero()}
      ${_renderPPLBar()}
      ${_renderTodayPlan()}
      ${_renderWeekStats()}
      ${_nudgeDismissed ? '' : _renderNudge()}
      ${_renderLastWorkout()}

      <div style="height:20px"></div>
    </div>
  `;
  _bindHome();
}

// ─── Sections ────────────────────────────────────────────────────────────────

function _renderGreeting() {
  const now  = new Date();
  const hour = now.getHours();
  const greet = hour < 12
    ? _t('Good morning', 'Доброе утро')
    : hour < 18
      ? _t('Good afternoon', 'Добрый день')
      : _t('Good evening', 'Добрый вечер');

  const date = now.toLocaleDateString(_lang === 'ru' ? 'ru-RU' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'short',
  });

  return `
    <div class="home-top">
      <div>
        <div class="h-greet">${greet}</div>
        <div class="h-name">Gio</div>
        <div class="h-date">${date}</div>
      </div>
      <div class="av">G</div>
    </div>
  `;
}

function _renderHero() {
  const exDef = templates.exercises[HERO_EXERCISE_ID];
  const name  = _lang === 'ru' ? exDef?.name_ru : exDef?.name;

  if (!_heroRecord) {
    return `
      <div class="hero-block">
        <div class="hero-label">${name}</div>
        <div class="hero-metric" style="color:var(--t3)">— <span class="hero-unit">kg</span></div>
        <div class="hero-sub">${_t('No data yet', 'Данных пока нет')}</div>
      </div>
    `;
  }

  const { kg, reps, ts } = _heroRecord;
  const daysAgo = ts ? Math.floor((Date.now() - new Date(ts)) / 86400000) : null;
  const when = daysAgo === 0 ? _t('today', 'сегодня')
    : daysAgo === 1 ? _t('yesterday', 'вчера')
    : daysAgo != null ? `${daysAgo} ${_t('days ago', 'дн. назад')}` : '';

  // 1RM estimate (Epley)
  const orm = reps > 1 ? Math.round(kg * (1 + reps / 30)) : kg;

  return `
    <div class="hero-block">
      <div class="hero-label">${name}</div>
      <div class="hero-metric">${kg}<span class="hero-unit">kg</span></div>
      <div class="hero-sub">
        ${reps} reps · <span style="color:var(--p)">${_t('1RM est.', '1ПМ прим.')}</span> ${orm} kg
        ${when ? `· ${when}` : ''}
      </div>
    </div>
  `;
}

function _renderPPLBar() {
  return `
    <div class="ppl-bar">
      ${Object.entries(PPL_META).map(([key, v]) => {
        const active = key === _pplDay;
        const color  = PPL_COLOR[key];
        return `
          <div class="ppl-btn ${active ? 'on' : ''}" data-d="${key}"
               style="${active ? `border-color:${color}44;box-shadow:0 0 20px ${color}18` : ''}">
            <span class="material-symbols-outlined ppl-icon"
                  style="${active ? `color:${color}` : ''}">${v.icon}</span>
            <span class="ppl-lbl" style="${active ? `color:${color}` : ''}">
              ${_t(v.label, v.labelRu)}
            </span>
            <span class="ppl-sub">${_t(v.sub, v.subRu)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _renderTodayPlan() {
  // Pick A variant by default (could be smarter with rotation tracking)
  const tmplId  = `${_pplDay}_a`;
  const tmpl    = templates.templates[tmplId];
  if (!tmpl) return '';

  const color = PPL_COLOR[_pplDay];

  // Show first 3 exercises across all muscle groups
  const allEx = [];
  for (const mg of tmpl.muscle_groups) {
    for (const ex of mg.exercises) allEx.push(ex);
    if (allEx.length >= 3) break;
  }
  const preview = allEx.slice(0, 3);

  return `
    <div class="tmpl-section">
      <div class="tmpl-hdr">
        <span class="tmpl-title-lbl">${_t("Today's Plan", 'Программа на сегодня')}</span>
        <span class="tmpl-name" style="color:${color}">${tmpl.name}</span>
      </div>
      <div class="tmpl-card">
        <div class="tmpl-ex">
          ${preview.map((ex, i) => {
            const def  = templates.exercises[ex.exercise_id];
            const name = _lang === 'ru' ? def?.name_ru : def?.name;
            return `
              <div class="ex-row">
                <span class="ex-num">${String(i + 1).padStart(2,'0')}</span>
                <span class="ex-dot" style="background:${color};opacity:${1 - i * 0.2}"></span>
                <div class="ex-info">
                  <div class="ex-name">${name ?? ex.exercise_id}</div>
                  <div class="ex-meta">${ex.sets}×${ex.reps ?? `${ex.duration_sec}s`}</div>
                </div>
              </div>
            `;
          }).join('')}
          ${allEx.length > 3 ? `
            <div class="ex-row" style="opacity:.35">
              <span class="ex-num">···</span>
              <span class="ex-dot" style="background:${color};opacity:.2"></span>
              <div class="ex-info">
                <div class="ex-name" style="color:var(--t3)">
                  +${allEx.length - 3} ${_t('more exercises', 'упражнений')}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="tmpl-actions">
          <button class="ta-btn ta-fill" id="fill-btn">
            <span class="material-symbols-outlined" style="font-size:13px">history</span>
            ${_t('Fill', 'Заполнить')}
          </button>
          <button class="ta-start" id="start-btn">
            <span class="material-symbols-outlined fi" style="font-size:15px">play_arrow</span>
            ${_t('Start', 'Начать')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function _renderWeekStats() {
  const s = _weekStats;
  if (!s) return '';

  const timeStr = s.time_sec
    ? `${Math.floor(s.time_sec / 3600)}h ${Math.floor((s.time_sec % 3600) / 60)}m`
    : '0h';

  const nextColor = s.next_type ? PPL_COLOR[s.next_type] : 'var(--t2)';
  const nextLabel = s.next_type
    ? _t(PPL_META[s.next_type].label, PPL_META[s.next_type].labelRu)
    : '—';

  return `
    <div class="stat-row">
      <div class="sc">
        <div class="sc-l">${_t('Workouts', 'Тренировок')}</div>
        <div class="sc-v" style="color:var(--p)">${s.workouts}</div>
        <div class="sc-u">${_t('this week', 'эта неделя')}</div>
      </div>
      <div class="sc">
        <div class="sc-l">${_t('Volume', 'Объём')}</div>
        <div class="sc-v">${(s.volume_kg / 1000).toFixed(1)}k</div>
        <div class="sc-u">kg · 7d</div>
      </div>
      <div class="sc">
        <div class="sc-l">${_t('Time', 'Время')}</div>
        <div class="sc-v">${timeStr}</div>
        <div class="sc-u">${_t('in gym', 'в зале')}</div>
      </div>
    </div>
    <div class="stat-row" style="margin-top:8px">
      <div class="sc" style="grid-column:1/-1">
        <div class="sc-l">${_t('Next recommended', 'Следующий')}</div>
        <div class="sc-v" style="color:${nextColor};font-size:1.1rem">${nextLabel}</div>
        <div class="sc-u">${_t('based on this week', 'по этой неделе')}</div>
      </div>
    </div>
  `;
}

function _renderNudge() {
  // Static nudge for now — Phase 5 will pull from AI Coach
  const messages = {
    en: 'Chest volume up 12% vs last week — keep the momentum going.',
    ru: 'Объём груди +12% к прошлой неделе — продолжай в том же духе.',
  };
  return `
    <div class="nudge" id="nudge">
      <span class="material-symbols-outlined fi" style="font-size:15px;color:var(--info)">auto_awesome</span>
      <div class="nudge-text">${messages[_lang] ?? messages.en}</div>
      <span class="material-symbols-outlined nudge-close" id="nudge-close">close</span>
    </div>
  `;
}

function _renderLastWorkout() {
  if (!_lastWorkout) return '';

  const pplType = _lastWorkout.ppl_type ?? 'push';
  const color   = PPL_COLOR[pplType];
  const meta    = PPL_META[pplType];
  const date    = new Date(_lastWorkout.started_at);
  const daysAgo = Math.floor((Date.now() - date) / 86400000);
  const when    = daysAgo === 0 ? _t('Today', 'Сегодня')
    : daysAgo === 1 ? _t('Yesterday', 'Вчера')
    : `${daysAgo} ${_t('days ago', 'дн. назад')}`;

  const mins   = Math.round(_lastWorkout.elapsed_sec / 60);
  const volume = Math.round(
    (_lastWorkout.sets ?? []).reduce((a, s) => a + s.kg * s.reps, 0)
  );

  return `
    <div class="last-section">
      <div class="last-lbl">${_t('Last Workout', 'Последняя тренировка')}</div>
      <div class="last-card" id="last-card">
        <div class="last-dot" style="background:${color}"></div>
        <div class="last-info">
          <div class="last-day">${_t(meta.label, meta.labelRu)} ${_lastWorkout.template_id?.split('_')[1]?.toUpperCase() ?? ''}</div>
          <div class="last-meta">${when} · ${mins} ${_t('min', 'мин')} · ${volume.toLocaleString()} kg</div>
        </div>
        <button class="rep-btn" id="repeat-btn">
          <span class="material-symbols-outlined">replay</span>
          ${_t('Repeat', 'Повторить')}
        </button>
      </div>
    </div>
  `;
}

// ─── Bind ─────────────────────────────────────────────────────────────────────

function _bindHome() {
  // PPL selector
  _el.querySelectorAll('[data-d]').forEach(btn => {
    btn.addEventListener('click', () => {
      _pplDay = btn.dataset.d;
      _render();
    });
  });

  // Start button → switch to Train + start session
  _el.querySelector('#start-btn')?.addEventListener('click', () => {
    const tmplId = `${_pplDay}_a`;
    bus.emit('nav:switch', { screen: 'train' });
    // Small delay to let Train screen mount
    setTimeout(() => session.start(tmplId), 80);
  });

  // Fill last session values
  _el.querySelector('#fill-btn')?.addEventListener('click', () => {
    bus.emit('home:fill', { ppl_type: _pplDay });
  });

  // Nudge dismiss
  _el.querySelector('#nudge-close')?.addEventListener('click', () => {
    _nudgeDismissed = true;
    _el.querySelector('#nudge')?.remove();
  });

  // Repeat last workout
  _el.querySelector('#repeat-btn')?.addEventListener('click', () => {
    if (!_lastWorkout?.template_id) return;
    bus.emit('nav:switch', { screen: 'train' });
    setTimeout(() => session.start(_lastWorkout.template_id), 80);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _t(en, ru) { return _lang === 'ru' ? ru : en; }

export default { mount, unmount };
