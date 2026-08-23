import { ensureSchema, hashPassword, json, nowIso, randomToken, sessionCookie, sha256, audit } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    if (!context.env.BOOTSTRAP_TOKEN) return json({ ok:false, error:'bootstrap_secret_missing', variable:'BOOTSTRAP_TOKEN' }, 503);
    await ensureSchema(context.env.DB);
    const body = await context.request.json();
    if (String(body.token||'') !== String(context.env.BOOTSTRAP_TOKEN)) return json({ ok:false, error:'invalid_bootstrap_token' }, 403);

    const username = 'admin';
    const displayName = 'Administrator';
    const temporaryPassword = randomToken(18);
    const hp = await hashPassword(temporaryPassword);
    const now = nowIso();
    let user = await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
    let userId;

    if (user) {
      userId = user.id;
      await context.env.DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,display_name=?,permission_group='超级管理员',team='管理层',managed_teams='[]',is_active=1,must_change_password=0,updated_at=? WHERE id=?`)
        .bind(hp.hash,hp.salt,displayName,now,userId).run();
      await context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
    } else {
      const r = await context.env.DB.prepare(`INSERT INTO users(username,password_hash,password_salt,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(username,hp.hash,hp.salt,displayName,'超级管理员','管理层','[]',1,0,now,now).run();
      userId = r.meta?.last_row_id;
    }

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expires = new Date(Date.now()+12*3600*1000).toISOString();
    await context.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash,userId,expires,now).run();
    await audit(context.env.DB,{id:userId,display_name:displayName},user?'recover_admin':'bootstrap_admin','user',String(userId));

    return json({ ok:true, credentials:{ username, temporaryPassword } }, 200, { 'set-cookie':sessionCookie(token) });
  } catch (e) {
    return json({ ok:false, error:'admin_recovery_failed', message:e?.message||String(e) }, 500);
  }
}
