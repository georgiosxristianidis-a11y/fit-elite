/**
 * stats.js
 * Progress screen — 3 inner tabs:
 *
 *   Records  — personal records per exercise + 1RM + history chart
 *   Volume   — weekly/monthly bar chart, PPL colors
 *   Time     — time in gym bar chart, PPL colors, tap → tooltip
 *
 * Reads from db.js — never writes.
 */

import db from '../core/db.js';
import { bus } from '../core/bus.js';
import templates from '../data/templates.json' with { type: 'json' };
import { drawBarChart } from '../chart.js';
import units from '../core/units.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PPL_COLOR = {
  push: 'var(--pushL)',
  pull: 'var(--pullL)',
  legs: 'var(--legsL)',
};

const PPL_HEX = {
  push: '#818cf8',
  pull: '#4da6ff',
  legs: '#a78bfa',
};

const TABS = ['records', 'volume', 'time'];

// ─── Module state ─────────────────────────────────────────────────────────────

let _el          = null;
let _lang        = 'en';
let _activeTab   = 'records';
let _period      = '1M';   // '1W' | '1M' | '3M' | 'ALL'
let _selectedEx  = null;   // exercise_id for drill-down chart

// Data cache
let _records     = null;
let _volHistory  = null;
let _timeHistory = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function mount(el, lang = 'en', args = {}) {
  _el   = el;
  _lang = lang;
  if (args.exercise) {
    _activeTab = 'records';
    _selectedEx = args.exercise;
  }
  _renderSkeleton();
  await _loadData();
  _render();
  _bindBus();
}

