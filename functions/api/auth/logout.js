import { clearSessionCookie, json, parseCookies, sha256 } from '../../_lib/auth.js';

export async function onRequestPost(context){
  try{
    const token=parseCookies(context.request).pv_session;
    if(token&&context.env?.DB){const h=await sha256(token);await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(h).run();}
    return json({ok:true},200,{'set-cookie':clearSessionCookie()});
  }catch(e){return json({ok:true},200,{'set-cookie':clearSessionCookie()});}
}
