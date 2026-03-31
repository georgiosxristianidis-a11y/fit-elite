import { enqueue } from './sync.js';

/**
 * db.js
 * IndexedDB — Single Source of Truth.
 * Writes happen ONLY from session.save().
 * Reads happen from Progress / Profile screens.
 *
 * Stores:
 *   workouts      { id, template_id, ppl_type, core_id, stretch_id,
 *                   started_at, ended_at, elapsed_sec, sets[], updated_at }
 *   core_usage    { id: 'singleton', core_a, core_b, core_c }
 *   sync_queue    { id, action, table, payload, created_at }
 */

const DB_NAME    = 'fit_elite';
const DB_VERSION = 1;

// ─── Open ────────────────────────────────────────────────────────────────────

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('workouts')) {
        const ws = db.createObjectStore('workouts', { keyPath: 'id' });
        ws.createIndex('by_started', 'started_at');
        ws.createIndex('by_ppl',     'ppl_type');
        ws.createIndex('by_updated', 'updated_at');
      }

      if (!db.objectStoreNames.contains('core_usage')) {
        db.createObjectStore('core_usage', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'id' });
        sq.createIndex('by_created', 'created_at');
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function _tx(storeName, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req   = fn(store);
    if (req) {
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror    = e  => reject(e.target.error);
    }
  }));
}

function _put(storeName, record) {
  return _tx(storeName, 'readwrite', store => store.put(record));
}

function _get(storeName, key) {
  return _tx(storeName, 'readonly', store => store.get(key));
}

function _getAll(storeName) {
  return _tx(storeName, 'readonly', store => store.getAll());
}

function _getAllByIndex(storeName, indexName, query) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req   = index.getAll(query);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

// ─── Workouts ────────────────────────────────────────────────────────────────

async function saveWorkout(workout) {
  const record = { ...workout, updated_at: new Date().toISOString() };
  await _put('workouts', record);
  await enqueue(record);
}

async function saveWorkoutDirect(workout) {
  await _put('workouts', workout);
}

async function _putSyncItem(item) {
  await _put('sync_queue', item);
}

async function getWorkouts() {
  const all = await _getAll('workouts');
  return all.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

async function getWorkoutsByRange(from, to) {
  const all = await getWorkouts();
  return all.filter(w => {
    const d = new Date(w.started_at);
    return d >= from && d <= to;
  });
}

function getWorkout(id) {
  return _get('workouts', id);
}

function getWorkoutsByType(pplType) {
  return _getAllByIndex('workouts', 'by_ppl', pplType);
}

// ─── Core Usage ──────────────────────────────────────────────────────────────

const CORE_USAGE_KEY = 'singleton';

async function getCoreUsage() {
  const rec = await _get('core_usage', CORE_USAGE_KEY);
  return rec ?? { id: CORE_USAGE_KEY, core_a: 0, core_b: 0, core_c: 0 };
}

async function saveCoreUsage(usage) {
  await _put('core_usage', { id: CORE_USAGE_KEY, ...usage });
}

// ─── Progress selectors ───────────────────────────────────────────────────────

async function getPersonalRecords() {
  const workouts = await getWorkouts();
  const records  = {};
  for (const w of workouts) {
    for (const s of w.sets ?? []) {
      const prev = records[s.exercise_id];
      if (!prev || s.kg > prev.kg || (s.kg === prev.kg && s.reps > prev.reps)) {
        records[s.exercise_id] = { kg: s.kg, reps: s.reps, ts: s.ts };
      }
    }
  }
  return records;
}

async function getVolumeHistory() {
  const workouts = await getWorkouts();
  return workouts.map(w => ({
    date:        w.started_at.slice(0, 10),
    ppl_type:    w.ppl_type,
    volume_kg:   (w.sets ?? []).reduce((acc, s) => acc + (s.kg * s.reps), 0),
    elapsed_sec: w.elapsed_sec,
  }));
}

async function getTimeHistory() {
  const workouts = await getWorkouts();
  return workouts.map(w => ({
    date:        w.started_at.slice(0, 10),
    ppl_type:    w.ppl_type,
    elapsed_sec: w.elapsed_sec,
  }));
}

async function getExerciseHistory(exerciseId) {
  const workouts = await getWorkouts();
  const history  = [];
  for (const w of workouts) {
    const sets = (w.sets ?? []).filter(s => s.exercise_id === exerciseId);
    if (sets.length) {
      const best = sets.reduce((a, b) => b.kg > a.kg ? b : a);
      history.push({ date: w.started_at.slice(0, 10), ...best });
    }
  }
  return history.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

async function getSyncQueue() {
  return _getAll('sync_queue');
}

async function removeSyncItem(id) {
  return _tx('sync_queue', 'readwrite', store => store.delete(id));
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const db = {
  saveWorkout,
  saveWorkoutDirect,
  _putSyncItem,
  getWorkouts,
  getWorkout,
  getWorkoutsByRange,
  getWorkoutsByType,
  getCoreUsage,
  saveCoreUsage,
  getPersonalRecords,
  getVolumeHistory,
  getTimeHistory,
  getExerciseHistory,
  getSyncQueue,
  removeSyncItem,
};

export default db;