export function unmount() {
  _unbindBus();
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function _loadData() {
  const [records, vol, time] = await Promise.all([
    db.getPersonalRecords(),
    db.getVolumeHistory(),
    db.getTimeHistory(),
  ]);
  _records     = records;
  _volHistory  = vol;
  _timeHistory = time;
}

// ─── Bus ─────────────────────────────────────────────────────────────────────

// H-1 Fix: store named handler reference for proper cleanup
const _onSessionSavedStats = async () => { await _loadData(); _render(); };

function _bindBus() {
  bus.on('session:saved', _onSessionSavedStats);
}
function _unbindBus() {
  bus.off('session:saved', _onSessionSavedStats);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _renderSkeleton() {
  if (!_el) return;
  _el.innerHTML = `<div class="stats-skeleton screen-in"><div class="skel skel-tabs"></div><div class="skel skel-chart"></div></div>`;
}

function _render() {
  if (!_el) return;
  _el.innerHTML = `
    <div class="stats screen-in">

      <div class="stats-top">
        <div class="stats-title">${_t('Progress', 'Прогресс')}</div>
        ${_renderInnerTabs()}
      </div>

      <div class="stats-body">
        ${_activeTab === 'records' ? _renderRecords()
        : _activeTab === 'volume'  ? _renderVolume()
        :                            _renderTime()}
      </div>

      <div style="height:20px"></div>
    </div>
  `;
  _bindStats();
}

// ─── Inner tabs ───────────────────────────────────────────────────────────────

function _renderInnerTabs() {
  return `
    <div class="tab-line">
      ${TABS.map(t => `
        <div class="tl-tab ${t === _activeTab ? 'on' : ''}" data-tab="${t}">
          ${_t(
            t === 'records' ? 'Records' : t === 'volume' ? 'Volume' : 'Time',
            t === 'records' ? 'Рекорды' : t === 'volume' ? 'Объём'  : 'Время'
          )}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── RECORDS tab ─────────────────────────────────────────────────────────────

function _renderRecords() {
  if (!_records || !Object.keys(_records).length) {
    return `<div class="empty-state">${_t('No workouts yet', 'Тренировок пока нет')}</div>`;
  }

  // Group by PPL type
  const byType = { push: [], pull: [], legs: [], other: [] };

  for (const [exId, rec] of Object.entries(_records)) {
    const def  = templates.exercises[exId];
    if (!def) continue;
    const type = _exToPPL(def.muscles);
    byType[type].push({ exId, def, rec });
  }

  const order = ['push', 'pull', 'legs', 'other'];

  return `
    <div class="records-list">
      ${order.map(type => {
        const items = byType[type];
        if (!items.length) return '';
        const color = PPL_COLOR[type] ?? 'var(--t2)';
        const label = type === 'push' ? _t('Push','Пуш')
          : type === 'pull' ? _t('Pull','Пул')
          : type === 'legs' ? _t('Legs','Ноги')
          : _t('Core','Кор');

        return `
          <div class="rec-group">
            <div class="rec-group-header" style="color:${color}">${label}</div>
            ${items.map(({ exId, def, rec }) => {
              const name = _lang === 'ru' ? def.name_ru : def.name;
              const orm  = rec.reps > 1 ? Math.round(rec.kg * (1 + rec.reps / 30)) : rec.kg;
              const isSelected = _selectedEx === exId;
              return `
                <div class="rec-item ${isSelected ? 'rec-item-open' : ''}" data-ex="${exId}">
                  <div class="rec-item-main">
                    <div class="rec-item-left">
                      <div class="rec-item-name">${name}</div>
                      <div class="rec-item-meta">${rec.reps} reps · 1RM <span style="color:var(--warn)">${units.displayWeight(orm)} ${units.getUnit()}</span></div>
                    </div>
                    <div class="rec-item-right">
                      <div class="rec-item-kg" style="color:${color}">${units.displayWeight(rec.kg)}</div>
                      <div class="rec-item-unit">${units.getUnit()}</div>
                    </div>
                  </div>
                  ${isSelected ? `<div class="rec-chart-wrap" id="chart-${exId}"></div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── VOLUME tab ───────────────────────────────────────────────────────────────

function _renderVolume() {
  const filtered = _filterByPeriod(_volHistory ?? []);
  if (!filtered.length) {
    return `<div class="empty-state">${_t('No data', 'Нет данных')}</div>`;
  }

  return `
    <div class="chart-section">
      ${_renderPeriodPicker()}
      <div class="chart-title">${_t('Volume', 'Объём')} (${units.getUnit()})</div>
      <canvas id="vol-chart" height="200"></canvas>
      ${_renderVolLegend(filtered)}
    </div>
  `;
}

function _renderVolLegend(data) {
  const total = Math.round(data.reduce((a, d) => a + d.volume_kg, 0));
  const sets  = data.reduce((a, d) => a + (d.total_sets ?? 0), 0);
  const avg   = data.length ? Math.round(total / data.length) : 0;
  return `
    <div class="chart-legend">
      <div class="legend-item">
        <div class="legend-val" style="color:var(--p)">${units.displayWeight(total).toLocaleString()}</div>
        <div class="legend-lbl">${_t('Total', 'Итого')} ${units.getUnit()}</div>
      </div>
      <div class="legend-item">
        <div class="legend-val">${sets.toLocaleString()}</div>
        <div class="legend-lbl">${_t('Total sets', 'Всего сетов')}</div>
      </div>
      <div class="legend-item">
        <div class="legend-val">${units.displayWeight(avg).toLocaleString()}</div>
        <div class="legend-lbl">${_t('Avg / session', 'Среднее / сессия')}</div>
      </div>
      <div class="legend-item">
        <div class="legend-val">${data.length}</div>
        <div class="legend-lbl">${_t('Sessions', 'Сессий')}</div>
      </div>
    </div>
  `;
}

// ─── TIME tab ────────────────────────────────────────────────────────────────

function _renderTime() {
  const filtered = _filterByPeriod(_timeHistory ?? []);
  if (!filtered.length) {
    return `<div class="empty-state">${_t('No data', 'Нет данных')}</div>`;
  }

  return `
    <div class="chart-section">
      ${_renderPeriodPicker()}
      <div class="chart-title">${_t('Time in gym (min)', 'Время в зале (мин)')}</div>
      <canvas id="time-chart" height="200"></canvas>
      ${_renderTimeLegend(filtered)}
    </div>
  `;
}

function _renderTimeLegend(data) {
  const totalMin = Math.round(data.reduce((a, d) => a + d.elapsed_sec, 0) / 60);
  const avgMin   = data.length ? Math.round(totalMin / data.length) : 0;
  const longest  = Math.round(Math.max(...data.map(d => d.elapsed_sec)) / 60);
  return `
    <div class="chart-legend">
      <div class="legend-item">
        <div class="legend-val" style="color:var(--p)">${totalMin}</div>
        <div class="legend-lbl">${_t('Total min', 'Итого мин')}</div>
      </div>
      <div class="legend-item">
        <div class="legend-val">${avgMin}</div>
        <div class="legend-lbl">${_t('Avg / session', 'Среднее / сессия')}</div>
      </div>
      <div class="legend-item">
        <div class="legend-val" style="color:var(--warn)">${longest}</div>
        <div class="legend-lbl">${_t('Longest', 'Длиннейшая')}</div>
      </div>
    </div>
  `;
}

// ─── Period picker ────────────────────────────────────────────────────────────

function _renderPeriodPicker() {
  const periods = ['1W', '1M', '3M', 'ALL'];
  return `
    <div class="period-picker">
      ${periods.map(p => `
        <div class="period-btn ${p === _period ? 'on' : ''}" data-period="${p}">
          ${_t(
            p === '1W' ? '1W' : p === '1M' ? '1M' : p === '3M' ? '3M' : 'All',
            p === '1W' ? '1Н' : p === '1M' ? '1М' : p === '3M' ? '3М' : 'Всё'
          )}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Chart rendering (delegates to chart.js) ─────────────────────────────────

async function _drawCharts() {
  if (_activeTab === 'volume') {
    const canvas = _el?.querySelector('#vol-chart');
    if (!canvas) return;
    const data = _filterByPeriod(_volHistory ?? []);
    drawBarChart(canvas, {
      labels:  data.map(d => _shortDate(d.date)),
      values:  data.map(d => Math.round(units.displayWeight(d.volume_kg))),
      colors:  data.map(d => PPL_HEX[d.ppl_type] ?? '#555'),
      tooltip: (i) => `${data[i].date}\n${_t(
        PPL_META_LABEL(data[i].ppl_type, 'en'),
        PPL_META_LABEL(data[i].ppl_type, 'ru')
      )}\n${Math.round(units.displayWeight(data[i].volume_kg)).toLocaleString()} ${units.getUnit()}`,
    });
  }

  if (_activeTab === 'time') {
    const canvas = _el?.querySelector('#time-chart');
    if (!canvas) return;
    const data = _filterByPeriod(_timeHistory ?? []);
    drawBarChart(canvas, {
      labels:  data.map(d => _shortDate(d.date)),
      values:  data.map(d => Math.round(d.elapsed_sec / 60)),
      colors:  data.map(d => PPL_HEX[d.ppl_type] ?? '#555'),
      tooltip: (i) => `${data[i].date}\n${_t(
        PPL_META_LABEL(data[i].ppl_type, 'en'),
        PPL_META_LABEL(data[i].ppl_type, 'ru')
      )}\n${Math.round(data[i].elapsed_sec / 60)} min`,
    });
  }

  if (_activeTab === 'records' && _selectedEx) {
    const wrap = _el?.querySelector(`#chart-${_selectedEx}`);
    if (!wrap) return;
    const history = await db.getExerciseHistory(_selectedEx);
    if (!history.length) return;

    // Mini line chart via canvas
    const canvas = document.createElement('canvas');
    canvas.height = 120;
    wrap.appendChild(canvas);

    const pplType = _exToPPL(templates.exercises[_selectedEx]?.muscles ?? []);
    drawBarChart(canvas, {
      labels: history.map(h => _shortDate(h.date)),
      values: history.map(h => units.displayWeight(h.kg)),
      colors: history.map(() => PPL_HEX[pplType] ?? '#818cf8'),
      tooltip: (i) => `${history[i].date}\n${units.displayWeight(history[i].kg)} ${units.getUnit()} × ${history[i].reps}`,
      type: 'line',
    });
  }
}

// ─── Bind ─────────────────────────────────────────────────────────────────────

function _bindStats() {
  // Inner tabs
  _el.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      _activeTab  = el.dataset.tab;
      _selectedEx = null;
      _render();
    });
  });

  // Period picker
  _el.querySelectorAll('[data-period]').forEach(el => {
    el.addEventListener('click', () => {
      _period = el.dataset.period;
      _render();
    });
  });

  // Records drill-down
  _el.querySelectorAll('[data-ex]').forEach(el => {
    el.addEventListener('click', () => {
      _selectedEx = _selectedEx === el.dataset.ex ? null : el.dataset.ex;
      _render();
    });
  });

  // Draw charts after render (next frame)
  requestAnimationFrame(() => _drawCharts());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _t(en, ru) { return _lang === 'ru' ? ru : en; }

function _filterByPeriod(data) {
  const now = new Date();
  const cutoff = new Date(now);
  if (_period === '1W') cutoff.setDate(now.getDate() - 7);
  else if (_period === '1M') cutoff.setMonth(now.getMonth() - 1);
  else if (_period === '3M') cutoff.setMonth(now.getMonth() - 3);
  else return data;
  return data.filter(d => new Date(d.date) >= cutoff);
}

function _shortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function _exToPPL(muscles) {
  if (!muscles) return 'other';
  // M-5 Fix: biceps is a pull muscle (matches train.js grouping)
  if (muscles.some(m => ['chest','triceps','front_delt','side_delt'].includes(m))) return 'push';
  if (muscles.some(m => ['back','rear_delt','traps','biceps'].includes(m))) return 'pull';
  if (muscles.some(m => ['quads','hamstrings','glutes','calves','adductors','abductors'].includes(m))) return 'legs';
  return 'other';
}

function PPL_META_LABEL(type, lang) {
  const map = { push: { en: 'Push', ru: 'Пуш' }, pull: { en: 'Pull', ru: 'Пул' }, legs: { en: 'Legs', ru: 'Ноги' } };
  return map[type]?.[lang] ?? type;
}

export default { mount, unmount };
