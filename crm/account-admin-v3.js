(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');if(!frame)return;
  let me=null,accounts=[],whatsapps=[],teams=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});let d={};try{d=await r.json()}catch{}return{r,d};}
  async function loadData(){
    try{const [m,u,w,s]=await Promise.all([api('/api/auth/me'),api('/api/users'),api('/api/whatsapp'),api('/api/state')]);if(m.r.ok&&m.d.ok)me=m.d.user;if(u.r.ok&&u.d.ok)accounts=u.d.accounts||[];if(w.r.ok&&w.d.ok)whatsapps=w.d.accounts||[];if(s.r.ok&&s.d.ok)teams=s.d.state?.teams||[];}catch(_){ }
  }
  function roleLabel(v){return({'普通销售':'销售','二级管理员 / 组长':'组长','一级管理员':'主管','超级管理员':'超级管理员'})[v]||v;}

  function styles(d){if(d.getElementById('pvAccountAdminV3Styles'))return;const st=d.createElement('style');st.id='pvAccountAdminV3Styles';st.textContent=`
    .pv-admin-btn{height:29px;padding:0 9px;border:1px solid #cfd5dc;background:#fff;border-radius:5px;color:#344054;font-size:11px;margin-right:5px;cursor:pointer}.pv-admin-btn:hover{background:#f8fafc}.pv-wa-toolbar{display:flex;gap:8px;align-items:center}.pv-admin-mask{position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;padding:20px}.pv-admin-mask.open{display:flex}.pv-admin-modal{width:min(620px,calc(100vw - 36px));max-height:88vh;overflow:auto;background:#fff;border:1px solid #d0d5dd;border-radius:9px;box-shadow:0 24px 70px rgba(15,23,42,.28)}.pv-admin-head{padding:16px 18px;border-bottom:1px solid #e4e7ec;display:flex;justify-content:space-between;align-items:center}.pv-admin-head h3{margin:0;font-size:16px}.pv-admin-close{border:0;background:transparent;font-size:22px;color:#667085;cursor:pointer}.pv-admin-body{padding:17px 18px}.pv-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pv-admin-field{display:block}.pv-admin-field.full{grid-column:1/-1}.pv-admin-field>span{display:block;font-size:12px;font-weight:600;color:#344054;margin-bottom:5px}.pv-admin-field input,.pv-admin-field select{width:100%;height:38px;border:1px solid #cfd5dc;border-radius:6px;padding:0 10px;font-size:13px;background:#fff}.pv-check-box{border:1px solid #e0e4ea;border-radius:6px;padding:10px;display:flex;flex-wrap:wrap;gap:8px}.pv-check-box label{display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;border-radius:5px;padding:6px 8px;font-size:12px}.pv-check-box input{width:14px;height:14px}.pv-admin-note{font-size:11px;color:#667085;line-height:1.55;margin-top:6px}.pv-admin-error{color:#b42318;font-size:12px;min-height:18px;margin-top:8px}.pv-admin-actions{padding:12px 18px;border-top:1px solid #e4e7ec;display:flex;justify-content:flex-end;gap:8px;background:#fafbfc}.pv-create-wa{grid-column:1/-1;border:1px solid #d8e1ef;background:#f8fafc;border-radius:6px;padding:10px 12px}.pv-create-wa>span{font-size:12px;font-weight:600;color:#344054;display:block;margin-bottom:7px}.pv-create-wa small{display:block;color:#667085;margin-top:6px}.pv-hidden{display:none!important}@media(max-width:680px){.pv-admin-grid{grid-template-columns:1fr}.pv-admin-field.full{grid-column:auto}}
  `;d.head.appendChild(st);}

  function ensureCreatePassword(d){
    const form=d.getElementById('accountForm');if(!form)return;
    let p=form.elements.namedItem('password');if(p)return;
    const grid=form.querySelector('.form-grid');if(!grid)return;
    const label=d.createElement('label');label.id='pvAccountPasswordField';label.innerHTML='<span>自定义登录密码 *</span><input name="password" type="password" minlength="4" required autocomplete="new-password" placeholder="至少 4 位"><small class="password-note">员工使用登录账号和此密码登录。</small>';
    const status=form.elements.namedItem('status')?.closest('label');if(status)grid.insertBefore(label,status);else grid.appendChild(label);
  }
  function patchCreateWa(d){
    const form=d.getElementById('accountForm'),grid=form?.querySelector('.form-grid');if(!grid)return;
    const old=d.getElementById('accountWaSelect')?.closest('label');if(old)old.classList.add('pv-hidden');
    let box=d.getElementById('pvCreateWhatsappBlock');if(!box){box=d.createElement('div');box.id='pvCreateWhatsappBlock';box.className='pv-create-wa';grid.appendChild(box);}
    const active=whatsapps.filter(w=>w.status==='正常');
    box.innerHTML=`<span>绑定 WhatsApp（可多选）</span><div class="pv-check-box">${active.length?active.map(w=>`<label><input type="checkbox" name="createWhatsapp" value="${esc(w.name)}"><b>${esc(w.name)}</b> · ${esc(w.number)}</label>`).join(''):'<em style="font-size:12px;color:#667085">暂无 WhatsApp 账号，请先到“WhatsApp账号”页新增。</em>'}</div><small>一个业务员可以绑定多个 WhatsApp；每个 WhatsApp 同一时间只归一个负责人。</small>`;
  }

  function mask(d){let m=d.getElementById('pvAdminMask');if(m)return m;m=d.createElement('div');m.id='pvAdminMask';m.className='pv-admin-mask';m.innerHTML='<div class="pv-admin-modal"><div class="pv-admin-head"><h3 id="pvAdminTitle"></h3><button class="pv-admin-close" type="button">×</button></div><div class="pv-admin-body" id="pvAdminBody"></div><div class="pv-admin-actions"><button type="button" class="button secondary" id="pvAdminCancel">取消</button><button type="button" class="button primary" id="pvAdminSave">保存</button></div></div>';d.body.appendChild(m);const close=()=>m.classList.remove('open');m.querySelector('.pv-admin-close').onclick=close;m.querySelector('#pvAdminCancel').onclick=close;m.addEventListener('click',e=>{if(e.target===m)close();});return m;}

  function roleOptions(current){const roles=me?.permissionGroup==='超级管理员'?['普通销售','二级管理员 / 组长','一级管理员','超级管理员']:['普通销售','二级管理员 / 组长'];return roles.map(r=>`<option value="${esc(r)}" ${r===current?'selected':''}>${esc(roleLabel(r))}</option>`).join('');}
  function teamOptions(current){return teams.map(t=>`<option value="${esc(t.name)}" ${t.name===current?'selected':''}>${esc(t.name)}</option>`).join('');}
  function waChecks(selected=[]){const set=new Set(selected||[]);return whatsapps.map(w=>`<label><input type="checkbox" name="editWhatsapp" value="${esc(w.name)}" ${set.has(w.name)?'checked':''}><b>${esc(w.name)}</b> · ${esc(w.number)}${w.owner&&w.owner!=='未绑定'&&!set.has(w.name)?` · 当前：${esc(w.owner)}`:''}</label>`).join('')||'<em style="font-size:12px;color:#667085">暂无 WhatsApp 账号</em>';}
  function orgFields(d,account){
    const role=d.getElementById('pvEditRole')?.value||account.permissionGroup,teamField=d.getElementById('pvEditTeamField'),managed=d.getElementById('pvEditManaged');if(!teamField||!managed)return;
    if(role==='超级管理员'){teamField.classList.add('pv-hidden');managed.classList.add('pv-hidden');}
    else if(role==='一级管理员'){teamField.classList.add('pv-hidden');managed.classList.remove('pv-hidden');}
    else{teamField.classList.remove('pv-hidden');managed.classList.add('pv-hidden');}
  }
  function openEdit(d,account){
    const m=mask(d);d.getElementById('pvAdminTitle').textContent='编辑业务员账号';
    d.getElementById('pvAdminBody').innerHTML=`<div class="pv-admin-grid"><label class="pv-admin-field"><span>登录账号</span><input value="${esc(account.login)}" disabled></label><label class="pv-admin-field"><span>业务备注名</span><input id="pvEditDisplay" value="${esc(account.displayName)}"></label><label class="pv-admin-field"><span>账号角色</span><select id="pvEditRole">${roleOptions(account.permissionGroup)}</select></label><label class="pv-admin-field" id="pvEditTeamField"><span>所属销售组</span><select id="pvEditTeam">${teamOptions(account.team)}</select></label><div class="pv-admin-field full pv-hidden" id="pvEditManaged"><span>管理销售组</span><div class="pv-check-box">${teams.map(t=>`<label><input type="checkbox" name="pvManagedEdit" value="${esc(t.name)}" ${(account.managedTeams||[]).includes(t.name)?'checked':''}>${esc(t.name)}</label>`).join('')}</div></div><label class="pv-admin-field"><span>账号状态</span><select id="pvEditStatus"><option ${account.status==='正常'?'selected':''}>正常</option><option ${account.status==='停用'?'selected':''}>停用</option></select></label><div class="pv-admin-field full"><span>绑定 WhatsApp（可多选）</span><div class="pv-check-box">${waChecks(account.whatsappAccounts||[])}</div><div class="pv-admin-note">修改业务备注名时，系统会同步迁移该业务员已有客户、订单和跟进记录的负责人名称。</div></div></div><div class="pv-admin-error" id="pvAdminError"></div>`;
    d.getElementById('pvEditRole').onchange=()=>orgFields(d,account);orgFields(d,account);
    d.getElementById('pvAdminSave').onclick=async()=>{
      const role=d.getElementById('pvEditRole').value,displayName=d.getElementById('pvEditDisplay').value.trim(),status=d.getElementById('pvEditStatus').value,team=role==='超级管理员'||role==='一级管理员'?'—':d.getElementById('pvEditTeam').value,managedTeams=role==='一级管理员'?[...d.querySelectorAll('input[name="pvManagedEdit"]:checked')].map(x=>x.value):[],whatsappAccounts=[...d.querySelectorAll('input[name="editWhatsapp"]:checked')].map(x=>x.value),err=d.getElementById('pvAdminError'),save=d.getElementById('pvAdminSave');
      if(displayName.length<2){err.textContent='业务备注名至少 2 个字符。';return;}if(role==='一级管理员'&&!managedTeams.length){err.textContent='主管至少选择一个管理销售组。';return;}
      save.disabled=true;save.textContent='保存中…';err.textContent='';
      const res=await api('/api/users',{method:'PATCH',body:JSON.stringify({username:account.login,displayName,permissionGroup:role,team,managedTeams,whatsappAccounts,status})});
      save.disabled=false;save.textContent='保存';if(!res.r.ok||!res.d.ok){err.textContent='保存失败：'+(res.d.message||res.d.error||res.r.status);return;}alert('账号资料已更新。');location.reload();
    };
    m.classList.add('open');
  }

  function ownerOptions(selected){return `<option value="">未绑定</option>`+accounts.filter(a=>a.status==='正常').map(a=>`<option value="${a.dbId||String(a.id).replace('U-','')}" ${Number(a.dbId||String(a.id).replace('U-',''))===Number(selected||0)?'selected':''}>${esc(a.displayName)} · ${esc(roleLabel(a.permissionGroup))}</option>`).join('');}
  function openWa(d,wa=null){
    const m=mask(d),editing=Boolean(wa);d.getElementById('pvAdminTitle').textContent=editing?'编辑 WhatsApp':'新增 WhatsApp';
    d.getElementById('pvAdminBody').innerHTML=`<div class="pv-admin-grid"><label class="pv-admin-field"><span>内部名称</span><input id="pvWaName" value="${esc(wa?.name||'')}" ${editing?'disabled':''} placeholder="例如 WA-US-01"></label><label class="pv-admin-field"><span>WhatsApp 号码</span><input id="pvWaNumber" value="${esc(wa?.number||'')}" placeholder="例如 +1 555 000 0000"></label><label class="pv-admin-field"><span>绑定负责人</span><select id="pvWaOwner">${ownerOptions(wa?.ownerUserId)}</select></label><label class="pv-admin-field"><span>状态</span><select id="pvWaStatus"><option ${wa?.status!=='停用'?'selected':''}>正常</option><option ${wa?.status==='停用'?'selected':''}>停用</option></select></label></div><div class="pv-admin-note">WhatsApp 名称用于客户来源和归属识别；创建后名称保持不变，号码、负责人和状态可以随时修改。</div><div class="pv-admin-error" id="pvAdminError"></div>`;
    d.getElementById('pvAdminSave').onclick=async()=>{const name=d.getElementById('pvWaName').value.trim(),number=d.getElementById('pvWaNumber').value.trim(),ownerUserId=d.getElementById('pvWaOwner').value||null,status=d.getElementById('pvWaStatus').value,err=d.getElementById('pvAdminError'),save=d.getElementById('pvAdminSave');if(!name||!number){err.textContent='内部名称和号码不能为空。';return;}save.disabled=true;save.textContent='保存中…';const res=await api('/api/whatsapp',{method:editing?'PATCH':'POST',body:JSON.stringify({name,number,ownerUserId,status})});save.disabled=false;save.textContent='保存';if(!res.r.ok||!res.d.ok){err.textContent='保存失败：'+(res.d.message||res.d.error||res.r.status);return;}alert(editing?'WhatsApp 已更新。':'WhatsApp 已新增。');location.reload();};
    m.classList.add('open');
  }

  function patchAccounts(d){
    const active=d.querySelector('[data-settings-tab="accounts"].active');if(!active)return;
    const table=d.querySelector('#settingsContent .setting-table');if(!table)return;
    table.querySelectorAll('tbody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')];if(!cells.length)return;const login=cells[0].textContent.trim(),a=accounts.find(x=>x.login===login);if(!a)return;let action=tr.querySelector('[data-account-actions-cell]');if(!action){action=d.createElement('td');action.dataset.accountActionsCell='1';tr.appendChild(action);}if(!action.querySelector('[data-edit-account]')){const b=d.createElement('button');b.type='button';b.className='pv-admin-btn';b.textContent='编辑资料';b.dataset.editAccount=login;b.onclick=()=>openEdit(d,a);action.prepend(b);}});
    ensureCreatePassword(d);patchCreateWa(d);
  }
  function patchWhatsapp(d){
    const active=d.querySelector('[data-settings-tab="whatsapp"].active');if(!active)return;
    const content=d.getElementById('settingsContent'),toolbar=content?.querySelector('.settings-toolbar'),table=content?.querySelector('.setting-table');if(!toolbar||!table)return;
    if(me?.permissionGroup==='超级管理员'&&!toolbar.querySelector('[data-add-wa]')){const b=d.createElement('button');b.type='button';b.className='button primary small';b.textContent='＋ 新增 WhatsApp';b.dataset.addWa='1';b.onclick=()=>openWa(d,null);toolbar.appendChild(b);}
    const head=table.querySelector('thead tr');if(me?.permissionGroup==='超级管理员'&&head&&!head.querySelector('[data-wa-action-head]')){const th=d.createElement('th');th.textContent='操作';th.dataset.waActionHead='1';head.appendChild(th);}
    if(me?.permissionGroup==='超级管理员')table.querySelectorAll('tbody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')];if(!cells.length)return;const name=cells[0].textContent.trim(),wa=whatsapps.find(w=>w.name===name);if(!wa)return;let td=tr.querySelector('[data-wa-action-cell]');if(!td){td=d.createElement('td');td.dataset.waActionCell='1';tr.appendChild(td);}if(!td.querySelector('button')){const b=d.createElement('button');b.type='button';b.className='pv-admin-btn';b.textContent='编辑';b.onclick=()=>openWa(d,wa);td.appendChild(b);}});
  }
  function patch(d){styles(d);patchAccounts(d);patchWhatsapp(d);}
  async function refreshAndPatch(){await loadData();try{patch(frame.contentDocument);}catch(_){}}

  frame.addEventListener('load',()=>{setTimeout(refreshAndPatch,120);setTimeout(refreshAndPatch,650);});
  setInterval(()=>{refreshAndPatch();},1800);
})();
