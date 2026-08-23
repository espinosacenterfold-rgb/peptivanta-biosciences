import { requireUser, listWhatsapps, parseManagedTeams, roleDef, json, nowIso, audit } from '../_lib/auth.js';

function cleanName(v){return String(v||'').trim();}
function validName(v){return /^[A-Za-z0-9._-]{2,50}$/.test(v);}
function canSee(user,w){
  const scope=roleDef(user).scope;
  if(scope==='all')return true;
  if(scope==='owner')return Number(w.ownerUserId||0)===Number(user.id);
  if(scope==='team')return w.ownerTeam===user.team;
  return parseManagedTeams(user).includes(w.ownerTeam);
}

export async function onRequestGet(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    let rows=await listWhatsapps(context.env.DB);
    rows=rows.filter(w=>canSee(a.user,w));
    return json({ok:true,accounts:rows});
  }catch(e){return json({ok:false,error:'whatsapp_get_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPost(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const body=await context.request.json(),name=cleanName(body.name),number=String(body.number||'').trim(),status=body.status==='停用'?'停用':'正常';
    if(!validName(name))return json({ok:false,error:'invalid_name'},400);
    if(number.length<4||number.length>60)return json({ok:false,error:'invalid_number'},400);
    let ownerUserId=body.ownerUserId?Number(body.ownerUserId):null;
    if(ownerUserId){const u=await context.env.DB.prepare('SELECT id FROM users WHERE id=? AND is_active=1').bind(ownerUserId).first();if(!u)return json({ok:false,error:'owner_not_found'},400);}
    const now=nowIso();
    try{
      const r=await context.env.DB.prepare('INSERT INTO whatsapp_accounts(name,number,owner_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(name,number,ownerUserId,status,now,now).run();
      await audit(context.env.DB,a.user,'create_whatsapp','whatsapp',String(r.meta?.last_row_id),{name,number,ownerUserId,status});
      return json({ok:true,id:r.meta?.last_row_id,name});
    }catch(e){if(String(e?.message||'').toLowerCase().includes('unique'))return json({ok:false,error:'name_exists'},409);throw e;}
  }catch(e){return json({ok:false,error:'whatsapp_create_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPatch(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const body=await context.request.json(),name=cleanName(body.name);
    if(!name)return json({ok:false,error:'missing_name'},400);
    const current=await context.env.DB.prepare('SELECT * FROM whatsapp_accounts WHERE name=?').bind(name).first();if(!current)return json({ok:false,error:'not_found'},404);
    const number=body.number!==undefined?String(body.number||'').trim():current.number,status=body.status!==undefined?(body.status==='停用'?'停用':'正常'):current.status;
    let ownerUserId=body.ownerUserId===undefined?current.owner_user_id:(body.ownerUserId?Number(body.ownerUserId):null);
    if(number.length<4||number.length>60)return json({ok:false,error:'invalid_number'},400);
    if(ownerUserId){const u=await context.env.DB.prepare('SELECT id FROM users WHERE id=? AND is_active=1').bind(ownerUserId).first();if(!u)return json({ok:false,error:'owner_not_found'},400);}
    await context.env.DB.prepare('UPDATE whatsapp_accounts SET number=?,owner_user_id=?,status=?,updated_at=? WHERE name=?').bind(number,ownerUserId,status,nowIso(),name).run();
    await audit(context.env.DB,a.user,'update_whatsapp','whatsapp',String(current.id),{name,number,ownerUserId,status});
    return json({ok:true,name});
  }catch(e){return json({ok:false,error:'whatsapp_update_failed',message:e?.message||String(e)},500);}
}
