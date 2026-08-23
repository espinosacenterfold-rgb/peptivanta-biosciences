const enc = new TextEncoder();
const PASSWORD_PBKDF2_ITERATIONS = 100000;

export const ALL_PERMISSIONS = [
  '客户查看','客户编辑','负责人转移','跟进管理','销售管道','报价管理',
  '订单管理','订单查看','本人订单查看','成本利润','物流管理','物流查看',
  '数据分析','小组数据分析','数据导出','子账号管理','销售小组管理','权限组管理','系统设置'
];

const BASE_ROLE_DEFS = {
  '超级管理员': { scope: 'all', permissions: [...ALL_PERMISSIONS] },
  '一级管理员': { scope: 'managed_teams', permissions: ['客户查看','客户编辑','负责人转移','跟进管理','销售管道','报价管理','订单管理','物流管理','数据分析','数据导出','子账号管理','销售小组管理'] },
  '二级管理员 / 组长': { scope: 'team', permissions: ['客户查看','客户编辑','跟进管理','销售管道','报价管理','订单查看','物流查看','小组数据分析'] },
  '普通销售': { scope: 'owner', permissions: ['客户查看','客户编辑','跟进管理','销售管道','报价管理','本人订单查看'] }
};

export const ROLE_DEFS = Object.fromEntries(Object.entries(BASE_ROLE_DEFS).map(([name,v]) => [name,{ scope:v.scope, permissions:[...v.permissions] }]));

const ROLE_SCOPE_LIMITS = {
  '普通销售': ['owner'],
  '二级管理员 / 组长': ['owner','team'],
  '一级管理员': ['owner','team','managed_teams'],
  '超级管理员': ['all']
};

function parsePermissionArray(value, fallback = []) {
  try {
    const a = JSON.parse(value || '[]');
    return Array.isArray(a) ? a.filter(x => ALL_PERMISSIONS.includes(x)) : [...fallback];
  } catch { return [...fallback]; }
}

async function loadPermissionGroups(db) {
  const r = await db.prepare('SELECT name,scope,permissions FROM permission_groups').all();
  for (const row of (r.results || [])) {
    if (!BASE_ROLE_DEFS[row.name]) continue;
    if (row.name === '超级管理员') {
      ROLE_DEFS[row.name] = { scope:'all', permissions:[...ALL_PERMISSIONS] };
      continue;
    }
    const allowedScopes = ROLE_SCOPE_LIMITS[row.name] || [BASE_ROLE_DEFS[row.name].scope];
    const scope = allowedScopes.includes(row.scope) ? row.scope : BASE_ROLE_DEFS[row.name].scope;
    ROLE_DEFS[row.name] = {
      scope,
      permissions: parsePermissionArray(row.permissions, BASE_ROLE_DEFS[row.name].permissions)
    };
  }
}

