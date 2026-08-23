import { requireUser, ensureState, listUsers, scopeStateForUser, roleDef, hasPermission, canAccessCustomer, canAssignCustomer, json, nowIso, audit, ROLE_DEFS, usersToAccounts } from '../_lib/auth.js';

function parseState(row){try{return JSON.parse(row.data||'{}')}catch{return{teams:[],permissions:[],whatsapp:[],accounts:[],customers:[],orders:[]}}}
function byId(arr){return new Map((arr||[]).map(x=>[x.id,x]));}
function safeClone(v){return structuredClone(v||{});}
function managedTeams(user){try{const a=JSON.parse(user.managed_teams||'[]');return Array.isArray(a)&&a.length?a:[user.team]}catch{return[user.team]}}
function customerAllowedNew(user,c){return canAssignCustomer(user,c);}
function orderAllowed(user,o,customerMap){
  if(roleDef(user).scope==='all')return true;
  const c=o.customerId?customerMap.get(o.customerId):null;
  if(c)return canAccessCustomer(user,c);
  if(roleDef(user).scope==='owner')return o.owner===user.display_name;
  if(roleDef(user).scope==='team')return false;
  return false;
}
function sanitizeIncoming(candidate){
  const out=safeClone(candidate);out.customers=Array.isArray(out.customers)?out.customers:[];out.orders=Array.isArray(out.orders)?out.orders:[];out.teams=Array.isArray(out.teams)?out.teams:[];out.whatsapp=Array.isArray(out.whatsapp)?out.whatsapp:[];return out;
}

function mergeState(current,candidate,user){
  candidate=sanitizeIncoming(candidate);const def=roleDef(user);
  if(def.scope==='all'){
    const next={...current,...candidate};
    next.accounts=current.accounts||[];next.permissions=current.permissions||[];
    return next;
  }
  const next=safeClone(current), curCustomers=byId(current.customers), incomingCustomers=byId(candidate.customers);
  const mergedCustomers=[];
  for(const c of current.customers||[]){
    if(!canAccessCustomer(user,c)){mergedCustomers.push(c);continue;}
    const n=incomingCustomers.get(c.id);if(!n){mergedCustomers.push(c);continue;}
    const x={...c,...n};
    if(def.scope==='owner'){x.owner=user.display_name;x.team=user.team;}
    if(!canAssignCustomer(user,x)){x.owner=c.owner;x.team=c.team;}
    mergedCustomers.push(x);
  }
  for(const n of candidate.customers||[]){
    if(curCustomers.has(n.id))continue;
    const x={...n};if(def.scope==='owner'){x.owner=user.display_name;x.team=user.team;}
    if(customerAllowedNew(user,x))mergedCustomers.push(x);
  }
  next.customers=mergedCustomers;
  const globalCustomerMap=byId(mergedCustomers), curOrders=byId(current.orders), incomingOrders=byId(candidate.orders), mergedOrders=[];
  for(const o of current.orders||[]){
    if(!orderAllowed(user,o,globalCustomerMap)){mergedOrders.push(o);continue;}
    const n=incomingOrders.get(o.id);if(!n){mergedOrders.push(o);continue;}
    const x={...o,...n};
    if(!hasPermission(user,'成本利润'))x.cost=o.cost;
    if(def.scope==='owner')x.owner=user.display_name;
    mergedOrders.push(x);
  }
  for(const n of candidate.orders||[]){
    if(curOrders.has(n.id))continue;
    const x={...n};if(def.scope==='owner')x.owner=user.display_name;
    if(orderAllowed(user,x,globalCustomerMap)){if(!hasPermission(user,'成本利润'))x.cost=0;mergedOrders.push(x);}
  }
  next.orders=mergedOrders;
  return next;
}

export async function onRequestGet(context){
  try{
    const auth=await requireUser(context);if(auth.response)return auth.response;
    const row=await ensureState(context.env.DB), state=parseState(row), users=await listUsers(context.env.DB);
    state.accounts=usersToAccounts(users);state.permissions=Object.entries(ROLE_DEFS).map(([name,v],i)=>({id:`P-${i+1}`,name,scope:v.scope,permissions:v.permissions}));
    const scoped=scopeStateForUser(state,auth.user,users);
    return json({ok:true,state:scoped,revision:Number(row.revision||1),updatedAt:row.updated_at,scope:roleDef(auth.user).scope});
  }catch(e){return json({ok:false,error:'state_get_failed',message:e?.message||String(e)},500);}
}

export async function onRequestPut(context){
  try{
    const auth=await requireUser(context);if(auth.response)return auth.response;
    const body=await context.request.json();if(!body?.state)return json({ok:false,error:'missing_state'},400);
    const row=await ensureState(context.env.DB), revision=Number(row.revision||1), expected=Number(body.revision||0);
    if(expected!==revision){
      const users=await listUsers(context.env.DB), scoped=scopeStateForUser(parseState(row),auth.user,users);
      return json({ok:false,error:'revision_conflict',revision,state:scoped},409);
    }
    const current=parseState(row), next=mergeState(current,body.state,auth.user), nextRevision=revision+1, now=nowIso();
    await context.env.DB.prepare('UPDATE app_state SET data=?,revision=?,updated_at=? WHERE id=1 AND revision=?').bind(JSON.stringify(next),nextRevision,now,revision).run();
    await audit(context.env.DB,auth.user,'state_sync','crm','global',{from:revision,to:nextRevision});
    const users=await listUsers(context.env.DB);next.accounts=usersToAccounts(users);next.permissions=Object.entries(ROLE_DEFS).map(([name,v],i)=>({id:`P-${i+1}`,name,scope:v.scope,permissions:v.permissions}));
    return json({ok:true,revision:nextRevision,updatedAt:now,state:scopeStateForUser(next,auth.user,users)});
  }catch(e){return json({ok:false,error:'state_put_failed',message:e?.message||String(e)},500);}
}
