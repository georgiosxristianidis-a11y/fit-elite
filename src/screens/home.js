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
import units from '../core/units.js';
import { getSettings } from './profile.js';

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

const PPL_HERO_EXERCISES = {
  push: 'bench_press',
  pull: 'pull_ups',
  legs: 'leg_press'
};

// ─── Module state ─────────────────────────────────────────────────────────────

let _el         = null;
let _lang       = 'en';
let _pplDay     = 'push';
let _nudgeDismissed = false;
let _tmplVariant = 'a';
let _tmplExpanded = true;

// Async data cache
let _allRecords  = null;   // global dict of all records
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
  _allRecords = records;

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

  // C-2 Fix: read name from profile settings (localStorage)
  const name   = getSettings().name || 'Athlete';
  const letter = name.charAt(0).toUpperCase();

  return `
    <div class="home-top">
      <div>
        <div class="h-greet">${greet}</div>
        <div class="h-name">${name}</div>
        <div class="h-date">${date}</div>
      </div>
      <div class="av">${letter}</div>
    </div>
  `;
}

function _renderHero() {
  const heroId = PPL_HERO_EXERCISES[_pplDay] || 'bench_press';
  const exDef = templates.exercises[heroId];
  const name  = _lang === 'ru' ? exDef?.name_ru : exDef?.name;
  const heroRecord = _allRecords?.[heroId] ?? null;

  if (!heroRecord) {
    return `
      <div class="hero-block" id="hero-block" data-ex="${heroId}" style="cursor:pointer">
        <div class="hero-label">${name}</div>
        <div class="hero-metric" style="color:var(--t3)">— <span class="hero-unit">${units.getUnit()}</span></div>
        <div class="hero-sub">${_t('Tap to log baseline', 'Нажми, чтобы записать')}</div>
      </div>
    `;
  }

  const { kg, reps, ts } = heroRecord;
  const daysAgo = ts ? Math.floor((Date.now() - new Date(ts)) / 86400000) : null;
  const when = daysAgo === 0 ? _t('today', 'сегодня')
    : daysAgo === 1 ? _t('yesterday', 'вчера')
    : daysAgo != null ? `${daysAgo} ${_t('days ago', 'дн. назад')}` : '';

  // 1RM estimate (Epley)
  const orm = reps > 1 ? Math.round(kg * (1 + reps / 30)) : kg;

  return `
    <div class="hero-block" id="hero-block" data-ex="${heroId}" style="cursor:pointer">
      <div class="hero-label">${name}</div>
      <div class="hero-metric">${units.displayWeight(kg)}<span class="hero-unit">${units.getUnit()}</span></div>
      <div class="hero-sub">
        ${reps} reps · <span style="color:var(--p)">${_t('1RM est.', '1ПМ прим.')}</span> ${units.displayWeight(orm)} ${units.getUnit()}
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
  const tmplId  = `${_pplDay}_${_tmplVariant}`;
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
        <div style="display:flex;flex-direction:column;gap:6px;width:100%">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="tmpl-title-lbl" style="display:flex;align-items:center;gap:8px">
              ${_t("Today's Plan", 'Программа на сегодня')}
              <div style="background:var(--s2); border-radius:var(--rp); display:inline-flex; padding:2px">
                <div class="variant-btn ${_tmplVariant === 'a' ? 'on' : ''}" data-variant="a" style="cursor:pointer; padding:2px 8px; border-radius:4px; font-size:.625rem; font-weight:800; ${ _tmplVariant === 'a' ? 'background:var(--s4); color:var(--p)' : 'color:var(--t3)'}">A</div>
                <div class="variant-btn ${_tmplVariant === 'b' ? 'on' : ''}" data-variant="b" style="cursor:pointer; padding:2px 8px; border-radius:4px; font-size:.625rem; font-weight:800; ${ _tmplVariant === 'b' ? 'background:var(--s4); color:var(--p)' : 'color:var(--t3)'}">B</div>
              </div>
            </span>
            <div style="display:flex;align-items:center;gap:4px">
              <button id="tmpl-settings-btn" style="background:transparent;border:none;color:var(--t3);cursor:pointer;padding:4px;display:flex;align-items:center">
                <span class="material-symbols-outlined" style="font-size:18px">more_vert</span>
              </button>
              <button id="tmpl-collapse-btn" style="background:transparent;border:none;color:var(--t3);cursor:pointer;padding:4px;display:flex;align-items:center">
                <span class="material-symbols-outlined" style="font-size:20px">${_tmplExpanded ? 'expand_less' : 'expand_more'}</span>
              </button>
            </div>
          </div>
          <span class="tmpl-name" style="color:${color}">${tmpl.name}</span>
        </div>
      </div>
      <div class="tmpl-card" id="today-plan-card">
        <div class="tmpl-ex" id="plan-preview-body" data-tmpl-id="${tmplId}">
          ${_tmplExpanded 
            ? tmpl.muscle_groups.map(mg => `
                <div style="font-size:.625rem; font-weight:800; color:var(--t3); text-transform:uppercase; margin:12px 10px 4px;">${mg.name}</div>
                ${mg.exercises.map((ex) => {
                  const i = allEx.indexOf(ex);
                  const def  = templates.exercises[ex.exercise_id];
                  const name = _lang === 'ru' ? (def?.name_ru || def?.name) : def?.name;
                  return `
                    <div class="ex-row">
                      <span class="ex-num">${String(i + 1).padStart(2,'0')}</span>
                      <span class="ex-dot" style="background:${color};opacity:1"></span>
                      <div class="ex-info">
                        <div class="ex-name">${name ?? ex.exercise_id}</div>
                        <div class="ex-meta">${ex.sets}×${ex.reps ?? `${ex.duration_sec}s`} ${def?.equipment ? `· ${def.equipment}` : ''}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              `).join('')
            : preview.map((ex, i) => {
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
              }).join('')
          }
          
          ${(!_tmplExpanded && allEx.length > 3) ? `
            <div class="ex-row" style="padding:10px 0; justify-content:center; align-items:center;">
               <button id="plan-preview-more" style="background:var(--s2);border:1px solid var(--t4);border-radius:12px;color:var(--t2);font-size:.6875rem;font-weight:700;padding:6px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all var(--tb) var(--e1);">
                 <span class="material-symbols-outlined" style="font-size:16px;color:var(--p)">add_circle</span>
                 ${allEx.length - 3} ${_t('More', 'Ещё')}
               </button>
            </div>
          ` : ''}
        </div>
        <div class="tmpl-actions">

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
  const message = _generateNudge();
  if (!message) return '';
  return `
    <div class="nudge" id="nudge">
      ${message.icon ? `<span class="material-symbols-outlined fi" style="font-size:15px;color:${message.color ?? 'var(--info)'}">${message.icon}</span>` : ''}
      <div class="nudge-text">${message.text}</div>
      <span class="material-symbols-outlined nudge-close" id="nudge-close">close</span>
    </div>
  `;
}

function _generateNudge() {
  const s = _weekStats;
  if (!s) return null;
  const icon = 'auto_awesome';
  const color = 'var(--info)';

  // First-timer
  if (s.workouts === 0 && _lastWorkout === null) {
    const next = ({ push: { en: 'Push', ru: 'Пуш' }, pull: { en: 'Pull', ru: 'Пул' }, legs: { en: 'Legs', ru: 'Ноги' } })[s.next_type]?.[_lang] ?? 'PPL';
    return { icon, color, en: `Ready to start? Today's pick: ${next}. No pressure, just show up.`, ru: `Готов начать? Сегодня: ${next}. Без давления, просто приходи.` };
  }

  // Streak encouragement
  if (s.workouts >= 3) {
    return { icon, color, en: `${s.workouts} sessions this week — you're on fire! 🔥`, ru: `${s.workouts} тренировок на этой неделе — огонь! 🔥` };
  }

  // Volume comparison
  if (s.workouts >= 1) {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastWeek = (_allRecords
      ? (() => {
          // approximate from history
          return null;
        })()
      : null);
    if (s.volume_kg > 0) {
      const totalT = Math.round(s.volume_kg / 1000 * 10) / 10;
      return { icon, color, en: `This week: ${s.workouts} workout${s.workouts > 1 ? 's' : ''}, ${totalT}t volume. Keep it up!`, ru: `Эта неделя: ${s.workouts} тренир${s.workouts === 1 ? 'ка' : s.workouts < 5 ? 'ки' : 'ок'}, объём ${totalT}т. Так держать!` };
    }
  }

  // Default fallback
  const next = ({ push: { en: 'Push', ru: 'Пуш' }, pull: { en: 'Pull', ru: 'Пул' }, legs: { en: 'Legs', ru: 'Ноги' } })[s.next_type]?.[_lang] ?? 'PPL';
  return { icon, color, en: `Next recommended: ${next}. Your future self will thank you.`, ru: `Следующее: ${next}. Будущий ты скажет спасибо.` };
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

  // Template editor
  _el.querySelector('#tmpl-settings-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _openTemplateEditor(`${_pplDay}_a`);
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

  // Hero block -> stats drilldown
  _el.querySelector('#hero-block')?.addEventListener('click', (e) => {
    const exId = e.currentTarget.dataset.ex;
    bus.emit('nav:switch', { screen: 'stats', exercise: exId });
  });

  // A/B Variant toggle
  _el.querySelectorAll('.variant-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      _tmplVariant = e.currentTarget.dataset.variant;
      _render();
    });
  });

  // Collapse toggle
  _el.querySelector('#tmpl-collapse-btn')?.addEventListener('click', () => {
    _tmplExpanded = !_tmplExpanded;
    _render();
  });

  // Open Full Plan Viewer inline (card tap)
  _el.querySelector('#plan-preview-body')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const tmplId = document.getElementById('plan-preview-body')?.dataset.tmplId;
    if (!tmplId) return;
    _editTmplId = tmplId;
    _editTmplCopy = null;
    _searchQuery = '';
    _render();
  });
  
  // "+ X More" button toggles inline expansion
  _el.querySelector('#plan-preview-more')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _tmplExpanded = true;
    _render();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _t(en, ru) { return _lang === 'ru' ? ru : en; }