export async function ensureSchema(db) {
  const sql = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      permission_group TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT '—',
      managed_teams TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS permission_groups (
      name TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      permissions TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`
  ];
  await db.batch(sql.map(q => db.prepare(q)));

  const now = nowIso();
  const seeds = Object.entries(BASE_ROLE_DEFS).map(([name,v]) =>
    db.prepare('INSERT OR IGNORE INTO permission_groups(name,scope,permissions,is_locked,updated_at) VALUES(?,?,?,?,?)')
      .bind(name,v.scope,JSON.stringify(v.permissions),name==='超级管理员'?1:0,now)
  );
  await db.batch(seeds);
  await loadPermissionGroups(db);
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export function nowIso() { return new Date().toISOString(); }

function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64ToBytes(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  const raw = atob(s);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export function randomToken(size = 32) {
  const b = new Uint8Array(size); crypto.getRandomValues(b); return bytesToB64(b);
}
export async function sha256(text) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return bytesToB64(new Uint8Array(hash));
}
export async function hashPassword(password, saltB64 = null) {
  const salt = saltB64 ? b64ToBytes(saltB64) : (() => { const b = new Uint8Array(16); crypto.getRandomValues(b); return b; })();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations:PASSWORD_PBKDF2_ITERATIONS }, key, 256);
  return { hash: bytesToB64(new Uint8Array(bits)), salt: bytesToB64(salt) };
}
export async function verifyPassword(password, salt, expected) {
  const r = await hashPassword(password, salt);
  if (r.hash.length !== expected.length) return false;
  let diff = 0; for (let i=0;i<r.hash.length;i++) diff |= r.hash.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function parseCookies(request) {
  const out = {};
  for (const p of (request.headers.get('cookie') || '').split(';')) {
    const i = p.indexOf('='); if (i < 0) continue;
    out[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim());
  }
  return out;
}
export function sessionCookie(token, maxAge = 43200) {
  return `pv_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export function clearSessionCookie() {
  return 'pv_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

export function parseManagedTeams(user) {
  try { const a = JSON.parse(user.managed_teams || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
export function roleDef(userOrRole) {
  const name = typeof userOrRole === 'string' ? userOrRole : userOrRole?.permission_group;
  return ROLE_DEFS[name] || ROLE_DEFS['普通销售'];
}
export function hasPermission(user, permission) {
  if (user?.permission_group === '超级管理员') return true;
  return roleDef(user).permissions.includes(permission);
}
export function publicUser(user) {
  return { id:user.id, username:user.username, displayName:user.display_name, permissionGroup:user.permission_group, team:user.team, managedTeams:parseManagedTeams(user), permissions:user.permission_group === '超级管理员' ? [...ALL_PERMISSIONS] : [...roleDef(user).permissions], dataScope:roleDef(user).scope };
}

export async function getCurrentUser(context) {
  if (!context.env?.DB) throw new Error('D1 binding DB is missing');
  await ensureSchema(context.env.DB);
  const token = parseCookies(context.request).pv_session;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await context.env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.is_active=1`).bind(tokenHash, nowIso()).first();
  return row || null;
}
export async function requireUser(context) {
  const user = await getCurrentUser(context);
  if (!user) return { response: json({ ok:false, error:'unauthorized' }, 401), user:null };
  return { user, response:null };
}

export function canAccessCustomer(user, c) {
  const def = roleDef(user);
  if (def.scope === 'all') return true;
  if (def.scope === 'owner') return c.owner === user.display_name;
  if (def.scope === 'team') return c.team === user.team;
  const teams = parseManagedTeams(user); if (!teams.length && user.team && user.team !== '—') teams.push(user.team);
  return teams.includes(c.team);
}
export function canAssignCustomer(user, c) {
  const def = roleDef(user);
  if (def.scope === 'all') return true;
  if (def.scope === 'owner') return c.owner === user.display_name && c.team === user.team;
  if (def.scope === 'team') return c.team === user.team;
  const teams = parseManagedTeams(user); if (!teams.length && user.team && user.team !== '—') teams.push(user.team);
  return teams.includes(c.team);
}

export async function audit(db, user, action, entityType, entityId = null, details = null) {
  const actor = user?.display_name || user?.username || 'system';
  await db.prepare(`INSERT INTO audit_log(user_id,actor,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(user?.id || null, actor, action, entityType, entityId, details ? JSON.stringify(details) : null, nowIso()).run();
}

export function defaultState() {
  return {
    teams:[
      {id:'T-NA1',name:'北美组',manager:'Administrator',level:'一级销售组',status:'正常'},
      {id:'T-MX1',name:'墨西哥组',manager:'Administrator',level:'二级销售组',status:'正常'},
      {id:'T-AU1',name:'澳大利亚组',manager:'Administrator',level:'二级销售组',status:'正常'}
    ],
    permissions:Object.entries(ROLE_DEFS).map(([name,v],i)=>({id:`P-${i+1}`,name,scope:v.scope,permissions:[...v.permissions]})),
    whatsapp:[], accounts:[], customers:[], orders:[]
  };
}

export async function ensureState(db) {
  let row = await db.prepare('SELECT data,revision,updated_at FROM app_state WHERE id=1').first();
  if (!row) {
    const state = defaultState();
    const now = nowIso();
    await db.prepare('INSERT INTO app_state(id,data,revision,updated_at) VALUES(1,?,?,?)').bind(JSON.stringify(state),1,now).run();
    row = { data:JSON.stringify(state), revision:1, updated_at:now };
  }
  return row;
}

export async function listUsers(db) {
  const r = await db.prepare('SELECT id,username,display_name,permission_group,team,managed_teams,is_active,must_change_password,created_at,updated_at FROM users ORDER BY id').all();
  return r.results || [];
}
export function usersToAccounts(users) {
  return users.map(u=>({ id:`U-${u.id}`, login:u.username, displayName:u.display_name, permissionGroup:u.permission_group, team:u.team, managedTeams:parseManagedTeams(u), whatsapp:'—', status:u.is_active ? '正常':'停用', mustChangePassword:Boolean(u.must_change_password) }));
}

export function scopeStateForUser(state, user, users = []) {
  const out = structuredClone(state || {});
  const visibleCustomers = (out.customers || []).filter(c => canAccessCustomer(user,c));
  const ids = new Set(visibleCustomers.map(c=>c.id));
  out.customers = visibleCustomers;
  out.orders = (out.orders || []).filter(o => o.customerId ? ids.has(o.customerId) : (visibleCustomers.some(c=>c.name===o.customer) || (roleDef(user).scope==='owner' && o.owner===user.display_name)));
  if (!hasPermission(user,'成本利润')) out.orders = out.orders.map(o=>({ ...o, cost:Number(o.amount||0), _costHidden:true }));
  const def = roleDef(user);
  let teams = out.teams || [];
  let visibleUsers = users;
  if (def.scope === 'owner') { teams = teams.filter(t=>t.name===user.team); visibleUsers = users.filter(u=>u.id===user.id); }
  else if (def.scope === 'team') { teams = teams.filter(t=>t.name===user.team); visibleUsers = users.filter(u=>u.team===user.team); }
  else if (def.scope === 'managed_teams') { const mt=parseManagedTeams(user); const allowed=mt.length?mt:[user.team]; teams=teams.filter(t=>allowed.includes(t.name)); visibleUsers=users.filter(u=>allowed.includes(u.team)||u.id===user.id); }
  out.teams = teams;
  out.accounts = usersToAccounts(visibleUsers);
  out.permissions = Object.entries(ROLE_DEFS).map(([name,v],i)=>({id:`P-${i+1}`,name,scope:v.scope,permissions:[...v.permissions]}));
  out.whatsapp = (out.whatsapp || []).filter(w => visibleUsers.some(u=>u.display_name===w.owner) || def.scope==='all');
  return out;
}
