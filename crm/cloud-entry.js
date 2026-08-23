const KEY='peptivanta-crm-v2';
const rawSet=Storage.prototype.setItem;
let revision=0,user=null,syncing=false,pending=null,suppress=false,lastServerUpdate='';

function overlay(text='正在连接共享数据库…'){
  let el=document.getElementById('cloudBoot');
  if(!el){el=document.createElement('div');el.id='cloudBoot';el.style.cssText='position:fixed;inset:0;z-index:5000;background:#f5f6f8;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#344054';el.innerHTML='<div style="text-align:center"><div style="width:34px;height:34px;border:3px solid #d0d5dd;border-top-color:#315fbd;border-radius:50%;margin:0 auto 14px;animation:pvspin .8s linear infinite"></div><strong id="cloudBootText"></strong><style>@keyframes pvspin{to{transform:rotate(360deg)}}</style></div>';document.body.appendChild(el)}
  document.getElementById('cloudBootText').textContent=text;return el;
}
function hideOverlay(){document.getElementById('cloudBoot')?.remove()}
function showFatal(title,detail){const el=overlay('');el.innerHTML=`<div style="max-width:560px;background:#fff;border:1px solid #d0d5dd;border-radius:8px;padding:22px 24px;box-shadow:0 14px 40px rgba(0,0,0,.08)"><h2 style="margin:0 0 8px;font-size:19px">${title}</h2><p style="margin:0;color:#667085;line-height:1.65">${detail}</p></div>`}
async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});let d={};try{d=await r.json()}catch{}return{r,d}}
function setLocal(state){suppress=true;rawSet.call(localStorage,KEY,JSON.stringify(state));suppress=false}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('加载失败: '+src));document.body.appendChild(s)})}
function currentLocal(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
function scheduleSync(value){pending=value;setTimeout(flushSync,180)}
async function flushSync(){if(syncing||!pending)return;syncing=true;const snapshot=pending;pending=null;try{const body={revision,state:JSON.parse(snapshot)};const{r,d}=await api('/api/state',{method:'PUT',body:JSON.stringify(body)});if(r.status===401){location.replace('./login.html');return}if(r.status===409&&d.state){revision=d.revision;setLocal(d.state);alert('共享数据库中已有其他人更新了数据。系统将刷新到最新版本，避免覆盖同事操作。');location.reload();return}if(!r.ok||!d.ok)throw new Error(d.message||d.error||'同步失败');revision=d.revision;lastServerUpdate=d.updatedAt||'';}catch(e){showSyncStatus('同步失败','error',e.message)}finally{syncing=false;if(pending)flushSync();else showSyncStatus('已同步','ok')}}
function installSyncHook(){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){original.call(this,k,v);if(this===localStorage&&k===KEY&&!suppress)scheduleSync(v)}}
function showSyncStatus(text,type='ok',detail=''){
  let el=document.getElementById('cloudSyncBadge');if(!el)return;el.textContent=type==='error'?'共享数据库：'+text:'共享数据库 · '+text;el.title=detail||lastServerUpdate||'';el.style.color=type==='error'?'#b42318':'#475467';
}
function has(p){return user?.permissions?.includes(p)}
function applyPermissions(){
  document.querySelectorAll('[data-pool-filter="mine"],[data-pool-filter="team"]').forEach(x=>x.style.display='none');
  const reports=document.querySelector('.nav-item[data-view="reports"]');if(reports&&!has('数据分析')&&!has('小组数据分析'))reports.style.display='none';
  const settings=document.querySelector('.nav-item[data-view="settings"]');if(settings&&!has('子账号管理')&&!has('销售小组管理')&&!has('权限组管理')&&!has('系统设置'))settings.style.display='none';
  const exp=document.getElementById('exportBtn');if(exp&&!has('数据导出'))exp.style.display='none';
  if(!has('成本利润')){
    const css=document.createElement('style');css.textContent='#view-orders th:nth-child(6),#view-orders td:nth-child(6){display:none!important}#orderKpis .mini-kpi:nth-child(3){display:none!important}';document.head.appendChild(css);
  }
  const meta=document.querySelector('.sidebar-footer .user-meta');if(meta)meta.innerHTML=`<strong>${user.displayName}</strong><small>${user.permissionGroup}</small>`;
  const avatar=document.querySelector('.sidebar-footer .user-avatar');if(avatar)avatar.textContent=(user.displayName||'U').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const top=document.querySelector('.topbar-actions');if(top&&!document.getElementById('cloudSyncBadge')){
    const badge=document.createElement('span');badge.id='cloudSyncBadge';badge.style.cssText='font-size:12px;white-space:nowrap;color:#475467;padding:0 4px';badge.textContent='共享数据库 · 已同步';top.prepend(badge);
    const guide=document.createElement('a');guide.href='./guide.html';guide.target='_blank';guide.className='button secondary';guide.textContent='使用说明';top.appendChild(guide);
    const logout=document.createElement('button');logout.className='button secondary';logout.textContent='退出';logout.onclick=async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});location.replace('./login.html')};top.appendChild(logout);
  }
  enhanceAccountForm();
}
function enhanceAccountForm(){
  if(!has('子账号管理'))return;const form=document.getElementById('accountForm');if(!form||form.dataset.cloudAuth==='1')return;form.dataset.cloudAuth='1';
  const grid=form.querySelector('.form-grid');if(grid&&!form.elements.namedItem('password')){const l=document.createElement('label');l.innerHTML='<span>初始密码 *</span><input name="password" type="password" minlength="10" required autocomplete="new-password"><small style="color:#98a2b3">至少10位；创建后交给对应业务员。</small>';grid.appendChild(l)}
  form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const f=Object.fromEntries(new FormData(form));const payload={username:f.login,displayName:f.displayName,permissionGroup:f.permissionGroup,team:f.team,password:f.password,status:f.status,mustChangePassword:false,managedTeams:f.permissionGroup==='一级管理员'?[f.team]:[]};const{r,d}=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});if(!r.ok||!d.ok){alert('创建账号失败：'+(d.error||d.message||r.status));return}form.reset();location.reload()},true);
}
async function poll(){if(document.hidden||syncing||pending)return;try{const{r,d}=await api('/api/state');if(r.ok&&d.ok&&d.revision!==revision){setLocal(d.state);revision=d.revision;let b=document.getElementById('cloudSyncBadge');if(b){b.textContent='共享数据库 · 有新数据，点此刷新';b.style.cursor='pointer';b.onclick=()=>location.reload();}}}catch{}}

