import { getCurrentUser, json, publicUser, ensureSchema } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return json({ ok:false,error:'db_binding_missing',binding:'DB' },503);
    await ensureSchema(context.env.DB);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (Number(count?.n||0)===0) return json({ ok:false,error:'setup_required' },401);
    const user = await getCurrentUser(context);
    if (!user) return json({ ok:false,error:'unauthorized' },401);
    return json({ ok:true,user:publicUser(user) });
  } catch(e){ return json({ ok:false,error:'me_failed',message:e?.message||String(e) },500); }
}
