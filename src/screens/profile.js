import sync from '../core/sync.js';
import { bus } from '../core/bus.js';
import db from '../core/db.js';

/**
 * profile.js
 * Profile screen — settings + device info
 *
 * Sections:
 *   Interface   — Theme (Dark/Light), Language (EN/RU)
 *   Training    — Rest timer, Weighted toggle, AI Coach, Auto-advance, RPE, Progressive
 *   Timer       — Core A/B/C durations, Stretch duration, Auto-pause
 *   Device      — Recovery Code, Sync status
 *   Data        — Export CSV/JSON, Import, Reset
 */

// ─── Module state ─────────────────────────────────────────────────────────────

let _el   = null;
let _lang = 'en';

const DEFAULTS = {
  name:           'Gio',
  theme:          'dark',
  lang:           'en',
  rest_timer_sec: 90,
  weighted_toggle:false,
  ai_coach:       true,
  auto_advance:   false,
  rpe_field:      true,
  progressive:    true,
  auto_pause:     true,
  core_a_dur:     300,
  core_b_dur:     300,
  core_c_dur:     300,
  stretch_dur:    300,
  unit:           'kg',
  body_metrics:   true,
};

let _settings = { ...DEFAULTS };

// ─── Module-level listeners (for proper bus.off cleanup) ─────────────────────
const _onSyncStatus = () => _checkSyncStatus();

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function mount(el, lang = 'en') {
  _el   = el;
  _lang = lang;
  _loadSettings();
  await _render();
  bus.on('sync:status', _onSyncStatus);
}

export function unmount() {
  // H-1 Fix: properly remove named listener (not a new anonymous function)
  bus.off('sync:status', _onSyncStatus);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function _loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem('fit_elite_settings') ?? '{}');
    _settings = { ...DEFAULTS, ...stored };
    _lang = _settings.lang;
    if (_settings.unit) document.documentElement.setAttribute('data-unit', _settings.unit);
  } catch (_) {
    _settings = { ...DEFAULTS };
  }
}

function _saveSettings() {
  localStorage.setItem('fit_elite_settings', JSON.stringify(_settings));
  bus.emit('settings:changed', { ..._settings });
}

function _set(key, value) {
  _settings[key] = value;
  _saveSettings();
}

// ─── Render ───────────────────────────────────────────────────────────────────

async function _render() {
  if (!_el) return;

  const deviceId     = await _getDeviceId();
  const recoveryCode = _formatRecoveryCode(deviceId);
  const coreUsage    = await db.getCoreUsage();
  const workouts     = await db.getWorkouts();
  const totalWorkouts= workouts.length;
  const totalVolume  = Math.round(
    workouts.reduce((a, w) => a + (w.sets ?? []).reduce((b, s) => b + s.kg * s.reps, 0), 0) / 1000
  );

  _el.innerHTML = `
    <div class="profile screen-in">
      ${_renderHero(totalWorkouts, totalVolume, coreUsage)}
      ${_renderSection(_t('Interface', 'Интерфейс'), _renderInterface())}
      ${_renderSection(_t('Training', 'Тренировка'), _renderTraining())}
      ${_renderSection(_t('Timer Settings', 'Настройки таймера'), _renderTimerSettings())}
      ${_renderSection(_t('Device', 'Устройство'), _renderDevice(recoveryCode))}
      ${_renderSection(_t('Data', 'Данные'), _renderData())}
      ${_renderDangerZone()}
      <div style="height:24px"></div>
    </div>
  `;

  _bind();
}

// ─── Sections ────────────────────────────────────────────────────────────────

function _renderHero(totalWorkouts, totalVolume, coreUsage) {
  const mostUsedCore = Object.entries(coreUsage)
    .filter(([k]) => k !== 'id')
    .sort((a, b) => b[1] - a[1])[0]?.[0]?.replace('core_', 'Core ')?.toUpperCase() ?? '—';
  const name   = _settings.name || DEFAULTS.name;
  const letter = name.charAt(0).toUpperCase();
  return `
    <div class="p-hero">
      <div class="p-av" id="profile-av" style="cursor:pointer;position:relative" title="${_t('Tap to edit name', 'Нажми для изменения имени')}">${letter}</div>
      <div style="flex:1">
        <div class="p-name" id="profile-name-wrap">
          <span id="profile-name-display" style="cursor:pointer" title="${_t('Tap to edit', 'Нажмите для редактирования')}">${_esc(name)}</span>
        </div>
        <div class="p-meta">
          <span>${totalWorkouts} ${_t('workouts', 'тренировок')}</span>
          <span class="p-meta-dot">·</span>
          <span>${totalVolume}k kg ${_t('total', 'итого')}</span>
          <span class="p-meta-dot">·</span>
          <span style="color:var(--warn)">${mostUsedCore}</span>
        </div>
      </div>
    </div>
  `;
}

