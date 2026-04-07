/**
 * env.example.js — шаблон для создания локального env.js
 *
 * Инструкция:
 *   1. Скопируй этот файл: cp env.example.js env.js
 *   2. Подставь реальные значения в env.js
 *   3. env.js в .gitignore — не попадёт в репозиторий
 *
 * Для деплоя на Vercel:
 *   Dashboard → Project → Settings → Environment Variables:
 *     SUPABASE_URL       = <твой Supabase URL>
 *     SUPABASE_ANON_KEY  = <твой Supabase Anon Key>
 */
window.__env__ = {
  SUPABASE_URL:      '',   // Вставь: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',   // Вставь: sb_publishable_...
};
