import { requireUser, listUsers, usersToAccounts, ROLE_DEFS, roleDef, hasPermission, parseManagedTeams, hashPassword, json, nowIso, audit } from '../_lib/auth.js';

function allowedTeamsFor(user){
  const d=roleDef(user);
  if(d.scope==='all')return null;
  if(d.scope==='managed_teams'){
    const a=parseManagedTeams(user);
    return a.length?a:(user.team&&user.team!=='—'?[user.team]:[]);
  }
  return user.team&&user.team!=='—'?[user.team]:[];
}
function cleanTeams(value){
  return [...new Set((Array.isArray(value)?value:[]).map(x=>String(x||'').trim()).filter(x=>x&&x!=='—'&&x.length<=80))];
}
function normalizeOrg(permissionGroup,teamInput,managedInput){
  const rawTeam=String(teamInput||'').trim();
  const managed=cleanTeams(managedInput);
  if(permissionGroup==='超级管理员')return{team:'—',managedTeams:[]};
  if(permissionGroup==='一级管理员'){
    if(!managed.length)return{error:'managed_teams_required'};
    return{team:'—',managedTeams:managed};
  }
  if(!rawTeam||rawTeam==='—')return{error:'team_required'};
  return{team:rawTeam,managedTeams:[]};
}
function canManageTarget(actor,targetGroup,targetTeam){
  if(actor.permission_group==='超级管理员')return Boolean(ROLE_DEFS[targetGroup]);
  if(actor.permission_group==='一级管理员'){
    if(!['二级管理员 / 组长','普通销售'].includes(targetGroup))return false;
    const teams=allowedTeamsFor(actor)||[];
    return teams.includes(targetTeam);
  }
  return false;
}
function validateIdentity(body){
  const username=String(body.username||'').trim().toLowerCase();
  const displayName=String(body.displayName||'').trim();
  const permissionGroup=String(body.permissionGroup||'');
  if(!/^[a-z0-9._-]{3,40}$/.test(username))return{error:'invalid_username'};
  if(displayName.length<2||displayName.length>60)return{error:'invalid_display_name'};
  if(!ROLE_DEFS[permissionGroup])return{error:'invalid_permission_group'};
  return{username,displayName,permissionGroup};
}

export async function onRequestGet(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(!hasPermission(a.user,'子账号管理'))return json({ok:false,error:'forbidden'},403);
    await context.env.DB.prepare("UPDATE users SET team='—',managed_teams='[]' WHERE permission_group='超级管理员' AND (team<>'—' OR managed_teams<>'[]')").run();
    let users=await listUsers(context.env.DB);
    const teams=allowedTeamsFor(a.user);
    if(teams)users=users.filter(u=>u.id===a.user.id||teams.includes(u.team)||parseManagedTeams(u).some(t=>teams.includes(t)));
    return json({ok:true,accounts:usersToAccounts(users)});
  }catch(e){return json({ok:false,error:'users_get_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPost(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(!hasPermission(a.user,'子账号管理'))return json({ok:false,error:'forbidden'},403);
    const body=await context.request.json(),v=validateIdentity(body);if(v.error)return json({ok:false,error:v.error},400);
    const org=normalizeOrg(v.permissionGroup,body.team,body.managedTeams);if(org.error)return json({ok:false,error:org.error},400);
    if(!canManageTarget(a.user,v.permissionGroup,org.team))return json({ok:false,error:'forbidden_target_scope'},403);
    if(v.permissionGroup==='一级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'forbidden_target_role'},403);
    if(v.permissionGroup==='超级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const password=String(body.password||'');if(password.length<4)return json({ok:false,error:'password_too_short',min:4},400);
    const hp=await hashPassword(password),now=nowIso();
    try{
      const r=await context.env.DB.prepare(`INSERT INTO users(username,password_hash,password_salt,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(v.username,hp.hash,hp.salt,v.displayName,v.permissionGroup,org.team,JSON.stringify(org.managedTeams),body.status==='停用'?0:1,body.mustChangePassword===false?0:1,now,now).run();
      await audit(context.env.DB,a.user,'create_user','user',String(r.meta?.last_row_id),{username:v.username,permissionGroup:v.permissionGroup,team:org.team,managedTeams:org.managedTeams});
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
    const targetId=Number(target.id);
    const permissionGroup=String(body.permissionGroup||target.permission_group);
    if(!ROLE_DEFS[permissionGroup])return json({ok:false,error:'invalid_permission_group'},400);
    if(permissionGroup==='超级管理员'&&a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const managedSource=Array.isArray(body.managedTeams)?body.managedTeams:parseManagedTeams(target);
    const teamSource=body.team!==undefined?body.team:target.team;
    const org=normalizeOrg(permissionGroup,teamSource,managedSource);if(org.error)return json({ok:false,error:org.error},400);
    if(!canManageTarget(a.user,permissionGroup,org.team)&&a.user.id!==targetId)return json({ok:false,error:'forbidden_target_scope'},403);
    const displayName=String(body.displayName||target.display_name).trim();
    const active=body.status?body.status!=='停用':Boolean(target.is_active),now=nowIso();
    await context.env.DB.prepare('UPDATE users SET display_name=?,permission_group=?,team=?,managed_teams=?,is_active=?,updated_at=? WHERE id=?')
      .bind(displayName,permissionGroup,org.team,JSON.stringify(org.managedTeams),active?1:0,now,targetId).run();
    if(body.password!==undefined){
      const p=String(body.password||'');if(p.length<4)return json({ok:false,error:'password_too_short',min:4},400);
      const hp=await hashPassword(p);
      await context.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,must_change_password=?,updated_at=? WHERE id=?')
        .bind(hp.hash,hp.salt,body.mustChangePassword===false?0:1,now,targetId).run();
      await context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(targetId).run();
    }
    await audit(context.env.DB,a.user,'update_user','user',String(targetId),{username:target.username,permissionGroup,team:org.team,managedTeams:org.managedTeams,active,passwordChanged:body.password!==undefined});
    return json({ok:true,id:targetId,username:target.username});
  }catch(e){return json({ok:false,error:'users_update_failed',message:e?.message||String(e)},500);}
}
