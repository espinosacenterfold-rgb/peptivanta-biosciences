import { getCurrentUser, json, publicUser, ensureSchema } from '../../_lib/auth.js';

const SENSITIVE_PERMISSION = '成本利润';

async function enforceSensitivePermissionPolicy(db) {
  const r = await db.prepare("SELECT name,permissions FROM permission_groups WHERE name <> '超级管理员'").all();
  for (const row of (r.results || [])) {
    let permissions = [];
    try {
      const parsed = JSON.parse(row.permissions || '[]');
      permissions = Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
    const next = permissions.filter(p => p !== SENSITIVE_PERMISSION);
    if (next.length !== permissions.length) {
      await db.prepare('UPDATE permission_groups SET permissions=?,updated_at=? WHERE name=?')
        .bind(JSON.stringify(next), new Date().toISOString(), row.name).run();
    }
  }
}

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return json({ ok:false,error:'db_binding_missing',binding:'DB' },503);
    await ensureSchema(context.env.DB);
    await enforceSensitivePermissionPolicy(context.env.DB);
    await ensureSchema(context.env.DB);

    const count = await context.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (Number(count?.n||0)===0) return json({ ok:false,error:'setup_required' },401);
    const user = await getCurrentUser(context);
    if (!user) return json({ ok:false,error:'unauthorized' },401);

    const result = publicUser(user);
    if (user.permission_group !== '超级管理员') {
      result.permissions = (result.permissions || []).filter(p => p !== SENSITIVE_PERMISSION);
    }
    return json({ ok:true,user:result });
  } catch(e){ return json({ ok:false,error:'me_failed',message:e?.message||String(e) },500); }
}
