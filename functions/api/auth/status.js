import { ensureSchema, json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    await ensureSchema(context.env.DB);
    const row = await context.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    return json({ ok:true, setupRequired:Number(row?.n||0)===0 });
  } catch (e) {
    return json({ ok:false, error:'auth_status_failed', message:e?.message||String(e) }, 500);
  }
}
