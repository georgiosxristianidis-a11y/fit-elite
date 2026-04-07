/**
 * api/env.js
 * Vercel Serverless Function — безопасная передача ENV vars клиенту.
 *
 * В продакшене (Vercel): читает переменные из Vercel Environment Variables.
 * Локально (http-server): этот файл не используется — используется /env.js.
 *
 * Настройка Vercel Dashboard:
 *   Settings → Environment Variables:
 *     SUPABASE_URL       = https://hkpuxvqzhcwgtbyjyinx.supabase.co
 *     SUPABASE_ANON_KEY  = sb_publishable_...
 */

export default function handler(req, res) {
  // Запрещаем кеширование — ключи должны обновляться при смене env
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  const config = {
    SUPABASE_URL:      process.env.SUPABASE_URL      || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  };

  // Возвращаем JS-скрипт который устанавливает window.__env__
  res.send(`window.__env__ = ${JSON.stringify(config)};`);
}