function _renderSection(title, content) {
  return `
    <div class="p-sec">
      <div class="p-sec-title">${title}</div>
      <div class="p-card">${content}</div>
    </div>
  `;
}

function _renderInterface() {
  return `
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">dark_mode</span>
        <div><div class="s-label">${_t('Theme', 'Тема')}</div></div>
      </div>
      <div class="theme-toggle">
        <div class="theme-opt ${_settings.theme === 'dark' ? 'on' : ''}" data-theme="dark">${_t('Dark', 'Тёмная')}</div>
        <div class="theme-opt ${_settings.theme === 'light' ? 'on' : ''}" data-theme="light">${_t('Light', 'Светлая')}</div>
      </div>
    </div>
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">translate</span>
        <div><div class="s-label">${_t('Language', 'Язык')}</div></div>
      </div>
      <div class="lang-toggle">
        <div class="lang-opt ${_settings.lang === 'en' ? 'on' : ''}" data-lang="en">EN</div>
        <div class="lang-opt ${_settings.lang === 'ru' ? 'on' : ''}" data-lang="ru">RU</div>
      </div>
    </div>
  `;
}

function _renderTraining() {
  return `
    ${_renderToggleRow('body_metrics', 'monitor_weight', _t('Body stats tracking', 'Отслеживание тела'), _t('Enable weight & metrics tab', 'Включить вкладку'))}
    ${_renderToggleRow('weighted_toggle', 'fitness_center', _t('Weighted toggle', 'Утяжелённый toggle'), _t('Pull Ups · Hyperextension', 'Подтягивания · Гиперэкстензия'))}
    ${_renderToggleRow('ai_coach', 'auto_awesome', _t('AI Coach', 'AI Тренер'), _t('Level 2 contextual nudges', 'Контекстные подсказки'))}
    ${_renderToggleRow('auto_advance', 'skip_next', _t('Auto-advance', 'Авто-переход'), _t('Next exercise after last set', 'Следующее после последнего подхода'))}
    ${_renderToggleRow('rpe_field', 'psychology', _t('Show RPE field', 'Показать RPE'), _t('Rate of perceived exertion', 'Оценка нагрузки'))}
    ${_renderToggleRow('progressive', 'bolt', _t('Progressive overload', 'Прогрессивная перегрузка'), _t('+2.5 kg suggestion after PR', '+2.5 кг после рекорда'))}

    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">straighten</span>
        <div><div class="s-label">${_t('Units', 'Единицы')}</div></div>
      </div>
      <div class="unit-toggle">
        <div class="unit-opt ${_settings.unit === 'kg' ? 'on' : ''}" data-unit="kg">kg</div>
        <div class="unit-opt ${_settings.unit === 'lbs' ? 'on' : ''}" data-unit="lbs">lbs</div>
      </div>
    </div>
  `;
}

function _renderTimerSettings() {
  const rows = [
    { key: 'core_a_dur', label: 'Core A', labelRu: 'Кор А' },
    { key: 'core_b_dur', label: 'Core B', labelRu: 'Кор Б' },
    { key: 'core_c_dur', label: 'Core C', labelRu: 'Кор В' },
    { key: 'stretch_dur',label: 'Stretch', labelRu: 'Растяжка' },
  ];
  return `
    ${_renderToggleRow('auto_pause', 'pause_circle', _t('Auto-pause on exit', 'Авто-пауза при выходе'), _t('Pause when app backgrounds', 'Пауза при сворачивании'))}
    <div class="s-row" id="timer-settings">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">timer</span>
        <div>
          <div class="s-label">${_t('Default rest timer', 'Таймер отдыха')}</div>
          <div class="s-sub">${_settings.rest_timer_sec}s</div>
        </div>
      </div>
      <div class="stepper" data-key="rest_timer_sec" data-step="15" data-min="30" data-max="300">
        <button class="step-btn" data-dir="-1">−</button>
        <span class="step-val">${_settings.rest_timer_sec}s</span>
        <button class="step-btn" data-dir="1">+</button>
      </div>
    </div>
    ${rows.map(r => `
      <div class="s-row">
        <div class="s-left">
          <span class="material-symbols-outlined s-icon">schedule</span>
          <div>
            <div class="s-label">${_t(r.label, r.labelRu)}</div>
            <div class="s-sub">${Math.floor(_settings[r.key] / 60)} min</div>
          </div>
        </div>
        <div class="stepper" data-key="${r.key}" data-step="60" data-min="60" data-max="900">
          <button class="step-btn" data-dir="-1">−</button>
          <span class="step-val">${Math.floor(_settings[r.key] / 60)} min</span>
          <button class="step-btn" data-dir="1">+</button>
        </div>
      </div>
    `).join('')}
  `;
}

