/**
 * router.js
 * App shell — mounts/unmounts screens, handles nav, toast, theme.
 *
 * Screens: home | train | stats | profile
 * Listens: nav:switch, toast, lang:changed, settings:changed
 */

import { bus } from './bus.js';
import { mount as mountHome,    unmount as unmountHome }    from '../screens/home.js';
import { mount as mountTrain,   unmount as unmountTrain }   from '../screens/train.js';
import { mount as mountStats,   unmount as unmountStats }   from '../screens/stats.js';
import { mount as mountProfile, unmount as unmountProfile } from '../screens/profile.js';
import { getSettings } from '../screens/profile.js';

// ─── State ───────────────────────────────────────────────────────────────────

let _current  = 'home';
let _lang     = 'en';
let _appEl    = null;
let _navItems = null;

const SCREENS = {
  home:    { mount: mountHome,    unmount: unmountHome    },
  train:   { mount: mountTrain,   unmount: unmountTrain   },
  stats:   { mount: mountStats,   unmount: unmountStats   },
  profile: { mount: mountProfile, unmount: unmountProfile },
};

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init(appEl, navEl) {
  _appEl    = appEl;
  _navItems = navEl.querySelectorAll('[data-s]');

  // Load persisted settings
  try {
    const s = JSON.parse(localStorage.getItem('fit_elite_settings') ?? '{}');
    _lang = s.lang ?? 'en';
    if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
  } catch (_) {}

  // Nav clicks
  _navItems.forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.s));
  });

  // Bus
  bus.on('nav:switch',      ({ screen }) => navigate(screen));
  bus.on('toast',           ({ msg, type }) => showToast(msg, type));
  bus.on('lang:changed',    ({ lang }) => { _lang = lang; _remount(); });
  bus.on('settings:changed',({ lang, theme }) => {
    if (lang)  _lang = lang;
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  });

  // Online / offline dot on island
  window.addEventListener('online',  () => bus.emit('net:online'));
  window.addEventListener('offline', () => bus.emit('net:offline'));

  // Initial screen
  navigate('home', true);
}

// ─── Navigate ────────────────────────────────────────────────────────────────

export function navigate(screen, silent = false) {
  if (!SCREENS[screen]) return;

  // Unmount current
  SCREENS[_current]?.unmount();

  // Update nav highlight
  _navItems?.forEach(el => {
    const on = el.dataset.s === screen;
    el.classList.toggle('on', on);
    const ico = el.querySelector('.material-symbols-outlined');
    if (ico) {
      ico.style.fontVariationSettings = on
        ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"
        : "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24";
    }
  });

  _current = screen;

  // Clear + mount
  if (!silent) _appEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'screen-in';
  _appEl.innerHTML = '';
  _appEl.appendChild(div);

  SCREENS[screen].mount(div, _lang);
}

// ─── Remount current (after lang change) ─────────────────────────────────────

function _remount() {
  SCREENS[_current]?.unmount();
  const div = document.createElement('div');
  div.className = 'screen-in';
  _appEl.innerHTML = '';
  _appEl.appendChild(div);
  SCREENS[_current].mount(div, _lang);
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function showToast(msg, type = 'ok') {
  const existing = document.querySelector('.toast');
  existing?.remove();

  const col = type === 'ok'  ? 'var(--p)'
    : type === 'err' ? 'var(--err)'
    : 'var(--info)';
  const ico = type === 'ok'  ? 'check_circle'
    : type === 'err' ? 'error'
    : 'info';

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <span class="material-symbols-outlined fi" style="font-size:16px;color:${col}">${ico}</span>
    ${msg}
  `;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-in'));
  setTimeout(() => {
    t.classList.remove('toast-in');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export default { init, navigate, showToast };
