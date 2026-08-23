import { requireUser, hasPermission, json, nowIso, audit, ALL_PERMISSIONS, ROLE_DEFS } from '../_lib/auth.js';

const LABELS = {
  '普通销售':'销售',
  '二级管理员 / 组长':'组长',
  '一级管理员':'主管',
  '超级管理员':'超级管理员'
};

const SCOPE_LABELS = {
  owner:'仅本人客户',
  team:'本销售组',
  managed_teams:'所管理销售组',
  all:'全部数据'
};

const FIXED_SCOPE = {
  '普通销售':'owner',
  '二级管理员 / 组长':'team',
  '一级管理员':'managed_teams',
  '超级管理员':'all'
};

function safePermissions(value){
  try{
    const a=JSON.parse(value||'[]');
    return Array.isArray(a)?a.filter(x=>ALL_PERMISSIONS.includes(x)):[];
  }catch{return[];}
}

export async function onRequestGet(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(!hasPermission(a.user,'权限组管理'))return json({ok:false,error:'forbidden'},403);
    const r=await context.env.DB.prepare('SELECT name,scope,permissions,is_locked,updated_at FROM permission_groups ORDER BY CASE name WHEN \'普通销售\' THEN 1 WHEN \'二级管理员 / 组长\' THEN 2 WHEN \'一级管理员\' THEN 3 ELSE 4 END').all();
    const groups=(r.results||[]).map(x=>{
      const fixed=FIXED_SCOPE[x.name]||x.scope;
      return {
        name:x.name,
        label:LABELS[x.name]||x.name,
        scope:fixed,
        scopeLabel:SCOPE_LABELS[fixed]||fixed,
        allowedScopes:[fixed],
        permissions:x.name==='超级管理员'?[...ALL_PERMISSIONS]:safePermissions(x.permissions),
        locked:x.name==='超级管理员'||Boolean(x.is_locked),
        scopeLocked:true,
        updatedAt:x.updated_at
      };
    });
    return json({ok:true,groups,allPermissions:[...ALL_PERMISSIONS],scopeLabels:SCOPE_LABELS});
  }catch(e){return json({ok:false,error:'permission_groups_get_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPut(context){
  try{
    const a=await requireUser(context);if(a.response)return a.response;
    if(a.user.permission_group!=='超级管理员')return json({ok:false,error:'super_admin_required'},403);
    const body=await context.request.json();
    const name=String(body.name||'');
    if(!ROLE_DEFS[name])return json({ok:false,error:'invalid_permission_group'},400);
    if(name==='超级管理员')return json({ok:false,error:'super_admin_locked'},400);
    const scope=FIXED_SCOPE[name];
    const permissions=Array.isArray(body.permissions)?[...new Set(body.permissions.filter(x=>ALL_PERMISSIONS.includes(x)))]:[];
    const now=nowIso();
    await context.env.DB.prepare('UPDATE permission_groups SET scope=?,permissions=?,updated_at=? WHERE name=?')
      .bind(scope,JSON.stringify(permissions),now,name).run();
    await audit(context.env.DB,a.user,'update_permission_group','permission_group',name,{scope,permissions});
    return json({ok:true,name,scope,permissions,updatedAt:now});
  }catch(e){return json({ok:false,error:'permission_groups_update_failed',message:e?.message||String(e)},500);}
}