function _renderDevice(recoveryCode) {
  return `
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">key</span>
        <div>
          <div class="s-label">${_t('Recovery Code', 'Код восстановления')}</div>
          <div class="s-sub">${_t('Enter on new device to restore data', 'Введите на новом устройстве')}</div>
        </div>
      </div>
      <div class="code-wrap">
        <span class="recovery-code" id="recovery-code">${recoveryCode}</span>
        <button class="icon-btn-sm" id="copy-code">
          <span class="material-symbols-outlined" style="font-size:16px">content_copy</span>
        </button>
      </div>
    </div>
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">cloud_sync</span>
        <div>
          <div class="s-label">${_t('Sync status', 'Статус синхронизации')}</div>
          <div class="s-sub" id="sync-status-sub">${_t('Checking…', 'Проверяем…')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <button class="icon-btn-sm" id="manual-sync-btn" style="color:var(--t2); cursor:pointer; background:none; border:none;">
          <span class="material-symbols-outlined" style="font-size:18px">sync</span>
        </button>
        <div class="sync-dot" id="sync-dot"></div>
      </div>
    </div>
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">restore</span>
        <div>
          <div class="s-label">${_t('Restore data', 'Восстановить данные')}</div>
          <div class="s-sub">${_t('Enter recovery code from another device', 'Введите код с другого устройства')}</div>
        </div>
      </div>
      <button class="ta-btn" id="restore-btn">${_t('Restore', 'Восстановить')}</button>
    </div>
  `;
}

function _renderData() {
  return `
    <div class="exp-row">
      <button class="exp-btn exp-btn-p" id="export-csv">
        <span class="material-symbols-outlined" style="font-size:15px">table_chart</span>CSV
      </button>
      <button class="exp-btn" id="export-json">
        <span class="material-symbols-outlined" style="font-size:15px">data_object</span>JSON
      </button>
    </div>
    <div class="import-zone" id="import-zone">
      <span class="material-symbols-outlined" style="font-size:28px;color:var(--t4);margin-bottom:6px;display:block">upload_file</span>
      <div class="iz-title">${_t('Import workout data', 'Импорт данных')}</div>
      <div class="iz-sub">Strong · Hevy · CSV · JSON</div>
    </div>
  `;
}

function _renderDangerZone() {
  return `
    <div class="p-sec">
      <div class="p-sec-title" style="color:var(--err)">${_t('Danger Zone', 'Опасная зона')}</div>
      <div class="p-card" style="padding:12px 14px">
        <button class="danger-btn" id="reset-btn">
          <span class="material-symbols-outlined" style="font-size:17px">restart_alt</span>
          ${_t('Reset all workout data', 'Сбросить все данные')}
        </button>
      </div>
    </div>
  `;
}

function _renderToggleRow(key, icon, label, sub = '') {
  const on = !!_settings[key];
  return `
    <div class="s-row">
      <div class="s-left">
        <span class="material-symbols-outlined s-icon">${icon}</span>
        <div>
          <div class="s-label">${label}</div>
          ${sub ? `<div class="s-sub">${sub}</div>` : ''}
        </div>
      </div>
      <div class="tog ${on ? 'on' : ''}" data-tog="${key}"></div>
    </div>
  `;
}

// ─── Bind ─────────────────────────────────────────────────────────────────────

