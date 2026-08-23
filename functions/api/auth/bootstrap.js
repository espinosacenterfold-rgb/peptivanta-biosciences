import { ensureSchema, hashPassword, json, nowIso, randomToken, sessionCookie, sha256, audit } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    await ensureSchema(context.env.DB);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (Number(count?.n||0) > 0) return json({ ok:false, error:'already_initialized' }, 409);
    if (!context.env.BOOTSTRAP_TOKEN) return json({ ok:false, error:'bootstrap_secret_missing', variable:'BOOTSTRAP_TOKEN' }, 503);
    const body = await context.request.json();
    if (String(body.token||'') !== String(context.env.BOOTSTRAP_TOKEN)) return json({ ok:false, error:'invalid_bootstrap_token' }, 403);
    const username = String(body.username||'admin').trim().toLowerCase();
    const displayName = String(body.displayName||'Administrator').trim();
    const password = String(body.password||'');
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ ok:false, error:'invalid_username' }, 400);
    if (displayName.length < 2 || displayName.length > 60) return json({ ok:false, error:'invalid_display_name' }, 400);
    if (password.length < 10) return json({ ok:false, error:'password_too_short', min:10 }, 400);
    const hp = await hashPassword(password); const now = nowIso();
    const r = await context.env.DB.prepare(`INSERT INTO users(username,password_hash,password_salt,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(username,hp.hash,hp.salt,displayName,'超级管理员','管理层','[]',1,0,now,now).run();
    const userId = r.meta?.last_row_id;
    const token = randomToken(); const tokenHash = await sha256(token); const expires = new Date(Date.now()+12*3600*1000).toISOString();
    await context.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash,userId,expires,now).run();
    await audit(context.env.DB,{id:userId,display_name:displayName},'bootstrap_admin','user',String(userId));
    return json({ ok:true }, 200, { 'set-cookie':sessionCookie(token) });
  } catch (e) { return json({ ok:false, error:'bootstrap_failed', message:e?.message||String(e) }, 500); }
}
