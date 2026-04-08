/**
 * train.js
 * Train screen — two modes:
 *
 * MODE 1: BROWSE (session IDLE)
 *   - PPL cards [Push][Pull][Legs][+] with real-time set counters
 *   - Search bar → exercise list filtered by query
 *   - Tap PPL card → bottom sheet with workout details → Start
 *   - "+" button → custom templates (coming soon)
 *
 * MODE 2: ACTIVE (session TRAINING/CORE/STRETCH)
 *   - Exercise nav (horizontal scroll) with set counters
 *   - Exercise header (name + muscle pill + prev best)
 *   - Rest timer (3 states: idle/active/warning)
 *   - Set logger (PR/Done/Active/Locked rows)
 *   - Volume summary bar
 *   - FAB "Finish Set"
 *   - Finish button → double confirm → Summary modal
 */

import session, { STATE } from '../core/session.js';
import { bus } from '../core/bus.js';
import templates from '../data/templates.json' with { type: 'json' };
import db from '../core/db.js';
import units from '../core/units.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PPL_COLOR = {
  push: 'var(--pushL)',
  pull: 'var(--pullL)',
  legs: 'var(--legsL)',
};

// ─── State ───────────────────────────────────────────────────────────────────

let _el          = null;   // root DOM element
let _lang        = 'en';
let _searchQuery = '';
let _searchExpanded = {};
let _activeChip  = 'all';  // для фильтра упражнений
let _activeSub   = null;   // для под-фильтра
let _finishStep  = 0;      // 0=idle, 1=first tap, 2=confirmed
let _finishTimer = null;
let _skipCount   = 0;      // tracks how many exercises were skipped

let _fabTaps     = 0;
let _fabTimer    = null;

// Timer state
let _timerSecs   = 90;
let _timerMax    = 90;
let _timerRunning= false;
let _timerTick   = null;
let _timerMinimized = false;

// Set logger state (mirrors session in-memory)
let _setDraftKg   = '';
let _setDraftReps = '';
let _setDraftRpe  = '';
let _setDraftIsWeighted = false;

// C-3 Fix: in-memory workouts cache (invalidated on session:saved)
let _workoutsCache = null;

// M-1: custom templates cache (invalidated on template save/delete)
let _customTemplatesCache = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mount(el, lang = 'en', args = {}) {
  _el   = el;
  _lang = lang;
  // H-3 Fix: always reset timer state when mounting (prevent stale state between sessions)
  _resetTimerState();
  _render();
  _bindBus();

  if (args.action === 'open_sheet' && args.ppl) {
    setTimeout(() => _openPPLSheet(args.ppl), 100);
  }
}

export function unmount() {
  _unbindBus();
  _stopTimer();
}

// ─── Bus ─────────────────────────────────────────────────────────────────────

function _bindBus() {
  bus.on('session:started',          _render);
  bus.on('session:exercise_changed', _renderActive);
  bus.on('session:state_changed',    _renderActive);
  bus.on('session:set_logged',       _renderSetList);
  bus.on('session:saved',            _onSessionSaved);
  bus.on('session:discarded',        _render);
}

function _unbindBus() {
  bus.off('session:started',          _render);
  bus.off('session:exercise_changed', _renderActive);
  bus.off('session:state_changed',    _renderActive);
  bus.off('session:set_logged',       _renderSetList);
  bus.off('session:saved',            _onSessionSaved);
  bus.off('session:discarded',        _render);
}

// C-3 Fix: invalidate workouts cache on save
function _onSessionSaved() {
  _workoutsCache = null;
  _render();
}

async function _getCachedCustomTemplates() {
  if (_customTemplatesCache === null) {
    _customTemplatesCache = await db.getCustomTemplates();
  }
  return _customTemplatesCache ?? [];
}

// Get workouts with simple module-level cache (invalidated above)
async function _getCachedWorkouts() {
  if (!_workoutsCache) {
    _workoutsCache = await db.getWorkouts();
  }
  return _workoutsCache;
}

// ─── Top-level render ────────────────────────────────────────────────────────

function _render() {
  if (!_el) return;
  const snap = session.getSnapshot();
  if (snap.status === STATE.IDLE) {
    _renderBrowse();
  } else {
    _renderActive();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 1 — BROWSE
// ════════════════════════════════════════════════════════════════════════════

function _renderBrowse() {
  _el.innerHTML = `
    <div class="train-browse screen-in">

      ${_renderPPLCards()}

      <div class="search-wrap">
        <span class="material-symbols-outlined search-ico">search</span>
        <input
          class="search-input"
          id="search-input"
          type="text"
          placeholder="${_t('Search…', 'Поиск…')}"
          value="${_esc(_searchQuery)}"
          autocomplete="off"
        />
        ${_searchQuery ? `<span class="material-symbols-outlined search-clear" id="search-clear">close</span>` : ''}
      </div>

      ${_renderExerciseList()}

      <div style="height:20px"></div>
    </div>

    ${_renderBottomSheet()}
  `;

  _bindBrowse();
}

function _renderPPLCards() {
  if (_searchQuery) return '';

  const snap = session.getSnapshot();

  // PPL Templates с реальными сетчиками
  const pplTemplates = [
    {
      id: 'push',
      name: 'PUSH',
      nameRu: 'ПУШ',
      type: 'push',
      color: 'var(--push)',
      gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.04) 100%)',
    },
    {
      id: 'pull',
      name: 'PULL',
      nameRu: 'ПУЛЛ',
      type: 'pull',
      color: 'var(--pull)',
      gradient: 'linear-gradient(135deg, rgba(26,111,255,0.12) 0%, rgba(26,111,255,0.04) 100%)',
    },
    {
      id: 'legs',
      name: 'LEGS',
      nameRu: 'НОГИ',
      type: 'legs',
      color: 'var(--legs)',
      gradient: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 100%)',
    },
  ];

  // Calculate sets for each PPL type from current/last workout
  const getSetsForType = (type) => {
    // Get last workout of this type from localStorage
    try {
      const allWorkouts = JSON.parse(localStorage.getItem('fit_elite_workouts_cache') || '[]');
      const typeWorkouts = allWorkouts.filter(w => w.ppl_type === type);
      if (typeWorkouts.length === 0) return { done: 0, total: 0 };

      // Get most recent workout
      const last = typeWorkouts.sort((a, b) =>
        new Date(b.started_at) - new Date(a.started_at)
      )[0];

      const totalSets = (last.sets || []).length;
      return { done: totalSets, total: totalSets };
    } catch {
      return { done: 0, total: 0 };
    }
  };

  // If active session, use current session data
  const activeType = snap.status !== STATE.IDLE ? snap.ppl_type : null;
  const activeTotal = snap.exercises ? snap.exercises.reduce((acc, e) => acc + (e.sets || 0), 0) : 0;
  const activeDone = (snap.sets || []).length;

  return `
    <div class="ppl-cards-wrap">
      ${pplTemplates.map(tmpl => {
        const isActive = activeType === tmpl.type;
        const sets = isActive
          ? { done: activeDone, total: activeTotal }
          : getSetsForType(tmpl.type);
        const hasSets = sets.total > 0;

        return `
          <div class="ppl-card ppl-card-template" data-tmpl="${tmpl.id}"
               style="background:${tmpl.gradient}; border-color:${tmpl.color}40; ${isActive ? 'box-shadow:0 0 0 1px var(--p), 0 8px 24px rgba(0,200,110,0.15)' : ''}">
            <div class="ppl-card-header">
              ${hasSets ? `
                <span class="ppl-sets-counter" style="color:${sets.done >= sets.total ? 'var(--p)' : tmpl.color}">
                  ${sets.done}/${sets.total}
                </span>
              ` : '<span class="ppl-dot" style="background:' + tmpl.color + '"></span>'}
            </div>
            <div class="ppl-card-name" style="color:${isActive ? 'var(--p)' : tmpl.color}; font-size:1rem; font-weight:900; letter-spacing:.08em">
              ${_t(tmpl.name, tmpl.nameRu)}
            </div>
            <div class="ppl-card-sub">${_t('Template', 'Шаблон')}</div>
          </div>
        `;
      }).join('')}
      ${_renderCustomTemplateCards()}
      <div class="ppl-card ppl-card-add" id="add-custom-template">
        <div class="ppl-card-icon-add">
          <span class="material-symbols-outlined" style="font-size:28px; color:var(--t3)">add</span>
        </div>
        <div class="ppl-card-name" style="color:var(--t3); font-size:.75rem; font-weight:700">${_t('CUSTOM', 'СВОЙ')}</div>
      </div>
    </div>
  `;
}