function _bind() {
  // ── Name tap-to-edit ─────────────────────────────────────────────────────
  const _startNameEdit = () => {
    const wrap = _el?.querySelector('#profile-name-wrap');
    if (!wrap || wrap.querySelector('input')) return; // already editing
    const current = _settings.name || DEFAULTS.name;
    wrap.innerHTML = `
      <input id="profile-name-input"
        type="text" value="${_esc(current)}"
        maxlength="32" autocomplete="off"
        style="background:transparent;border:none;border-bottom:1.5px solid var(--p);
               outline:none;font-size:1.375rem;font-weight:900;color:var(--t1);
               letter-spacing:-.025em;font-family:'Manrope',sans-serif;
               width:100%;padding-bottom:2px;"
      />
    `;
    const inp = wrap.querySelector('#profile-name-input');
    inp?.focus();
    inp?.select();

    const _save = () => {
      const val = inp?.value?.trim();
      if (val && val.length > 0) {
        _set('name', val);
        bus.emit('settings:changed', { name: val });
      }
      _render(); // re-render to show saved name + update avatar letter
    };
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') _save(); if (e.key === 'Escape') _render(); });
    inp?.addEventListener('blur', _save);
  };

  _el.querySelector('#profile-name-display')?.addEventListener('click', _startNameEdit);
  _el.querySelector('#profile-av')?.addEventListener('click', _startNameEdit);

  _el.querySelectorAll('[data-tog]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.tog;
      _set(key, !_settings[key]);
      el.classList.toggle('on', !!_settings[key]);
    });
  });


  _el.querySelectorAll('[data-theme]').forEach(el => {
    el.addEventListener('click', () => {
      const theme = el.dataset.theme;
      _set('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      _el.querySelectorAll('[data-theme]').forEach(o => o.classList.toggle('on', o.dataset.theme === theme));
    });
  });

  _el.querySelectorAll('[data-lang]').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.dataset.lang;
      _set('lang', lang);
      _lang = lang;
      bus.emit('lang:changed', { lang });
      _render();
    });
  });

  _el.querySelectorAll('.stepper').forEach(wrap => {
    const key  = wrap.dataset.key;
    const step = parseInt(wrap.dataset.step, 10);
    const min  = parseInt(wrap.dataset.min, 10);
    const max  = parseInt(wrap.dataset.max, 10);
    const val  = wrap.querySelector('.step-val');
    wrap.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir  = parseInt(btn.dataset.dir, 10);
        const cur  = _settings[key] ?? DEFAULTS[key];
        const next = Math.max(min, Math.min(max, cur + step * dir));
        _set(key, next);
        val.textContent = key === 'rest_timer_sec' ? `${next}s` : `${Math.floor(next / 60)} min`;
        const sub = wrap.closest('.s-row')?.querySelector('.s-sub');
        if (sub) sub.textContent = val.textContent;
      });
    });
  });

  _el.querySelectorAll('[data-unit]').forEach(el => {
    el.addEventListener('click', () => {
      const unit = el.dataset.unit;
      _set('unit', unit);
      document.documentElement.setAttribute('data-unit', unit);
      _el.querySelectorAll('[data-unit]').forEach(o => o.classList.toggle('on', o.dataset.unit === unit));
    });
  });

  _el.querySelector('#manual-sync-btn')?.addEventListener('click', () => {
    _showToast(_t('Syncing...', 'Синхронизация...'), 'info');
    if (typeof sync.flush === 'function') sync.flush();
  });

  _el.querySelector('#copy-code')?.addEventListener('click', async () => {
    const code = _el.querySelector('#recovery-code')?.textContent;
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => {});
    _showToast(_t('Copied!', 'Скопировано!'));
  });

  // ── Restore — real sync call ──────────────────────────────────────────────
  _el.querySelector('#restore-btn')?.addEventListener('click', async () => {
    const code = prompt(_t(
      'Enter recovery code (format: XXXX-XXXX-XXXX)',
      'Введите код восстановления (формат: XXXX-XXXX-XXXX)'
    ));
    if (!code) return;
    const clean = code.replace(/-/g, '').toLowerCase();
    if (clean.length !== 12) {
      _showToast(_t('Invalid code', 'Неверный код'), 'err');
      return;
    }
    _showToast(_t('Restoring…', 'Восстанавливаем…'));
    const result = await sync.restore(clean);
    if (result.ok) {
      _showToast(_t(`Restored ${result.merged} workouts`, `Восстановлено ${result.merged} тренировок`));
    } else {
      _showToast(_t('Restore failed', 'Ошибка восстановления'), 'err');
    }
  });

  _el.querySelector('#export-csv')?.addEventListener('click', async () => {
    const workouts = await db.getWorkouts();
    _download('fit_elite_export.csv', 'text/csv', _toCSV(workouts));
    _showToast(_t('CSV exported', 'CSV экспортирован'));
  });

  _el.querySelector('#export-json')?.addEventListener('click', async () => {
    const workouts = await db.getWorkouts();
    _download('fit_elite_export.json', 'application/json', JSON.stringify(workouts, null, 2));
    _showToast(_t('JSON exported', 'JSON экспортирован'));
  });

  _el.querySelector('#reset-btn')?.addEventListener('click', async () => {
    const ok = confirm(_t('Reset ALL workout data? This cannot be undone.', 'Сбросить ВСЕ данные? Нельзя отменить.'));
    if (!ok) return;
    await _resetAll();
    _showToast(_t('All data reset', 'Все данные сброшены'));
    await _render();
  });

  _checkSyncStatus();
}

