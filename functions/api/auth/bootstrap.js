import { ensureSchema, hashPassword, json, nowIso, randomToken, sessionCookie, sha256, audit } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    await ensureSchema(context.env.DB);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (Number(count?.n||0) > 0) return json({ ok:false, error:'already_initialized' }, 409);
    if (!context.env.BOOTSTRAP_TOKEN) return json({ ok:false, error:'bootstrap_secret_missing', variable:'BOOTSTRAP_TOKEN' }, 503);

    const body = await context.request.json();
    if (String(body.token||'') !== String(context.env.BOOTSTRAP_TOKEN)) {
      return json({ ok:false, error:'invalid_bootstrap_token' }, 403);
    }

    // The first administrator is created automatically. The temporary password
    // is generated at runtime and returned only in this one bootstrap response;
    // it is never committed to GitHub or stored in plaintext in D1.
    const username = 'admin';
    const displayName = 'Administrator';
    const temporaryPassword = 'PV-' + randomToken(12);
    const hp = await hashPassword(temporaryPassword);
    const now = nowIso();

    const r = await context.env.DB.prepare(`INSERT INTO users(
      username,password_hash,password_salt,display_name,permission_group,team,managed_teams,
      is_active,must_change_password,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(username,hp.hash,hp.salt,displayName,'超级管理员','管理层','[]',1,0,now,now).run();

    const userId = r.meta?.last_row_id;
    const sessionToken = randomToken();
    const tokenHash = await sha256(sessionToken);
    const expires = new Date(Date.now()+12*3600*1000).toISOString();
    await context.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
      .bind(tokenHash,userId,expires,now).run();
    await audit(context.env.DB,{id:userId,display_name:displayName},'bootstrap_admin','user',String(userId));

    return json({
      ok:true,
      credentials:{ username, temporaryPassword }
    }, 200, { 'set-cookie':sessionCookie(sessionToken) });
  } catch (e) {
    return json({ ok:false, error:'bootstrap_failed', message:e?.message||String(e) }, 500);
  }
}