// ─── Template Editor ────────────────────────────────────────────────────────

let _editList = [];
let _editDragIdx = null;
let _editTmplId = null;
let _editTmplCopy = null;

function _openTemplateEditor(tmplId) {
  _editTmplId = tmplId;
  const tmpl = templates.templates[tmplId];
  if (!tmpl) return;

  _editList = [];
  for (const mg of tmpl.muscle_groups) {
    for (const ex of mg.exercises) {
      _editList.push({ ...ex, mg_id: mg.id, mg_name: mg.name, mg_name_ru: mg.name_ru });
    }
  }
  _renderEditorSheet();
}

function _renderEditorSheet() {
  const overlay = document.getElementById('tmpl-edit-overlay') || document.createElement('div');
  const sheet = document.getElementById('tmpl-edit-sheet') || document.createElement('div');
  
  if (!document.getElementById('tmpl-edit-overlay')) {
    overlay.className = 'sheet-overlay';
    overlay.id = 'tmpl-edit-overlay';
    sheet.className = 'plan-viewer';
    sheet.id = 'tmpl-edit-sheet';
    _el.appendChild(overlay);
    _el.appendChild(sheet);
  }

  const exHtml = _editList.map((ex, i) => {
    const def = templates.exercises[ex.exercise_id];
    const name = _lang === 'ru' ? def?.name_ru : def?.name;
    return `
      <div class="edit-ex-row" draggable="true" data-idx="${i}">
        <span class="material-symbols-outlined" style="color:var(--t4);cursor:grab;margin-right:8px;font-size:20px">drag_indicator</span>
        <div style="flex:1">
          <div style="font-size:.8125rem;font-weight:700;color:var(--t1)">${name ?? ex.exercise_id}</div>
          <div style="font-size:.5625rem;color:var(--t3)">${ex.sets} × ${ex.reps ?? '-'}</div>
        </div>
        <button class="icon-btn del-ex-btn" data-idx="${i}" style="color:var(--err);background:none;border:none;cursor:pointer">
          <span class="material-symbols-outlined" style="font-size:20px">delete_outline</span>
        </button>
      </div>
    `;
  }).join('');

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div>
        <div class="sheet-title">${_t('Edit Template', 'Редактируя шаблон')}</div>
        <div class="sheet-sub" style="color:var(--t2)">${_t('Drag to reorder, use trash to delete', 'Перетаскивайте для порядка')}</div>
      </div>
      <button class="sheet-close" id="tmpl-edit-close">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="sheet-body" style="padding-top:10px">
      <div id="tmpl-edit-list" style="display:flex;flex-direction:column;gap:0;margin-bottom:16px">
        ${exHtml}
      </div>
      <button class="ta-btn" id="tmpl-edit-add" style="width:100%;justify-content:center;height:44px;border:1px dashed var(--p);color:var(--p);font-size:.75rem">
        <span class="material-symbols-outlined" style="font-size:18px">add</span> ${_t('Add Exercise', 'Добавить упражнение')}
      </button>
    </div>
    <div class="sheet-actions" style="display:flex;gap:10px;padding-bottom:24px">
      <button class="sheet-start" id="tmpl-edit-save" style="flex:1;background:var(--p);font-size:.75rem">
        ${_t('Save changes', 'Сохранить')}
      </button>
      <button class="sheet-start" id="tmpl-edit-new" style="flex:1;background:var(--s3);color:var(--t1);font-size:.75rem">
        ${_t('Save as Custom', 'Как свой')}
      </button>
    </div>
  `;

  requestAnimationFrame(() => sheet.classList.add('open'));
  _bindEditorSheet();
}

function _bindEditorSheet() {
  const closeFn = () => {
    const s = document.getElementById('tmpl-edit-sheet');
    const o = document.getElementById('tmpl-edit-overlay');
    if (s) s.classList.remove('open');
    setTimeout(() => { s?.remove(); o?.remove(); }, 300);
  };
  document.getElementById('tmpl-edit-overlay').onclick = closeFn;
  document.getElementById('tmpl-edit-close').onclick = closeFn;

  const list = document.getElementById('tmpl-edit-list');
  const rows = list.querySelectorAll('.edit-ex-row');
  
  rows.forEach(row => {
    row.addEventListener('dragstart', (e) => {
      _editDragIdx = parseInt(row.dataset.idx);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.style.opacity = '0.4', 0);
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('over');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('over');
    });
    row.addEventListener('drop', (e) => {
      e.stopPropagation();
      row.classList.remove('over');
      const toIdx = parseInt(row.dataset.idx);
      if (_editDragIdx !== null && _editDragIdx !== toIdx) {
        const item = _editList.splice(_editDragIdx, 1)[0];
        _editList.splice(toIdx, 0, item);
        _renderEditorSheet();
      }
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '1';
      rows.forEach(r => r.classList.remove('over'));
      _editDragIdx = null;
    });
  });

  _el.querySelectorAll('.del-ex-btn').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      _editList.splice(idx, 1);
      _renderEditorSheet();
    };
  });

  _el.querySelector('#tmpl-edit-add').onclick = () => _renderSearchModal();

  _el.querySelector('#tmpl-edit-save').onclick = () => {
    _saveEditedTemplate(_editTmplId, false);
    _render();
    closeFn();
  };

  _el.querySelector('#tmpl-edit-new').onclick = () => {
    _saveEditedTemplate(_editTmplId, true);
    _render();
    closeFn();
  };
}

function _saveEditedTemplate(tmplId, asNew) {
  const mgMap = {};
  _editList.forEach(ex => {
    const mgId = ex.mg_id || 'other';
    const mgName = ex.mg_name || 'Other';
    const mgNameRu = ex.mg_name_ru || 'Другое';
    if (!mgMap[mgId]) mgMap[mgId] = { id: mgId, name: mgName, name_ru: mgNameRu, exercises: [] };
    const { mg_id, mg_name, mg_name_ru, ...cleanEx } = ex;
    mgMap[mgId].exercises.push(cleanEx);
  });
  
  const finalMgs = Object.values(mgMap);
  
  if (asNew) {
    const name = prompt(_t('Name:', 'Название:'), 'Custom Plan');
    if (!name) return;
    const newId = 'custom_' + Date.now();
    templates.templates[newId] = {
      id: newId, type: 'custom', name, name_ru: name, subtitle: 'User', subtitle_ru: 'Свой',
      muscle_groups: finalMgs
    };
    bus.emit('toast', { msg: _t('Template created', 'Шаблон создан'), type: 'ok' });
  } else {
    templates.templates[tmplId].muscle_groups = finalMgs;
    bus.emit('toast', { msg: _t('Template updated', 'Шаблон обновлен'), type: 'ok' });
  }
}

function _renderSearchModal() {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.style.zIndex = 40;
  
  const modal = document.createElement('div');
  modal.className = 'plan-viewer open';
  modal.style.zIndex = 41;

  modal.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="padding:10px 20px">
      <div class="search-wrap" style="position:relative;margin:0">
        <span class="material-symbols-outlined search-ico">search</span>
        <input class="search-input" id="smart-search-in" type="text" placeholder="${_t('Find exercise...', 'Найти упражнение...')}" autocomplete="off"/>
      </div>
    </div>
    <div class="sheet-body" id="smart-search-res" style="padding-top:10px;overflow-y:auto;flex:1"></div>
  `;
  
  _el.appendChild(overlay);
  _el.appendChild(modal);

  const inp = modal.querySelector('#smart-search-in');
  const res = modal.querySelector('#smart-search-res');
  const allEx = Object.values(templates.exercises);

  const _renderRes = (query) => {
    const q = query.toLowerCase();
    const filtered = allEx.filter(e => e.name.toLowerCase().includes(q) || (e.name_ru && e.name_ru.toLowerCase().includes(q))).slice(0, 15);
    res.innerHTML = filtered.map(e => `
      <div class="edit-ex-row" style="cursor:pointer;margin-bottom:6px" data-id="${e.id}">
        <div style="flex:1">
          <div style="font-size:.8125rem;font-weight:700;color:var(--t1)">${_lang === 'ru' ? e.name_ru : e.name}</div>
          <div style="font-size:.5625rem;color:var(--t3)">${e.muscles.join(', ')}</div>
        </div>
        <span class="material-symbols-outlined" style="color:var(--p)">add_circle</span>
      </div>
    `).join('');

    res.querySelectorAll('.edit-ex-row').forEach(row => {
      row.onclick = () => {
        const id = row.dataset.id;
        _editList.push({ exercise_id: id, sets: 3, reps: 10, duration_sec: null, rotation: null, mg_id: 'other', mg_name: 'Other' });
        _renderEditorSheet();
        modal.remove(); overlay.remove();
      };
    });
  };

  _renderRes('');
  inp.addEventListener('input', e => _renderRes(e.target.value));
  
  overlay.onclick = () => { modal.remove(); overlay.remove(); };
}

export default { mount, unmount };