function _renderExerciseList() {
  // Browse mode — no flat list, only PPL cards
  if (!_searchQuery) return '';

  const exList = Object.values(templates.exercises);
  let filtered = exList;

  // Filter by search
  const q = _searchQuery.toLowerCase();
  filtered = filtered.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.name_ru.toLowerCase().includes(q) ||
    e.muscles.some(m => m.includes(q))
  );

  // Filter by chip
  if (_activeChip !== 'all') {
    if (_activeChip === 'core') {
      filtered = filtered.filter(e => e.muscles.includes('core'));
    } else if (_activeSub) {
      filtered = filtered.filter(e => e.muscles.includes(_activeSub));
    } else {
      const chipDef = templates.muscle_chips[_activeChip];
      const chipMuscles = chipDef?.sub ?? [];
      filtered = filtered.filter(e => e.muscles.some(m => chipMuscles.includes(m)));
    }
  }

  if (!filtered.length) {
    return `<div class="empty-state">${_t('No exercises found', 'Упражнения не найдены')}</div>`;
  }

  // Group by primary muscle
  const byMuscle = {};
  filtered.forEach(e => {
    const muscle = e.muscles?.[0] || 'other';
    if (!byMuscle[muscle]) byMuscle[muscle] = [];
    byMuscle[muscle].push(e);
  });

  let html = `<div class="ex-list">`;
  for (const [muscle, list] of Object.entries(byMuscle)) {
    const muscleName = _t(muscle.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), muscle);
    html += `<div class="mg-block"><div class="mg-block-hdr">${muscleName}</div>`;
    html += list.map(e => {
      const color = 'var(--t3)';
      return `
        <div class="ex-item" data-ex="${e.id}">
          <div class="ex-item-bar" style="background:${color}"></div>
          <div class="ex-item-body">
            <div class="ex-item-name">${_lang === 'ru' ? e.name_ru : e.name}</div>
            <div class="ex-item-meta">${e.muscles.join(' · ')} · ${e.equipment}</div>
          </div>
          ${e.weighted_toggle ? `<span class="material-symbols-outlined ex-item-tag" title="Weighted">fitness_center</span>` : ''}
          ${e.timed ? `<span class="material-symbols-outlined ex-item-tag" title="Timed">timer</span>` : ''}
        </div>
      `;
    }).join('');
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ─── Custom Template Cards ────────────────────────────────────────────────────

function _renderCustomTemplateCards() {
  if (!_customTemplatesCache || _customTemplatesCache.length === 0) return '';

  return _customTemplatesCache.map(tmpl => {
    const exerciseCount = tmpl.muscle_groups?.reduce((a, mg) => a + (mg.exercises?.length || 0), 0) || 0;
    return `
      <div class="ppl-card ppl-card-custom" data-custom-id="${tmpl.id}"
           style="background:linear-gradient(135deg, rgba(0,200,110,0.10) 0%, rgba(0,200,110,0.03) 100%); border-color:rgba(0,200,110,0.35)">
        <div class="ppl-card-header">
          <button class="custom-del" data-custom-del="${tmpl.id}" title="${_t('Delete', 'Удалить')}">
            <span class="material-symbols-outlined" style="font-size:16px; color:var(--t3)">close</span>
          </button>
        </div>
        <div class="ppl-card-name" style="color:var(--p); font-size:.875rem; font-weight:700">${_esc(tmpl.name)}</div>
        <div class="ppl-card-sub">${exerciseCount} ${_t('exercises', 'упр.')}</div>
      </div>
    `;
  }).join('');
}

// ─── Bottom sheet (Today's Plan) ─────────────────────────────────────────────

let _sheetTemplateId = null;
let _sheetCustomData = null;