// ─── Sync status — real ───────────────────────────────────────────────────────

async function _checkSyncStatus() {
  const dot = _el?.querySelector('#sync-dot');
  const sub = _el?.querySelector('#sync-status-sub');
  if (!dot || !sub) return;

  const status = sync.getStatus();
  const queue  = await db.getSyncQueue();

  const map = {
    synced:  { cls: 'synced',  en: 'Synced',                    ru: 'Синхронизировано'         },
    syncing: { cls: 'synced',  en: 'Syncing…',                  ru: 'Синхронизация…'           },
    pending: { cls: 'pending', en: `${queue.length} pending`,   ru: `${queue.length} в очереди`},
    offline: { cls: 'offline', en: 'Offline',                   ru: 'Не в сети'                },
    idle:    { cls: 'synced',  en: 'Ready',                     ru: 'Готово'                   },
  };

  const s = map[status] ?? map.idle;
  dot.className   = `sync-dot ${s.cls}`;
  
  let txt = _lang === 'ru' ? s.ru : s.en;
  if (status === 'synced' || status === 'idle') {
    const rawTime = localStorage.getItem('fit_elite_last_sync_date');
    if (rawTime) {
      try {
        const d = new Date(rawTime);
        const tf = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const df = d.toLocaleDateString([], {day: 'numeric', month: 'short'});
        const wasToday = new Date().toDateString() === d.toDateString();
        const str = wasToday ? tf : `${df}, ${tf}`;
        txt += ` · ${str}`;
      } catch(e) {}
    }
  }
  sub.textContent = txt;
}

// ─── Device ID ────────────────────────────────────────────────────────────────

async function _getDeviceId() {
  let id = localStorage.getItem('fit_elite_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('fit_elite_device_id', id);
  }
  return id;
}

function _formatRecoveryCode(uuid) {
  const hex = uuid.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}`;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function _toCSV(workouts) {
  const header = ['date','template','ppl_type','exercise_id','set_num','kg','reps','rpe','elapsed_sec'];
  const rows = [header.join(',')];
  for (const w of workouts) {
    for (const s of (w.sets ?? [])) {
      rows.push([
        w.started_at?.slice(0,10) ?? '',
        w.template_id ?? '',
        w.ppl_type ?? '',
        s.exercise_id ?? '',
        s.set_num ?? '',
        s.kg ?? '',
        s.reps ?? '',
        s.rpe ?? '',
        w.elapsed_sec ?? '',
      ].join(','));
    }
  }
  return rows.join('\n');
}

function _download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function _resetAll() {
  const stores = ['workouts', 'core_usage', 'sync_queue'];
  for (const store of stores) {
    await new Promise((res, rej) => {
      const req = indexedDB.open('fit_elite', 1);
      req.onsuccess = e => {
        const db  = e.target.result;
        const tx  = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = res;
        tx.onerror    = rej;
      };
      req.onerror = rej;
    });
  }
}

function _showToast(msg, type = 'ok') {
  bus.emit('toast', { msg, type });
}

function _t(en, ru) { return _lang === 'ru' ? ru : en; }
function _esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

export function getSettings() { return { ..._settings }; }
export default { mount, unmount, getSettings };

