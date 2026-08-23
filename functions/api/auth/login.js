import { ensureSchema, verifyPassword, hashPassword, json, nowIso, randomToken, sessionCookie, sha256, audit } from '../../_lib/auth.js';

// One-time emergency bootstrap credential. Only the SHA-256 fingerprint is stored
// in source. Once used, audit_log disables this bootstrap path permanently.
const EMERGENCY_ADMIN_FINGERPRINT = 'NyQ6p712gnCrvZtyur5_uxryHWi6tKR0Fax9gQqZnbw';

async function tryEmergencyAdmin(context, username, password) {
  if (username !== 'admin') return null;
  if ((await sha256(password)) !== EMERGENCY_ADMIN_FINGERPRINT) return null;

  const used = await context.env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='emergency_seed_used'").first();
  if (Number(used?.n || 0) > 0) return null;

  const now = nowIso();
  const hp = await hashPassword(password);
  let user = await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind('admin').first();

  if (user) {
    await context.env.DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,display_name='Administrator',permission_group='超级管理员',team='管理层',managed_teams='[]',is_active=1,must_change_password=1,updated_at=? WHERE id=?`)
      .bind(hp.hash, hp.salt, now, user.id).run();
    await context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
  } else {
    const r = await context.env.DB.prepare(`INSERT INTO users(username,password_hash,password_salt,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('admin', hp.hash, hp.salt, 'Administrator', '超级管理员', '管理层', '[]', 1, 1, now, now).run();
    user = await context.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(r.meta?.last_row_id).first();
  }

  if (!user) user = await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind('admin').first();
  await audit(context.env.DB, user, 'emergency_seed_used', 'user', String(user.id), { username: 'admin' });
  return user;
}

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    await ensureSchema(context.env.DB);
    const body = await context.request.json();
    const username = String(body.username||'').trim().toLowerCase();
    const password = String(body.password||'');

    let user = await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
    let valid = Boolean(user && user.is_active && await verifyPassword(password,user.password_salt,user.password_hash));

    if (!valid) {
      user = await tryEmergencyAdmin(context, username, password);
      valid = Boolean(user);
    }

    if (!valid) return json({ ok:false, error:'invalid_credentials' }, 401);

    const token=randomToken(), tokenHash=await sha256(token), now=nowIso(), expires=new Date(Date.now()+12*3600*1000).toISOString();
    await context.env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now).run();
    await context.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash,user.id,expires,now).run();
    await audit(context.env.DB,user,'login','session',null);
    return json({ ok:true, mustChangePassword:Boolean(user.must_change_password) },200,{ 'set-cookie':sessionCookie(token) });
  } catch(e){ return json({ ok:false,error:'login_failed',message:e?.message||String(e)},500); }
}
