import sync from './sync.js';
import templates from '../data/templates.json' with { type: 'json' };
import { bus } from './bus.js';
import { db } from './db.js';

/**
 * session.js
 * State machine: IDLE → TRAINING → CORE → STRETCH → SUMMARY
 * Smart Core rotation: least-used of A/B/C
 * All data lives in memory until Save → db.js writes to IndexedDB
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const STATE = {
  IDLE:     'IDLE',
  TRAINING: 'TRAINING',
  CORE:     'CORE',
  STRETCH:  'STRETCH',
  SUMMARY:  'SUMMARY',
  PAUSED:   'PAUSED',
};

const TICK_INTERVAL_MS = 1000;

// ─── Internal state ───────────────────────────────────────────────────────────

let _state = {
  status:       STATE.IDLE,
  ppl_type:     null,
  template_id:  null,
  core_id:      null,
  stretch_id:   null,
  started_at:   null,
  paused_at:    null,
  elapsed_sec:  0,
  block_index:  0,
  set_index:    1,
  sets:         [],
  rotations:    {},
  core_usage:   { core_a: 0, core_b: 0, core_c: 0 },
};

let _ticker = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _emit(event, payload = {}) {
  bus.emit(event, { ...payload, snapshot: getSnapshot() });
}

function _tick() {
  if (_state.status !== STATE.TRAINING &&
      _state.status !== STATE.CORE &&
      _state.status !== STATE.STRETCH) return;
  _state.elapsed_sec += 1;
  bus.emit('session:tick', { elapsed_sec: _state.elapsed_sec });
}

function _startTicker() {
  if (_ticker) return;
  _ticker = setInterval(_tick, TICK_INTERVAL_MS);
}

function _stopTicker() {
  clearInterval(_ticker);
  _ticker = null;
}

function _pickCore(usage) {
  const entries = Object.entries(usage);
  entries.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

function _resolveExercise(templateId, blockIndex) {
  const tmpl = templates.templates[templateId];
  if (!tmpl) return null;
  const all = [];
  for (const mg of tmpl.muscle_groups) {
    for (const ex of mg.exercises) all.push(ex);
  }
  const entry = all[blockIndex];
  if (!entry) return null;
  if (!entry.rotation) return entry.exercise_id;
  const current = _state.rotations[entry.exercise_id];
  if (!current || current === 'variant_b') return entry.exercise_id;
  return entry.rotation.with;
}

function _flattenTemplate(templateId) {
  const tmpl = templates.templates[templateId];
  if (!tmpl) return [];
  const list = [];
  for (const mg of tmpl.muscle_groups) {
    for (const ex of mg.exercises) {
      list.push({ ...ex, muscle_group: mg.id, muscle_group_name: mg.name });
    }
  }
  return list;
}

function _flattenCore(coreId) {
  const core = templates.core[coreId];
  if (!core) return [];
  return core.exercises.map(ex => ({ ...ex, muscle_group: 'core', muscle_group_name: 'Core' }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSnapshot() {
  const tmpl = _state.template_id ? templates.templates[_state.template_id] : null;
  const core = _state.core_id     ? templates.core[_state.core_id]         : null;
  const exercises     = _state.template_id ? _flattenTemplate(_state.template_id) : [];
  const coreExercises = _state.core_id     ? _flattenCore(_state.core_id)         : [];

  const currentExercise = _state.status === STATE.TRAINING
    ? exercises[_state.block_index] ?? null
    : _state.status === STATE.CORE
      ? coreExercises[_state.block_index] ?? null
      : null;

  const resolvedId = _state.status === STATE.TRAINING && currentExercise
    ? _resolveExercise(_state.template_id, _state.block_index)
    : currentExercise?.exercise_id ?? null;

  const exerciseDef = resolvedId ? templates.exercises[resolvedId] : null;

  let progress = 0;
  if (_state.status === STATE.TRAINING && exercises.length > 0) {
    const totalSets = exercises.reduce((acc, e) => acc + e.sets, 0);
    const doneSets  = _state.sets.length;
    progress = Math.min(0.75, (doneSets / totalSets) * 0.75);
  } else if (_state.status === STATE.CORE) {
    progress = 0.75 + 0.15 * (_state.block_index / Math.max(1, coreExercises.length));
  } else if (_state.status === STATE.STRETCH) {
    progress = 0.90;
  } else if (_state.status === STATE.SUMMARY) {
    progress = 1.0;
  }

  return Object.freeze({
    status:               _state.status,
    ppl_type:             _state.ppl_type,
    template_id:          _state.template_id,
    template_name:        tmpl?.name ?? null,
    core_id:              _state.core_id,
    core_name:            core?.name ?? null,
    stretch_id:           _state.stretch_id,
    started_at:           _state.started_at,
    elapsed_sec:          _state.elapsed_sec,
    block_index:          _state.block_index,
    set_index:            _state.set_index,
    sets:                 [..._state.sets],
    exercises,
    core_exercises:       coreExercises,
    current_exercise:     currentExercise,
    current_exercise_def: exerciseDef,
    resolved_exercise_id: resolvedId,
    progress,
    core_usage:           { ..._state.core_usage },
  });
}

export function start(templateId) {
  if (_state.status !== STATE.IDLE) {
    console.warn('[session] start() called in non-IDLE state');
    return;
  }
  const tmpl = templates.templates[templateId];
  if (!tmpl) throw new Error(`Unknown template: ${templateId}`);

  db.getCoreUsage().then(usage => {
    if (usage) _state.core_usage = usage;
  });

  _state.status      = STATE.TRAINING;
  _state.template_id = templateId;
  _state.ppl_type    = tmpl.type;
  _state.stretch_id  = `stretch_${tmpl.type}`;
  _state.started_at  = new Date().toISOString();
  _state.elapsed_sec = 0;
  _state.block_index = 0;
  _state.set_index   = 1;
  _state.sets        = [];

  _startTicker();
  _emit('session:started');
}

export function logSet({ kg, reps, rpe = null }) {
  if (_state.status !== STATE.TRAINING && _state.status !== STATE.CORE) return;

  const resolvedId = _state.status === STATE.TRAINING
    ? _resolveExercise(_state.template_id, _state.block_index)
    : null;

  const exerciseId = resolvedId ?? (() => {
    const coreExs = _flattenCore(_state.core_id || '');
    return coreExs[_state.block_index]?.exercise_id ?? null;
  })();

  if (!exerciseId) return;

  _state.sets.push({
    exercise_id: exerciseId,
    set_num:     _state.set_index,
    kg:          parseFloat(kg) || 0,
    reps:        parseInt(reps, 10) || 0,
    rpe:         rpe !== null ? parseFloat(rpe) : null,
    ts:          new Date().toISOString(),
  });

  _state.set_index += 1;
  _emit('session:set_logged');
}

export function nextExercise() {
  const exercises = _state.status === STATE.TRAINING
    ? _flattenTemplate(_state.template_id)
    : _flattenCore(_state.core_id);

  const nextIndex = _state.block_index + 1;

  if (nextIndex >= exercises.length) {
    if (_state.status === STATE.TRAINING) {
      _advanceToCore();
    } else if (_state.status === STATE.CORE) {
      _advanceToStretch();
    }
    return;
  }

  if (_state.status === STATE.TRAINING) {
    const current = _flattenTemplate(_state.template_id)[_state.block_index];
    if (current?.rotation) {
      const prev = _state.rotations[current.exercise_id];
      _state.rotations[current.exercise_id] = (!prev || prev === 'variant_b') ? 'variant_a' : 'variant_b';
    }
  }

  _state.block_index = nextIndex;
  _state.set_index   = 1;
  _emit('session:exercise_changed');
}

function _advanceToCore() {
  _state.core_id     = _pickCore(_state.core_usage);
  _state.status      = STATE.CORE;
  _state.block_index = 0;
  _state.set_index   = 1;
  _state.core_usage[_state.core_id] = (_state.core_usage[_state.core_id] || 0) + 1;
  _emit('session:state_changed', { from: STATE.TRAINING, to: STATE.CORE });
}

function _advanceToStretch() {
  _state.status      = STATE.STRETCH;
  _state.block_index = 0;
  _emit('session:state_changed', { from: STATE.CORE, to: STATE.STRETCH });
}

export function completeStretch() {
  if (_state.status !== STATE.STRETCH) return;
  _state.status = STATE.SUMMARY;
  _stopTicker();
  _emit('session:state_changed', { from: STATE.STRETCH, to: STATE.SUMMARY });
}

export function pause() {
  if (_state.status === STATE.PAUSED) return;
  if (![STATE.TRAINING, STATE.CORE, STATE.STRETCH].includes(_state.status)) return;
  _state._pre_pause_status = _state.status;
  _state.status    = STATE.PAUSED;
  _state.paused_at = new Date().toISOString();
  _stopTicker();
  _emit('session:paused');
}

export function resume() {
  if (_state.status !== STATE.PAUSED) return;
  _state.status    = _state._pre_pause_status ?? STATE.TRAINING;
  _state.paused_at = null;
  _startTicker();
  _emit('session:resumed');
}

export async function save() {
  if (_state.status !== STATE.SUMMARY) return;

  const payload = {
    id:           crypto.randomUUID(),
    template_id:  _state.template_id,
    ppl_type:     _state.ppl_type,
    core_id:      _state.core_id,
    stretch_id:   _state.stretch_id,
    started_at:   _state.started_at,
    ended_at:     new Date().toISOString(),
    elapsed_sec:  _state.elapsed_sec,
    sets:         [..._state.sets],
    updated_at:   new Date().toISOString(),
  };

  await db.saveWorkout(payload);
  await db.saveCoreUsage(_state.core_usage);

  _emit('session:saved', { workout_id: payload.id });
  _reset();
}

export function discard() {
  _stopTicker();
  _reset();
  _emit('session:discarded');
}

function _reset() {
  _state = {
    status:       STATE.IDLE,
    ppl_type:     null,
    template_id:  null,
    core_id:      null,
    stretch_id:   null,
    started_at:   null,
    paused_at:    null,
    elapsed_sec:  0,
    block_index:  0,
    set_index:    1,
    sets:         [],
    rotations:    {},
    core_usage:   _state.core_usage,
  };
}

export function getIslandData() {
  const snap = getSnapshot();
  const pad  = n => String(n).padStart(2, '0');
  const m    = Math.floor(snap.elapsed_sec / 60);
  const s    = snap.elapsed_sec % 60;
  const elapsed_str = `${pad(m)}:${pad(s)}`;

  let exercise_name = '—';
  let set_str = '';

  if (snap.status === STATE.TRAINING && snap.current_exercise_def) {
    exercise_name = snap.current_exercise_def.name.toUpperCase();
    const totalSets = snap.current_exercise?.sets ?? 0;
    set_str = `${snap.set_index - 1}/${totalSets}`;
  } else if (snap.status === STATE.CORE) {
    exercise_name = snap.core_name?.toUpperCase() ?? 'CORE';
  } else if (snap.status === STATE.STRETCH) {
    exercise_name = 'STRETCH';
  } else if (snap.status === STATE.SUMMARY) {
    exercise_name = 'DONE';
  } else if (snap.status === STATE.PAUSED) {
    exercise_name = 'PAUSED';
  }

  return {
    exercise_name,
    elapsed_str,
    set_str,
    ppl_type: snap.ppl_type,
    progress: snap.progress,
    status:   snap.status,
  };
}

export default {
  STATE,
  start,
  logSet,
  nextExercise,
  completeStretch,
  pause,
  resume,
  save,
  discard,
  getSnapshot,
  getIslandData,
};

// ─── Init sync on module load ─────────────────────────────────────────────────
sync.init();
