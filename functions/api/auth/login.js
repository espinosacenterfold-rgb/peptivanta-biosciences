import { ensureSchema, verifyPassword, json, nowIso, randomToken, sessionCookie, sha256, audit } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok:false, error:'db_binding_missing', binding:'DB' }, 503);
    await ensureSchema(context.env.DB);
    const body = await context.request.json();
    const username = String(body.username||'').trim().toLowerCase();
    const password = String(body.password||'');
    const user = await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
    if (!user || !user.is_active || !(await verifyPassword(password,user.password_salt,user.password_hash))) {
      return json({ ok:false, error:'invalid_credentials' }, 401);
    }
    const token=randomToken(), tokenHash=await sha256(token), now=nowIso(), expires=new Date(Date.now()+12*3600*1000).toISOString();
    await context.env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now).run();
    await context.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash,user.id,expires,now).run();
    await audit(context.env.DB,user,'login','session',null);
    return json({ ok:true, mustChangePassword:Boolean(user.must_change_password) },200,{ 'set-cookie':sessionCookie(token) });
  } catch(e){ return json({ ok:false,error:'login_failed',message:e?.message||String(e)},500); }
}