function _renderBottomSheet() {
  if (!_sheetTemplateId && !_sheetCustomData) return '';

  let t, color, isCustom;
  if (_sheetCustomData) {
    isCustom = true;
    t = _sheetCustomData;
    color = 'var(--p)';
  } else {
    isCustom = false;
    t = templates.templates[_sheetTemplateId];
    if (!t) return '';
    color = PPL_COLOR[t.type];
  }

  let idx = 0;

  return `
    <div class="sheet-overlay" id="sheet-overlay"></div>
    <div class="sheet" id="sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div>
          <div class="sheet-title">${_esc(t.name)}</div>
          <div class="sheet-sub" style="color:${color}">${_t(t.subtitle || '', t.subtitle_ru || '')}</div>
        </div>
        <button class="sheet-close" id="sheet-close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="sheet-body">
        ${t.muscle_groups.map(mg => `
          <div class="mg-block">
            <div class="mg-header" style="color:${color}">${_t(mg.name, mg.name_ru)}</div>
            ${mg.exercises.map(ex => {
              idx++;
              const def = templates.exercises[ex.exercise_id];
              const name = _lang === 'ru' && def?.name_ru ? def.name_ru : (def?.name ?? ex.exercise_id);
              const repsLabel = ex.duration_sec
                ? `${ex.sets}×${ex.duration_sec}s`
                : `${ex.sets}×${ex.reps}`;
              return `
                <div class="sheet-ex">
                  <span class="sheet-ex-num">${String(idx).padStart(2,'0')}</span>
                  <div class="sheet-ex-info">
                    <div class="sheet-ex-name">${name}</div>
                    <div class="sheet-ex-meta">${repsLabel}${ex.rotation ? ` · <span class="rotation-tag">${ex.rotation.label}</span>` : ''}${ex.weighted_toggle ? ` · <span class="weighted-tag">${_t('Weighted', 'Утяжелённый')}</span>` : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <div class="sheet-actions">
        <button class="sheet-start" id="sheet-start" style="background:${isCustom ? 'var(--p)' : (color === 'var(--pushL)' ? 'var(--push)' : color === 'var(--pullL)' ? 'var(--pull)' : 'var(--legs)')}">
          <span class="material-symbols-outlined fi">play_arrow</span>
          ${_t('Start Workout', 'Начать тренировку')}
        </button>
      </div>
    </div>
  `;
}

// ─── Browse bind ─────────────────────────────────────────────────────────────

function _bindBrowse() {
  // PPL Template Cards - открывают шаблон тренировки
  _el.querySelectorAll('.ppl-card-template').forEach(el => {
    el.addEventListener('click', () => {
      const tmplType = el.dataset.tmpl; // push, pull, legs
      _openPPLSheet(tmplType);
    });
  });

  // Custom template cards
  _el.querySelectorAll('.ppl-card-custom').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.customId;
      _openCustomSheet(id);
    });
  });
  _el.querySelectorAll('.custom-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await _deleteCustomTemplate(btn.dataset.customDel);
    });
  });

  // Custom template button - открывает конструктор шаблонов
  _el.querySelector('#add-custom-template')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _openTemplateBuilder();
  });

  // Search
  const inp = _el.querySelector('#search-input');
  if (inp) {
    inp.addEventListener('input', e => {
      _searchQuery = e.target.value;
      _renderBrowse();
    });
    inp.addEventListener('focus', () => {
      _activeChip = 'all';
      _activeSub  = null;
    });
  }
  _el.querySelector('#search-clear')?.addEventListener('click', () => {
    _searchQuery = '';
    _renderBrowse();
  });
  
  // Collapse toggle
  _el.querySelectorAll('.tgt-grp').forEach(hdr => {
    hdr.addEventListener('click', (e) => {
      const grp = e.currentTarget.dataset.grp;
      _searchExpanded[grp] = !_searchExpanded[grp];
      _renderBrowse();
    });
  });

  // Sheet already open
  _bindSheet();
}

function _openPPLSheet(pplType) {
  // Get first template of this type (push, pull, or legs)
  const template = Object.values(templates.templates).find(t => t.type === pplType);
  if (!template) {
    _showToast(_t('No template found for this type', 'Шаблон не найден'), 'err');
    return;
  }
  _sheetTemplateId = template.id;
  _renderBrowse();
  requestAnimationFrame(() => {
    _el.querySelector('#sheet')?.classList.add('sheet-open');
  });
  _bindSheet();
}

function _showToast(msg, type = 'info') {
  // Simple toast using bus
  bus.emit('toast', { msg, type });
}

// ─── Custom Template Builder ──────────────────────────────────────────────────

