/**
 * sync.js
 * Outbox Pattern — local-first sync to Supabase.
 *
 * Flow:
 *   session.save() → db.saveWorkout() → _queueSync() → sync_queue
 *   triggers (visibilitychange / online / interval) → flush()
 *   flush() → batch UPSERT to Supabase → remove from queue on 200
 *
 * Recovery:
 *   user enters Recovery Code → restore(deviceId) → pull from Supabase
 *
 * Phase 5 — requires SUPABASE_URL and SUPABASE_ANON_KEY in .env
 */

import db from './db.js';
import { bus } from './bus.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL      = import.meta.env?.VITE_SUPABASE_URL
  ?? window.__env__?.SUPABASE_URL
  ?? '';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY
  ?? window.__env__?.SUPABASE_ANON_KEY
  ?? '';

const HEADERS = (deviceId) => ({
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'x-device-id':  deviceId,
  'Prefer':        'resolution=merge-duplicates',
});

// ─── State ───────────────────────────────────────────────────────────────────

let _deviceId    = null;
let _flushing    = false;
let _retryDelay  = 500;    // ms, doubles on each failure (max 30s)
let _retryTimer  = null;
let _intervalId  = null;
let _status      = 'idle'; // 'idle' | 'syncing' | 'synced' | 'pending' | 'offline'

// ─── Init ────────────────────────────────────────────────────────────────────

export async function init() {
  _deviceId = await _getDeviceId();

  // Request persistent storage — critical for iOS Safari (prevents IDB eviction)
  if (navigator.storage?.persist) {
    navigator.storage.persist().then(granted => {
      if (!granted) console.warn('[sync] Storage persistence not granted — eviction risk on iOS Safari');
      else console.log('[sync] Persistent storage granted');
    });
  }

  // Triggers
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });

  window.addEventListener('online', () => {
    _setStatus('pending');
    flush();
  });

  window.addEventListener('offline', () => {
    _setStatus('offline');
  });

  // 10-min safety interval
  _intervalId = setInterval(flush, 10 * 60 * 1000);

  // Initial flush
  if (navigator.onLine) flush();
  else _setStatus('offline');
}

export function destroy() {
  clearInterval(_intervalId);
  clearTimeout(_retryTimer);
}

// ─── Queue ───────────────────────────────────────────────────────────────────

/**
 * Add a workout to the sync queue.
 * Called from db.saveWorkout() after local write succeeds.
 */
export async function enqueue(workout) {
  await db._putSyncItem({
    id:         crypto.randomUUID(),
    action:     'UPSERT',
    table:      'workouts',
    payload:    { ...workout, device_id: _deviceId },
    created_at: new Date().toISOString(),
  });
  _setStatus('pending');
  _scheduleFlush(300);
}

// ─── Flush ───────────────────────────────────────────────────────────────────

/**
 * Drain the sync queue — send all pending items to Supabase.
 * Batches by table. Removes items only on HTTP 200/201.
 * Retries with exponential backoff on failure.
 */
export async function flush() {
  if (_flushing)          return;
  if (!navigator.onLine)  { _setStatus('offline'); return; }
  if (!SUPABASE_URL)      { console.warn('[sync] SUPABASE_URL not set'); return; }

  const queue = await db.getSyncQueue();
  if (!queue.length) { _setStatus('synced'); return; }

  _flushing = true;
  _setStatus('syncing');

  // Group by table
  const byTable = {};
  for (const item of queue) {
    if (!byTable[item.table]) byTable[item.table] = [];
    byTable[item.table].push(item);
  }

  let allOk = true;

  for (const [table, items] of Object.entries(byTable)) {
    const upserts = items
      .filter(i => i.action === 'UPSERT')
      .map(i => i.payload);

    if (upserts.length) {
      const ok = await _upsert(table, upserts);
      if (ok) {
        // Remove successfully synced items
        for (const item of items.filter(i => i.action === 'UPSERT')) {
          await db.removeSyncItem(item.id);
        }
        _retryDelay = 500; // reset backoff on success
      } else {
        allOk = false;
      }
    }
  }

  _flushing = false;

  if (allOk) {
    const remaining = await db.getSyncQueue();
    _setStatus(remaining.length ? 'pending' : 'synced');
    if (!remaining.length) localStorage.setItem('fit_elite_last_sync_date', new Date().toISOString());
    bus.emit('sync:flushed');
  } else {
    _setStatus('pending');
    _scheduleRetry();
  }
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

async function _upsert(table, rows) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: HEADERS(_deviceId),
      body:    JSON.stringify(rows),
    });

    if (res.ok) return true;

    const err = await res.text();
    console.error(`[sync] upsert ${table} failed ${res.status}:`, err);
    return false;
  } catch (e) {
    console.error('[sync] network error:', e);
    return false;
  }
}

// ─── Pull (Recovery) ─────────────────────────────────────────────────────────

/**
 * Pull all workouts for a given device_id from Supabase.
 * Used when user enters Recovery Code on a new device.
 * Merges into local IndexedDB using LWW (updated_at).
 */
export async function restore(recoveryCode) {
  if (!SUPABASE_URL) return { ok: false, error: 'SUPABASE_URL not set' };

  // Recovery Code → device_id prefix
  const prefix = recoveryCode.replace(/-/g, '').toLowerCase();

  _setStatus('syncing');
  bus.emit('sync:restore_started');

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/workouts?device_id=like.${prefix}%&order=updated_at.asc`,
      {
        method:  'GET',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-device-id':  prefix,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      _setStatus('pending');
      return { ok: false, error: err };
    }

    const remote = await res.json();
    let merged = 0;

    for (const remoteWorkout of remote) {
      const local = await db.getWorkout(remoteWorkout.id);

      // LWW — keep newer
      if (!local || new Date(remoteWorkout.updated_at) > new Date(local.updated_at ?? 0)) {
        await db.saveWorkoutDirect(remoteWorkout);
        merged++;
      }
    }

    _setStatus('synced');
    localStorage.setItem('fit_elite_last_sync_date', new Date().toISOString());
    bus.emit('sync:restore_complete', { merged, total: remote.length });
    return { ok: true, merged, total: remote.length };

  } catch (e) {
    console.error('[sync] restore error:', e);
    _setStatus('offline');
    return { ok: false, error: e.message };
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

function _setStatus(status) {
  if (_status === status) return;
  _status = status;
  bus.emit('sync:status', { status });
}

export function getStatus() { return _status; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _getDeviceId() {
  let id = localStorage.getItem('fit_elite_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('fit_elite_device_id', id);
  }
  return id;
}

function _scheduleFlush(delay = 300) {
  clearTimeout(_retryTimer);
  _retryTimer = setTimeout(flush, delay);
}

function _scheduleRetry() {
  const jitter = 0.75 + Math.random() * 0.5; // ±25%
  const delay = Math.min(_retryDelay, 30000) * jitter;
  _retryDelay = delay * 2;
  console.log(`[sync] retry in ${Math.round(delay)}ms`);
  clearTimeout(_retryTimer);
  _retryTimer = setTimeout(flush, delay);
}

export default { init, destroy, flush, enqueue, restore, getStatus };
