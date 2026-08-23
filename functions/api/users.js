import { requireUser, listUsers, usersToAccounts, ROLE_DEFS, roleDef, hasPermission, parseManagedTeams, hashPassword, json, nowIso, audit } from '../_lib/auth.js';

function allowedTeamsFor(user){const d=roleDef(user);if(d.scope==='all')return null;if(d.scope==='managed_teams'){const a=parseManagedTeams(user);return a.length?a:[user.team]}return[user.team]}
function canManageTarget(actor,targetGroup,targetTeam){
  if(actor.permission_group==='超级管理员')return Boolean(ROLE_DEFS[targetGroup]);
  if(actor.permission_group==='一级管理员'){
    if(!['二级管理员 / 组长','普通销售'].includes(targetGroup))return false;
    const teams=allowedTeamsFor(actor)||[];return teams.includes(targetTeam);
  }
  return false;
}
function validate(body){
  const username=String(body.username||'').trim().toLowerCase(),displayName=String(body.displayName||'').trim(),permissionGroup=String(body.permissionGroup||''),team=String(body.team||'—');
  if(!/^[a-z0-9._-]{3,40}$/.test(username))return{error:'invalid_username'};
  if(displayName.length<2||displayName.length>60)return{error:'invalid_display_name'};
  if(!ROLE_DEFS[permissionGroup])return{error:'invalid_permission_group'};
  if(team.length<1||team.length>80)return{error:'invalid_team'};
  return{username,displayName,permissionGroup,team};
}

export async function onRequestGet(context){
  try{const a=await requireUser(context);if(a.response)return a.response;if(!hasPermission(a.user,'子账号管理'))return json({ok:false,error:'forbidden'},403);let users=await listUsers(context.env.DB);const teams=allowedTeamsFor(a.user);if(teams)users=users.filter(u=>u.id===a.user.id||teams.includes(u.team));return json({ok:true,accounts:usersToAccounts(users)});}catch(e){return json({ok:false,error:'users_get_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPost(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(!hasPermission(a.user,'子账号管理'))return json({ok:false,error:'forbidden'},403);
    const body=await context.request.json(),v=validate(body);if(v.error)return json({ok:false,error:v.error},400);
    if(!canManageTarget(a.user,v.permissionGroup,v.team))return json({ok:false,error:'forbidden_target_scope'},403);
    const password=String(body.password||'');if(password.length<4)return json({ok:false,error:'password_too_short',min:4},400);
    const managed=Array.isArray(body.managedTeams)?body.managedTeams.filter(Boolean):[];
    if(v.permissionGroup==='一级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'forbidden_target_role'},403);
    if(v.permissionGroup==='超级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const hp=await hashPassword(password),now=nowIso();
    try{
      const r=await context.env.DB.prepare(`INSERT INTO users(username,password_hash,password_salt,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(v.username,hp.hash,hp.salt,v.displayName,v.permissionGroup,v.team,JSON.stringify(managed),body.status==='停用'?0:1,body.mustChangePassword===false?0:1,now,now).run();
      await audit(context.env.DB,a.user,'create_user','user',String(r.meta?.last_row_id),{username:v.username,permissionGroup:v.permissionGroup,team:v.team});
      return json({ok:true,id:r.meta?.last_row_id});
    }catch(e){if(String(e?.message||'').toLowerCase().includes('unique'))return json({ok:false,error:'username_exists'},409);throw e;}
  }catch(e){return json({ok:false,error:'users_create_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPatch(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(!hasPermission(a.user,'子账号管理'))return json({ok:false,error:'forbidden'},403);
    const body=await context.request.json();
    const id=Number(body.id||0),username=String(body.username||'').trim().toLowerCase();
    if(!id&&!username)return json({ok:false,error:'missing_target'},400);
    const target=id
      ? await context.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first()
      : await context.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
    if(!target)return json({ok:false,error:'not_found'},404);
    const targetId=Number(target.id),permissionGroup=String(body.permissionGroup||target.permission_group),team=String(body.team||target.team);
    if(permissionGroup==='超级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    if(!canManageTarget(a.user,permissionGroup,team)&&a.user.id!==targetId)return json({ok:false,error:'forbidden_target_scope'},403);
    const displayName=String(body.displayName||target.display_name).trim(),managed=Array.isArray(body.managedTeams)?body.managedTeams:parseManagedTeams(target),active=body.status?body.status!=='停用':Boolean(target.is_active),now=nowIso();
    await context.env.DB.prepare('UPDATE users SET display_name=?,permission_group=?,team=?,managed_teams=?,is_active=?,updated_at=? WHERE id=?').bind(displayName,permissionGroup,team,JSON.stringify(managed),active?1:0,now,targetId).run();
    if(body.password!==undefined){
      const p=String(body.password||'');if(p.length<4)return json({ok:false,error:'password_too_short',min:4},400);
      const hp=await hashPassword(p);
      await context.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,must_change_password=?,updated_at=? WHERE id=?').bind(hp.hash,hp.salt,body.mustChangePassword===false?0:1,now,targetId).run();
      await context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(targetId).run();
    }
    await audit(context.env.DB,a.user,'update_user','user',String(targetId),{username:target.username,permissionGroup,team,active,passwordChanged:body.password!==undefined});return json({ok:true,id:targetId,username:target.username});
  }catch(e){return json({ok:false,error:'users_update_failed',message:e?.message||String(e)},500);}
}