async function main(){
  overlay();
  const me=await api('/api/auth/me');
  if(me.r.status===401){location.replace('./login.html?return='+encodeURIComponent(location.pathname));return}
  if(!me.r.ok||!me.d.ok){if(me.d.error==='db_binding_missing')showFatal('数据库尚未绑定','Cloudflare Pages 需要绑定一个 D1 数据库，变量名必须为 DB。绑定后重新部署即可。');else showFatal('无法连接 CRM 后端',me.d.message||me.d.error||'未知错误');return}
  user=me.d.user;window.PV_CURRENT_USER=user;
  const stateRes=await api('/api/state');if(!stateRes.r.ok||!stateRes.d.ok){showFatal('无法读取共享数据库',stateRes.d.message||stateRes.d.error||'未知错误');return}
  let remote=stateRes.d.state, local=currentLocal();revision=stateRes.d.revision;lastServerUpdate=stateRes.d.updatedAt||'';
  if(user.permissionGroup==='超级管理员'&&(remote.customers||[]).length===0&&(local.customers||[]).length>0&&!localStorage.getItem('pv-cloud-migration-choice')){
    const useLocal=confirm(`检测到这台电脑已有 ${(local.customers||[]).length} 位本地客户，而共享数据库目前为空。\n\n确定：把本机现有 CRM 数据迁移到共享数据库。\n取消：使用空的共享数据库。`);
    localStorage.setItem('pv-cloud-migration-choice',useLocal?'import':'empty');
    if(useLocal){const imp=await api('/api/state',{method:'PUT',body:JSON.stringify({revision,state:local})});if(imp.r.ok&&imp.d.ok){remote=imp.d.state;revision=imp.d.revision}}
  }
  setLocal(remote);installSyncHook();
  await loadScript('./v4-core.js');await loadScript('./screenshot-ocrspace-v1.js');await loadScript('./doubleclick-v1.js');
  applyPermissions();hideOverlay();setInterval(poll,30000);
}
main().catch(e=>showFatal('CRM 启动失败',e?.message||String(e)));