function _openTemplateBuilder() {
  // Get all exercises grouped by muscle group
  const exercisesByMuscle = {};
  Object.values(templates.exercises).forEach(ex => {
    ex.muscles.forEach(muscle => {
      if (!exercisesByMuscle[muscle]) exercisesByMuscle[muscle] = [];
      exercisesByMuscle[muscle].push(ex);
    });
  });

  const muscleGroups = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

  const html = `
    <div class="sheet-overlay" id="template-builder-overlay"></div>
    <div class="sheet" id="template-builder-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div>
          <div class="sheet-title">${_t('Create Custom Template', 'Создать шаблон')}</div>
          <div class="sheet-sub">${_t('Select exercises for your workout', 'Выберите упражнения')}</div>
        </div>
        <button class="sheet-close" id="template-builder-close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="sheet-body">
        ${muscleGroups.map(muscle => `
          <div class="mg-block">
            <div class="mg-header" style="text-transform:capitalize; color:var(--t2)">${_t(muscle, muscle)}</div>
            ${(exercisesByMuscle[muscle] || []).slice(0, 5).map(ex => {
              const name = _lang === 'ru' ? ex.name_ru : ex.name;
              return `
                <label class="template-ex-row" style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:0.5px solid var(--s3); cursor:pointer;">
                  <input type="checkbox" data-ex="${ex.id}" style="width:18px; height:18px; accent-color:var(--p)"/>
                  <span style="font-size:.8125rem; font-weight:600; color:var(--t1)">${name}</span>
                </label>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <div class="sheet-actions">
        <button class="sheet-start" id="template-builder-save" style="background:var(--p)">
          <span class="material-symbols-outlined fi">save</span>
          ${_t('Save Template', 'Сохранить')}
        </button>
      </div>
    </div>
  `;

  // Append to train screen
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  _el.appendChild(wrapper);

  requestAnimationFrame(() => {
    _el.querySelector('#template-builder-sheet')?.classList.add('sheet-open');
  });

  // Bind events
  _el.querySelector('#template-builder-overlay')?.addEventListener('click', _closeTemplateBuilder);
  _el.querySelector('#template-builder-close')?.addEventListener('click', _closeTemplateBuilder);
  _el.querySelector('#template-builder-save')?.addEventListener('click', () => {
    const selected = Array.from(_el.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.dataset.ex);
    if (selected.length === 0) {
      _showToast(_t('Select at least one exercise', 'Выберите хотя бы одно упражнение'), 'err');
      return;
    }
    _saveCustomTemplate(selected);
  });
}

function _closeTemplateBuilder() {
  const sheet = _el.querySelector('#template-builder-sheet');
  const overlay = _el.querySelector('#template-builder-overlay');
  if (sheet) sheet.classList.remove('sheet-open');
  setTimeout(() => {
    sheet?.remove();
    overlay?.remove();
  }, 300);
}

async function _saveCustomTemplate(exerciseIds) {
  const templateName = prompt(_t('Enter template name:', 'Название шаблона:'), 'My Custom Workout');
  if (!templateName) return;

  // Group exercises by primary muscle for muscle_groups structure
  const byMuscle = {};
  for (const exId of exerciseIds) {
    const ex = templates.exercises[exId];
    const muscle = ex?.muscles?.[0] || 'other';
    if (!byMuscle[muscle]) byMuscle[muscle] = [];
    byMuscle[muscle].push({ exercise_id: exId, sets: 3, reps: 10, rotation: null });
  }

  const newTemplate = {
    id: 'custom_' + Date.now(),
    name: templateName,
    name_ru: templateName,
    type: 'custom',
    subtitle: 'Custom template',
    subtitle_ru: 'Пользовательский',
    muscle_groups: Object.entries(byMuscle).map(([muscle, exs]) => ({
      id: muscle, name: muscle, name_ru: muscle, exercises: exs
    })),
    created_at: new Date().toISOString()
  };

  await db.saveCustomTemplate(newTemplate);
  _customTemplatesCache = null;
  _closeTemplateBuilder();
  _showToast(_t('Template saved!', 'Шаблон сохранён!'), 'ok');
  setTimeout(() => _renderBrowse(), 300);
}

function _bindSheet() {
  _el.querySelector('#sheet-overlay')?.addEventListener('click', _closeSheet);
  _el.querySelector('#sheet-close')?.addEventListener('click', _closeSheet);
  _el.querySelector('#sheet-start')?.addEventListener('click', () => {
    if (!_sheetTemplateId) return;
    _closeSheet();
    session.start(_sheetTemplateId);
  });
}

function _closeSheet() {
  _sheetTemplateId = null;
  _renderBrowse();
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 2 — ACTIVE SESSION
// ════════════════════════════════════════════════════════════════════════════

function _renderActive() {
  if (!_el) return;
  const snap = session.getSnapshot();

  _el.innerHTML = `
    <div class="train-active screen-in">

      ${_renderTopBar(snap)}
      ${_renderExNav(snap)}
      ${_renderExHeader(snap)}
      ${_renderTimer()}
      ${_renderSetSection(snap)}
      ${_renderVolumeSummary(snap)}

      <div style="height:120px"></div>
    </div>

    ${_renderFAB()}
    ${_renderSummaryModal(snap)}
  `;

  _bindActive();
  _startTimer();
}

function _renderTopBar(snap) {
  return `
    <div class="active-top">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="back-btn" id="back-btn">
          <span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>
        </div>
        <span class="sess-time" id="sess-time">${_fmtTime(snap.elapsed_sec)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <button class="fin-btn ${_finishStep === 1 ? 'fin-btn-confirm' : ''}" id="fin-btn">
          ${_finishStep === 1
            ? _t('Skip Ex?', 'Пропустить?')
            : _t('Finish', 'Завершить')}
        </button>
      </div>
    </div>
  `;
}

function _renderExNav(snap) {
  const exs = snap.exercises;
  const cur  = snap.block_index;
  return `
    <div class="ex-nav-wrap">
      <div class="ex-nav">
        ${exs.map((ex, i) => {
          const def    = templates.exercises[ex.exercise_id];
          const name   = _lang === 'ru' ? def?.name_ru : def?.name;
          const doneSets = snap.sets.filter(s => s.exercise_id === ex.exercise_id).length;
          const cls    = i === cur ? 'en-item on' : i < cur ? 'en-item done' : 'en-item next';
          return `
            <div class="${cls}" data-nav-ex="${i}">
              <div class="en-dot"></div>
              <div class="en-name">${(name ?? '').split(' ').slice(0,2).join(' ')}</div>
              <div class="en-sets">${doneSets}/${ex.sets}</div>
            </div>
          `;
        }).join('')}
        <button class="en-item en-add">
          <span class="material-symbols-outlined" style="font-size:18px">add</span>
        </button>
      </div>
    </div>
  `;
}

function _renderExHeader(snap) {
  const def = snap.current_exercise_def;
  if (!def) return '';
  const name  = _lang === 'ru' ? def.name_ru : def.name;
  const pplColor = PPL_COLOR[snap.ppl_type] ?? 'var(--p)';

  // Last best set for this exercise
  const prevSets = snap.sets.filter(s => s.exercise_id === snap.resolved_exercise_id);
  const prevBest = prevSets.length ? prevSets.reduce((a, b) => b.kg > a.kg ? b : a) : null;

  return `
    <div class="ex-hdr">
      <div class="ex-tags">
        <span class="tag" style="background:${pplColor}18;color:${pplColor};border-color:${pplColor}44">
          ${_t(snap.template_name ?? '', snap.template_name ?? '')}
        </span>
        <span class="tag tag-type">${def.equipment}</span>
        ${def.weighted_toggle ? `<span class="tag tag-weighted">${_t('Weighted', 'Утяжелённый')}</span>` : ''}
        ${def.timed ? `<span class="tag tag-timed">${_t('Timed', 'На время')}</span>` : ''}
      </div>
      <div class="ex-title">${name}</div>
      ${prevBest ? `
        <div class="prev-best">
          <span class="material-symbols-outlined fi" style="font-size:14px;color:var(--warn)">emoji_events</span>
          ${_t('Best this session', 'Лучший в сессии')}: <strong>${prevBest.kg} kg × ${prevBest.reps}</strong>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function _renderTimer() {
  const state = _timerSecs <= 0 ? 'done'
    : _timerSecs <= 15 ? 'warning'
    : _timerRunning ? 'active' : 'idle';

  const circ  = 2 * Math.PI * 70;
  const pct   = Math.max(0, _timerSecs / _timerMax);
  const offset= circ * (1 - pct);
  const stroke= state === 'warning' ? '#ffb347' : state === 'done' ? '#29b6c8' : '#00c86e';
  const displayClass = state === 'active' ? 'active'
    : state === 'warning' ? 'warning' : '';

  if (_timerMinimized) {
    const pct   = Math.max(0, _timerSecs / _timerMax);
    return `
      <div class="tmr-card-ultra" id="tmr-card">
        <div class="tmr-ultra-fill ${state}" id="tmr-ultra-fill" style="transform: scaleX(${pct})"></div>
        <div class="tmr-ultra-text ${state}" id="tmr-display">
          ${_timerSecs <= 0 ? 'GO!' : _fmtTime(_timerSecs)}
        </div>
      </div>
    `;
  }

  return `
    <div class="tmr-card ${state === 'active' ? 'active' : state === 'warning' ? 'warning' : ''}" id="tmr-card">
      <span class="tmr-label">${_t('Rest Timer', 'Таймер отдыха')}</span>
      <div class="tmr-ring-wrap">
        <svg class="tmr-ring" width="160" height="160" viewBox="0 0 160 160">
          <circle class="ring-bg" cx="80" cy="80" r="70"/>
          <circle class="ring-fill" cx="80" cy="80" r="70"
            id="ring-fill"
            stroke="${stroke}"
            stroke-dasharray="${circ.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <div class="tmr-display ${displayClass}" id="tmr-display">
          ${_timerSecs <= 0 ? 'GO!' : _fmtTime(_timerSecs)}
        </div>
      </div>
      <div class="tmr-actions">
        <button class="tmr-btn" id="tmr-minus">−30s</button>
        <button class="tmr-btn tmr-play" id="tmr-play">
          <span class="material-symbols-outlined fi" id="tmr-ico">${_timerRunning ? 'pause' : 'play_arrow'}</span>
        </button>
        <button class="tmr-btn" id="tmr-skip">${_t('Skip', 'Пропустить')}</button>
        <button class="tmr-btn" id="tmr-plus">+30s</button>
      </div>
    </div>
  `;
}

// ─── Set logger ──────────────────────────────────────────────────────────────

function _renderSetSection(snap) {
  const ex        = snap.current_exercise;
  const totalSets = ex?.sets ?? 4;
  const doneSets  = snap.sets.filter(s => s.exercise_id === snap.resolved_exercise_id);
  const activeIdx = doneSets.length; // 0-based index of active set

  return `
    <div class="set-sect">
      <div class="set-hdr" style="display:flex; align-items:center;">
        <span class="set-title">${_t('Sets', 'Подходы')}</span>
        <div style="margin-left:auto; display:flex; gap:16px; align-items:center;">
          <span class="set-add" id="set-fill" style="color:var(--t3); display:flex; gap:4px; font-size:.4375rem; text-transform:uppercase" title="${_t('Fill from history', 'Заполнить из истории')}">
            <span class="material-symbols-outlined" style="font-size:14px">history</span>
            ${_t('Fill', 'Заполнить')}
          </span>
          <span class="set-add" id="set-add" style="display:flex; gap:4px; font-size:.4375rem; text-transform:uppercase">
            <span class="material-symbols-outlined" style="font-size:14px">add</span>
            ${_t('Add', 'Добавить')}
          </span>
        </div>
      </div>

      <div class="set-cols">
        <div class="set-col-lbl">#</div>
        <div class="set-col-lbl">${_t('KG', 'КГ')}</div>
        <div class="set-col-lbl">${_t('REPS', 'ПОВ')}</div>
        <div class="set-col-lbl">${_t('RPE', 'РПЕ')}</div>
        <div class="set-col-lbl"></div>
      </div>

      <div class="set-list" id="set-list">
        ${Array.from({ length: totalSets }, (_, i) => _renderSetRow(i, doneSets, activeIdx, snap)).join('')}
      </div>
    </div>
  `;
}

function _renderSetRow(i, doneSets, activeIdx, snap) {
  const num = String(i + 1).padStart(2, '0');

  if (i < doneSets.length) {
    // Done or PR - с lock кнопкой
    const s   = doneSets[i];
    const isPR = _checkPR(s, doneSets.slice(0, i));
    return `
      <div class="set-row ${isPR ? 'pr' : 'done'}" data-set-idx="${i}">
        <div class="set-num">${num}</div>
        <div class="set-val-wrap">
          <input class="set-in" type="number" value="${units.displayWeight(s.kg)}" disabled/>
          <span class="set-unit">${units.getUnit()}</span>
        </div>
        <div class="set-val-wrap">
          <input class="set-in" type="number" value="${s.reps}" disabled/>
          <span class="set-unit">${_t('reps','пов')}</span>
        </div>
        <div class="set-val-wrap">
          <input class="set-in" type="number" value="${s.rpe ?? '—'}" disabled/>
          <span class="set-unit">rpe</span>
        </div>
        <button class="lock-btn" data-lock-idx="${i}" title="${_t('Unlock set', 'Разблокировать')}">
          <span class="material-symbols-outlined" style="font-size:14px">lock</span>
        </button>
      </div>
    `;
  }

  if (i === activeIdx) {
    // Active row - с зелёной рамкой
    const prevSet = doneSets[doneSets.length - 1];
    const def = snap.current_exercise_def;
    const canBW = def.equipment === 'bodyweight' || def.weighted_toggle;
    const hideKg = canBW && !_setDraftIsWeighted;

    return `
      <div class="set-row active" id="active-row" style="flex-wrap:wrap">
        <div class="set-num active-n">${num}</div>
        <div class="set-val-wrap" style="transition:opacity var(--tb); opacity:${hideKg ? '0' : '1'}; pointer-events:${hideKg ? 'none' : 'auto'}">
          <input class="set-in active-i" id="draft-kg" type="number"
            placeholder="${units.getUnit()}" value="${_esc(_setDraftKg)}" inputmode="decimal" step="${units.isLbs() ? '5' : '2.5'}" min="0"/>
          ${prevSet ? `<span class="set-prev p-ok" style="margin-top:2px">prev ${units.displayWeight(prevSet.kg)}</span>` : ''}
        </div>
        <div class="set-val-wrap">
          <input class="set-in active-i" id="draft-reps" type="number"
            placeholder="${_t('reps','пов')}" value="${_esc(_setDraftReps)}" inputmode="numeric"/>
          ${prevSet ? `<span class="set-prev p-ok" style="margin-top:2px">prev ${prevSet.reps}</span>` : ''}
        </div>
        <div class="set-val-wrap">
          <input class="set-in active-i" id="draft-rpe" type="number"
            placeholder="rpe" value="${_esc(_setDraftRpe)}" min="1" max="10" inputmode="numeric"/>
          ${prevSet?.rpe != null ? `<span class="set-prev" style="margin-top:2px">prev ${prevSet.rpe}</span>` : ''}
        </div>
        <button class="lock-btn" data-lock-active="true" title="${_t('Lock set', 'Заблокировать')}">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--p)">lock_open</span>
        </button>

        ${canBW ? `
          <label style="flex-basis:100%; display:flex; align-items:center; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(0,200,110,.15); cursor:pointer">
            <input type="checkbox" id="bw-toggle" ${_setDraftIsWeighted ? 'checked' : ''} style="accent-color:var(--p);width:16px;height:16px">
            <span style="font-size:.625rem; font-weight:700; color:var(--t2)">${_t('Weighted', 'Отягощение')}</span>
          </label>
        ` : ''}
      </div>
    `;
  }

  // Locked
  return `
    <div class="set-row locked" data-set-idx="${i}">
      <div class="set-num">${num}</div>
      <div class="set-val-wrap"><span class="locked-dash">—</span></div>
      <div class="set-val-wrap"><span class="locked-dash">—</span></div>
      <div class="set-val-wrap"><span class="locked-dash">—</span></div>
      <button class="lock-btn" data-lock-idx="${i}" title="${_t('Unlock set', 'Разблокировать')}">
        <span class="material-symbols-outlined" style="font-size:14px">lock</span>
      </button>
    </div>
  `;
}

function _renderSetList() {
  const setList = _el?.querySelector('#set-list');
  if (!setList) return;
  const snap      = session.getSnapshot();
  const ex        = snap.current_exercise;
  const totalSets = ex?.sets ?? 4;
  const doneSets  = snap.sets.filter(s => s.exercise_id === snap.resolved_exercise_id);
  const activeIdx = doneSets.length;
  setList.innerHTML = Array.from(
    { length: totalSets },
    (_, i) => _renderSetRow(i, doneSets, activeIdx, snap)
  ).join('');
  _bindSetRows();
}

function _renderVolumeSummary(snap) {
  const total   = snap.sets.reduce((a, s) => a + s.kg * s.reps, 0);
  const done    = snap.sets.length;
  const allSets = snap.exercises.reduce((a, e) => a + e.sets, 0);
  return `
    <div class="vol-summary">
      <div class="vol-item">
        <div class="vol-val" style="color:var(--p)">${units.displayWeight(total).toLocaleString()}<span class="vol-unit">${units.getUnit()}</span></div>
        <div class="vol-lbl">${_t('Volume', 'Объём')}</div>
      </div>
      <div class="vol-item">
        <div class="vol-val">${done}<span class="vol-unit">/ ${allSets}</span></div>
        <div class="vol-lbl">${_t('Sets', 'Подходы')}</div>
      </div>
      <div class="vol-item">
        <div class="vol-val" style="color:var(--warn)">${_fmtTime(snap.elapsed_sec)}</div>
        <div class="vol-lbl">${_t('Time', 'Время')}</div>
      </div>
    </div>
  `;
}

function _renderFAB() {
  return `
    <div class="fab-wrap">
      <button class="fab-btn" id="fab-btn">
        <span class="material-symbols-outlined fi">check_circle</span>
        ${_t('Finish Set', 'Завершить подход')}
      </button>
    </div>
  `;
}

function _renderSummaryModal(snap) {
  if (snap.status !== STATE.SUMMARY) return '';
  const total   = snap.sets.reduce((a, s) => a + s.kg * s.reps, 0);
  const elapsed = _fmtTime(snap.elapsed_sec);
  return `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <div class="modal-title">${_t('Workout Complete', 'Тренировка завершена')}</div>
        <div class="modal-rows">
          <div class="modal-row">
            <span class="modal-key">${_t('Total time', 'Общее время')}</span>
            <span class="modal-val" style="color:var(--p)">${elapsed}</span>
          </div>
          <div class="modal-row">
            <span class="modal-key">${_t('Volume', 'Объём')}</span>
            <span class="modal-val">${units.displayWeight(total).toLocaleString()} ${units.getUnit()}</span>
          </div>
          <div class="modal-row">
            <span class="modal-key">${_t('Sets logged', 'Подходов')}</span>
            <span class="modal-val">${snap.sets.length}</span>
          </div>
          <div class="modal-row">
            <span class="modal-key">${_t('Core', 'Кор')}</span>
            <span class="modal-val">${snap.core_name ?? '—'}</span>
          </div>
        </div>
        <div class="modal-btns">
          <button class="modal-btn modal-discard" id="modal-discard">
            ${_t('Discard', 'Отменить')}
          </button>
          <button class="modal-btn modal-save" id="modal-save">
            ${_t('Save', 'Сохранить')}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─── Active bind ─────────────────────────────────────────────────────────────

function _bindActive() {
  // H-4 Fix: Back button — pause workout and go Home; user returns via Dynamic Island tap
  _el.querySelector('#back-btn')?.addEventListener('click', () => {
    session.pause();
    _showToast(_t('Workout paused — tap Island to return', 'Пауза — нажми на остров для возврата'), 'info');
    bus.emit('nav:switch', { screen: 'home' });
  });

  // Finish button — double confirm
  _el.querySelector('#fin-btn')?.addEventListener('click', _handleFinish);

  // FAB
  _el.querySelector('#fab-btn')?.addEventListener('click', _handleFinishSet);

  // Timer controls
  _el.querySelector('#tmr-minus')?.addEventListener('click', (e) => { e.stopPropagation(); _addTime(-30); });
  _el.querySelector('#tmr-plus')?.addEventListener('click', (e) => { e.stopPropagation(); _addTime(30); });
  _el.querySelector('#tmr-skip')?.addEventListener('click', (e) => { e.stopPropagation(); _skipTimer(); });
  _el.querySelector('#tmr-play')?.addEventListener('click', (e) => { e.stopPropagation(); _toggleTimer(); });

  const tmrCard = _el.querySelector('#tmr-card');
  if (tmrCard) {
    let pressTimer = null;
    let isLong = false;
    tmrCard.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      isLong = false;
      pressTimer = setTimeout(() => {
        isLong = true;
        bus.emit('nav:switch', { screen: 'profile' });
      }, 600);
    });
    tmrCard.addEventListener('pointerup', (e) => {
      if (e.target.closest('button')) return;
      clearTimeout(pressTimer);
      if (!isLong) {
        _timerMinimized = !_timerMinimized;
        _renderActive();
      }
    });
    tmrCard.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    tmrCard.addEventListener('pointerleave', () => clearTimeout(pressTimer));
  }

  // Draft inputs
  _el.querySelector('#draft-kg')?.addEventListener('input', e => { _setDraftKg = e.target.value; });
  _el.querySelector('#draft-reps')?.addEventListener('input', e => { _setDraftReps = e.target.value; });
  _el.querySelector('#draft-rpe')?.addEventListener('input', e => { _setDraftRpe = e.target.value; });

  // Add set
  _el.querySelector('#set-add')?.addEventListener('click', () => {
    // M-7 Fix: informative feedback instead of silent noop
    _showToast(_t('Extra sets: finish current set first', 'Сначала заверши текущий подход'), 'info');
  });

  // C-3 Fix: Fill button reads from IndexedDB (not nonexistent localStorage cache)
  _el.querySelector('#set-fill')?.addEventListener('click', async () => {
    const snap = session.getSnapshot();
    const eid  = snap.resolved_exercise_id;
    if (!eid) return;

    const allWorkouts = await _getCachedWorkouts();
    let lastSets = [];
    for (const w of allWorkouts) {
      if (w.sets) {
        const exSets = w.sets.filter(s => s.exercise_id === eid);
        if (exSets.length > 0) { lastSets = exSets; break; }
      }
    }

    if (lastSets.length > 0) {
      const doneSets = snap.sets.filter(s => s.exercise_id === eid).length;
      const target   = lastSets[doneSets] || lastSets[lastSets.length - 1];
      if (target) {
        _setDraftKg   = target.kg;
        _setDraftReps = target.reps;
        _setDraftRpe  = target.rpe || '';
        _setDraftIsWeighted = _setDraftKg > 0;

        const inKg   = _el.querySelector('#draft-kg');
        const inReps = _el.querySelector('#draft-reps');
        const inRpe  = _el.querySelector('#draft-rpe');
        if (inKg)   inKg.value   = units.displayWeight(_setDraftKg);
        if (inReps) inReps.value = _setDraftReps;
        if (inRpe)  inRpe.value  = _setDraftRpe;

        const def = snap.current_exercise_def;
        if (def && (def.equipment === 'bodyweight' || def.weighted_toggle)) {
          _renderSetList();
        }
        _showToast(_t('Filled from history', 'Заполнено из истории'), 'ok');
      }
    } else {
      _showToast(_t('No history for this exercise', 'Нет истории по упражнению'), 'info');
    }
  });

  _el.querySelector('#bw-toggle')?.addEventListener('change', (e) => {
    _setDraftIsWeighted = e.target.checked;
    if (!_setDraftIsWeighted) {
      _setDraftKg = '';
    }
    _renderSetList();
  });

  // Set rows
  _bindSetRows();

  // Summary modal
  _el.querySelector('#modal-save')?.addEventListener('click', async () => {
    await session.save();
    bus.emit('nav:switch', { screen: 'home' });
  });
  _el.querySelector('#modal-discard')?.addEventListener('click', () => {
    if (confirm(_t('Discard workout? Data will be lost.', 'Отменить тренировку? Данные удалятся.'))) {
      session.discard();
      bus.emit('nav:switch', { screen: 'home' });
    }
  });
}

function _bindSetRows() {
  // Lock buttons
  _el.querySelectorAll('.lock-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lockIdx = btn.dataset.lockIdx;
      const lockActive = btn.dataset.lockActive;

      if (lockActive !== undefined) {
        // Lock current active set - logs it directly!
        _handleFinishSet(true);
      } else if (lockIdx !== undefined) {
        // Unlock a done/locked set for editing
        const row = btn.closest('.set-row');
        _unlockSetRow(row);
      }
    });
  });

  // Double-tap done rows to edit
  _el.querySelectorAll('.set-row.done, .set-row.pr').forEach(row => {
    let taps = 0;
    row.addEventListener('click', () => {
      taps++;
      if (taps === 2) {
        taps = 0;
        _unlockSetRow(row);
      } else {
        setTimeout(() => { taps = 0; }, 400);
      }
    });
  });
}

function _unlockSetRow(row) {
  const idx = parseInt(row.dataset.setIdx ?? '-1', 10);
  if (idx < 0) return;
  const snap    = session.getSnapshot();
  const doneSets= snap.sets.filter(s => s.exercise_id === snap.resolved_exercise_id);
  const s       = doneSets[idx];
  if (!s) return;

  row.className = 'set-row active';
  row.innerHTML = `
    <div class="set-num active-n">${String(idx + 1).padStart(2,'0')}</div>
    <div class="set-val-wrap">
      <input class="set-in active-i edit-kg" type="number" value="${s.kg}" inputmode="decimal" step="2.5" min="0"/>
      <span class="set-unit" style="color:var(--p)">${_t('kg','кг')}</span>
    </div>
    <div class="set-val-wrap">
      <input class="set-in active-i edit-reps" type="number" value="${s.reps}" inputmode="numeric"/>
      <span class="set-unit" style="color:var(--p)">${_t('reps','пов')}</span>
    </div>
    <div class="set-val-wrap">
      <input class="set-in active-i edit-rpe" type="number" value="${s.rpe ?? ''}" inputmode="numeric"/>
      <span class="set-unit" style="color:var(--p)">rpe</span>
    </div>
    <button class="edit-save-btn lock-btn" data-edit-idx="${idx}" style="cursor:pointer;background:transparent;border:none">
      <span class="material-symbols-outlined fi" style="font-size:16px;color:var(--p)">lock_open</span>
    </button>
  `;

  row.querySelector('.edit-save-btn')?.addEventListener('click', () => {
    const kg   = parseFloat(row.querySelector('.edit-kg')?.value)    || s.kg;
    const reps = parseInt(row.querySelector('.edit-reps')?.value, 10) || s.reps;
    const rpe  = parseFloat(row.querySelector('.edit-rpe')?.value)   || s.rpe;
    // C-4 Fix: use official session.editSet() instead of direct mutation
    session.editSet(snap.resolved_exercise_id, idx, { kg, reps, rpe });
    _renderSetList();
  });
}


// ─── Finish set ──────────────────────────────────────────────────────────────

function _handleFinishSet(fromLock = false) {
  if (fromLock) {
    _logActiveSetAndAdvance();
    return;
  }

  const fab = _el.querySelector('#fab-btn');
  _fabTaps++;

  if (_fabTaps === 1) {
    // Show FINISH state temporarily
    if (fab) {
      fab.innerHTML = `<span class="material-symbols-outlined fi">keyboard_double_arrow_right</span> FINISH`;
      // Restore state after 600ms if no second tap
      _fabTimer = setTimeout(() => {
        _fabTaps = 0;
        if (_el && _el.contains(fab)) {
          fab.innerHTML = `<span class="material-symbols-outlined fi">check_circle</span> ${_t('Finish Set', 'Завершить подход')}`;
        }
      }, 600);
    }

    _logActiveSetAndAdvance();
  } else if (_fabTaps >= 2) {
    // Ignore double tap on FAB now that pink button handles it
    _fabTaps = 1;
  }
}

function _logActiveSetAndAdvance() {
  let kgStr = _el.querySelector('#draft-kg')?.value;
  let kg = units.parseWeight(kgStr);
  const reps = parseInt(_el.querySelector('#draft-reps')?.value, 10);
  const rpe  = parseFloat(_el.querySelector('#draft-rpe')?.value) || null;

  const snap     = session.getSnapshot();
  const def      = snap.current_exercise_def;
  const canBW    = def && (def.equipment === 'bodyweight' || def.weighted_toggle);

  if (canBW && !_setDraftIsWeighted) {
    kg = 0; // bodyweight
  }

  if ((isNaN(kg) || kg <= 0) && (!canBW || _setDraftIsWeighted)) {
    if ((isNaN(kg) || kg <= 0) && (!canBW || _setDraftIsWeighted)) _el.querySelector('#draft-kg')?.classList.add('input-error');
    _el.querySelector('#draft-reps')?.classList.add('input-error');
    return;
  }

  _setDraftKg = ''; _setDraftReps = ''; _setDraftRpe = '';
  session.logSet({ kg, reps, rpe });

  // Check if all sets done for this exercise
  const doneSets = snap.sets.filter(s => s.exercise_id === snap.resolved_exercise_id).length + 1; // +1 since we just logged
  const totalSets= snap.current_exercise?.sets ?? 0;

  if (doneSets >= totalSets) {
    // Auto-advance after short delay
    setTimeout(() => session.nextExercise(), 600);
  } else {
    // Restart rest timer
    _timerSecs   = _timerMax;
    _timerRunning= true;
    clearInterval(_timerTick);
    _timerTick = setInterval(_tickTimer, 1000);
    _updateTimerUI();
  }
}

// ─── Finish workout ──────────────────────────────────────────────────────────

function _handleFinish() {
  const btn = _el.querySelector('#fin-btn');
  if (!btn) return;

  if (_finishStep === 0) {
    _finishStep = 1;
    btn.classList.add('fin-btn-confirm');
    btn.textContent = _t('Skip Ex?', 'Пропустить?');
    clearTimeout(_finishTimer);
    _finishTimer = setTimeout(() => {
      _finishStep = 0;
      if (btn) {
        btn.classList.remove('fin-btn-confirm');
        btn.textContent = _t('Finish', 'Завершить');
      }
    }, 3000);
  } else if (_finishStep === 1) {
    _finishStep = 0;
    clearTimeout(_finishTimer);
    btn.classList.remove('fin-btn-confirm');
    btn.textContent = _t('Finish', 'Завершить');

    _skipCount++;
    
    if (_skipCount >= 3) {
      if (confirm(_t('Finish the entire workout early?', 'Завершить всю тренировку досрочно?'))) {
        _skipCount = 0;
        _stopTimer();
        session.completeStretch();
        _renderActive();
        return;
      } else {
        _skipCount = 0; // reset to allow continuing
      }
    }
    
    session.nextExercise();
  }
}

// ─── Timer logic ─────────────────────────────────────────────────────────────

function _startTimer() {
  if (_timerRunning) return;
  _timerRunning = true;
  clearInterval(_timerTick);
  _timerTick = setInterval(_tickTimer, 1000);
}

function _stopTimer() {
  clearInterval(_timerTick);
  _timerTick    = null;
  _timerRunning = false;
}

// H-3 Fix: called at mount() to prevent stale state from previous session
function _resetTimerState() {
  clearInterval(_timerTick);
  _timerSecs      = 90;
  _timerMax       = 90;
  _timerRunning   = false;
  _timerTick      = null;
  _timerMinimized = false;
  _setDraftKg     = '';
  _setDraftReps   = '';
  _setDraftRpe    = '';
  _setDraftIsWeighted = false;
  _finishStep     = 0;
  _skipCount      = 0;
  _fabTaps        = 0;
  clearTimeout(_finishTimer);
  clearTimeout(_fabTimer);
}


function _tickTimer() {
  if (!_timerRunning || _timerSecs <= 0) {
    _timerRunning = false;
    clearInterval(_timerTick);
    _updateTimerUI();
    return;
  }
  _timerSecs--;
  _updateTimerUI();
}

function _toggleTimer() {
  _timerRunning = !_timerRunning;
  if (_timerRunning) {
    _timerTick = setInterval(_tickTimer, 1000);
  } else {
    clearInterval(_timerTick);
  }
  _updateTimerUI();
}

function _addTime(delta) {
  _timerSecs = Math.max(0, Math.min(600, _timerSecs + delta));
  _timerMax  = Math.max(_timerMax, _timerSecs);
  _updateTimerUI();
}

function _skipTimer() {
  _timerSecs    = 0;
  _timerRunning = false;
  clearInterval(_timerTick);
  _updateTimerUI();
}

function _updateTimerUI() {
  const display = _el?.querySelector('#tmr-display');
  const card    = _el?.querySelector('#tmr-card');
  const fill    = _el?.querySelector('#ring-fill');
  const ico     = _el?.querySelector('#tmr-ico');
  const ultraFill = _el?.querySelector('#tmr-ultra-fill');
  if (!display) return;

  const state = _timerSecs <= 0 ? 'done'
    : _timerSecs <= 15 ? 'warning'
    : _timerRunning ? 'active' : 'idle';

  display.textContent = _timerSecs <= 0 ? 'GO!' : _fmtTime(_timerSecs);
  if (_timerMinimized) {
    display.className = `tmr-ultra-text ${state}`;
  } else {
    display.className = `tmr-display ${state === 'active' ? 'active' : state === 'warning' ? 'warning' : ''}`;
  }

  if (card) {
    if (_timerMinimized) {
      card.className = `tmr-card-ultra`;
    } else {
      card.className = `tmr-card ${state === 'active' ? 'active' : state === 'warning' ? 'warning' : ''}`;
    }
  }

  if (ultraFill) {
    const pct = Math.max(0, _timerSecs / _timerMax);
    ultraFill.style.transform = `scaleX(${pct})`;
    ultraFill.className = `tmr-ultra-fill ${state}`;
  }

  if (fill) {
    const circ   = 2 * Math.PI * 70;
    const pct    = Math.max(0, _timerSecs / _timerMax);
    fill.style.strokeDashoffset = (circ * (1 - pct)).toFixed(1);
    fill.style.stroke = state === 'warning' ? '#ffb347'
      : state === 'done' ? '#29b6c8' : '#00c86e';
  }

  if (ico) {
    ico.textContent = _timerRunning ? 'pause' : 'play_arrow';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _t(en, ru) { return _lang === 'ru' ? ru : en; }
function _esc(s) { return String(s ?? '').replace(/"/g, '&quot;'); }
function _fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _checkPR(set, prev) {
  if (!prev.length) return false;
  return prev.every(p => set.kg >= p.kg);
}

export default { mount, unmount };
