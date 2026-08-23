(() => {
  'use strict';

  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  let currentUser = null;

  const ROLES = {
    '普通销售': { label:'销售', summary:'用于一线业务员。' },
    '二级管理员 / 组长': { label:'组长', summary:'用于销售组负责人。' },
    '一级管理员': { label:'主管', summary:'用于管理一个或多个销售组。' },
    '超级管理员': { label:'超级管理员', summary:'系统最高权限账号，拥有全部数据和全部功能权限。' }
  };
  const BASE_ACCOUNT_GROUPS = ['普通销售','二级管理员 / 组长','一级管理员'];
  const SCOPE_LABELS = { owner:'仅本人数据', team:'本销售组', managed_teams:'所管理销售组', all:'全部数据' };
  const PERMISSION_SECTIONS = [
    ['客户',[['客户查看','查看客户'],['客户编辑','新增 / 编辑客户'],['负责人转移','转移客户负责人']]],
    ['销售过程',[['跟进管理','记录和编辑跟进'],['销售管道','推进销售阶段'],['报价管理','报价管理']]],
    ['订单与物流',[['订单管理','编辑可见订单'],['订单查看','查看可见订单'],['本人订单查看','仅本人订单'],['成本利润','查看成本和利润'],['物流管理','编辑物流信息'],['物流查看','查看物流信息']]],
    ['数据',[['数据分析','完整数据分析'],['小组数据分析','小组数据分析'],['数据导出','导出数据']]],
    ['管理',[['子账号管理','管理子账号'],['销售小组管理','管理销售小组'],['权限组管理','配置权限组'],['系统设置','系统设置']]]
  ];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel = v => ROLES[v]?.label || v || '—';

  async function api(url, opts={}) {
    const r = await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};try{d=await r.json()}catch{}
    return {r,d};
  }

  async function loadCurrentUser(){
    try{
      const res = await api('/api/auth/me');
      if(res.r.ok && res.d.ok) currentUser = res.d.user;
    }catch(_){ }
  }

  function accountGroups(){
    return currentUser?.permissionGroup === '超级管理员'
      ? [...BASE_ACCOUNT_GROUPS,'超级管理员']
      : [...BASE_ACCOUNT_GROUPS];
  }

  function patchStyles(d){
    if(d.getElementById('permissionUiStylesV2')) return;
    const st=d.createElement('style');st.id='permissionUiStylesV2';st.textContent=`
      .role-help-card{grid-column:1/-1;border:1px solid #d8e1ef;background:#f7f9fc;border-radius:6px;padding:11px 13px}.role-help-card strong{display:block;font-size:13px;margin-bottom:3px}.role-help-card p{margin:0;color:#667085;font-size:12px;line-height:1.55}.password-note{display:block;color:#667085;font-size:11px;margin-top:4px}
      .permission-editor{padding:16px}.permission-editor-head{margin-bottom:14px}.permission-editor-head h2{font-size:17px;margin:0}.permission-editor-head p{font-size:12px;color:#667085;margin:4px 0 0}.permission-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.permission-editor-card{border:1px solid #dce1e8;border-radius:8px;background:#fff;overflow:hidden}.permission-editor-card.super{border-color:#b9cbea;background:#fbfcff}
      .permission-card-head{padding:14px 15px;border-bottom:1px solid #e7eaf0;display:flex;justify-content:space-between;gap:12px}.permission-card-head h3{font-size:15px;margin:0}.permission-card-head p{font-size:11.5px;color:#667085;margin:3px 0 0}.permission-lock{font-size:11px;color:#315fbd;background:#edf4ff;border:1px solid #c7d7f4;border-radius:4px;padding:3px 7px;white-space:nowrap;height:max-content}
      .permission-scope{padding:12px 15px;border-bottom:1px solid #edf0f3;display:grid;grid-template-columns:105px 1fr;gap:10px;align-items:center}.permission-scope span{font-size:12px;color:#475467;font-weight:600}.permission-scope select{height:34px;border:1px solid #cfd5dc;border-radius:5px;background:#fff;padding:0 9px;font-size:12px}.permission-sections{padding:4px 15px 10px}.permission-section{padding:10px 0;border-bottom:1px solid #eef0f3}.permission-section:last-child{border-bottom:0}.permission-section-title{font-size:11px;color:#667085;font-weight:700;margin-bottom:7px}.permission-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px}.permission-check{display:flex;align-items:center;gap:7px;min-height:28px;font-size:12px;color:#344054}.permission-check input{width:15px;height:15px;margin:0;accent-color:#2f65c8}.permission-check.disabled{color:#98a2b3}
      .permission-card-actions{padding:11px 15px;border-top:1px solid #e7eaf0;display:flex;align-items:center;gap:10px}.permission-save-status{font-size:11px;color:#667085;margin-right:auto}.permission-save{min-width:88px}.permission-note{margin-top:12px;border-left:3px solid #315fbd;background:#f5f8ff;padding:10px 12px;color:#475467;font-size:12px;line-height:1.6}
      .account-action-btn{height:29px;padding:0 9px;border:1px solid #cfd5dc;background:#fff;color:#344054;border-radius:5px;font-size:11px;white-space:nowrap}.account-action-btn:hover{border-color:#98a2b3;background:#f8fafc}
      .pv-pass-mask{position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.48);display:none;align-items:center;justify-content:center;padding:20px}.pv-pass-mask.open{display:flex}.pv-pass-box{width:min(420px,calc(100vw - 40px));background:#fff;border:1px solid #d0d5dd;border-radius:9px;box-shadow:0 24px 70px rgba(15,23,42,.26);overflow:hidden}.pv-pass-head{padding:16px 18px;border-bottom:1px solid #e4e7ec;display:flex;align-items:center;justify-content:space-between}.pv-pass-head h3{margin:0;font-size:16px}.pv-pass-close{border:0;background:transparent;font-size:22px;color:#667085}.pv-pass-body{padding:17px 18px}.pv-pass-target{font-size:12px;color:#667085;margin:0 0 14px}.pv-pass-field{display:block;margin-bottom:12px}.pv-pass-field span{display:block;font-size:12px;color:#344054;font-weight:600;margin-bottom:5px}.pv-pass-field input{width:100%;height:38px;border:1px solid #cfd5dc;border-radius:6px;padding:0 10px;font-size:13px;outline:none}.pv-pass-field input:focus{border-color:#2f65c8;box-shadow:0 0 0 2px rgba(47,101,200,.1)}.pv-pass-error{min-height:20px;font-size:12px;color:#b42318;margin-top:2px}.pv-pass-actions{padding:12px 18px;border-top:1px solid #e4e7ec;display:flex;justify-content:flex-end;gap:8px;background:#fafbfc}
      @media(max-width:1000px){.permission-editor-grid{grid-template-columns:1fr}}@media(max-width:680px){.permission-checks{grid-template-columns:1fr}.permission-scope{grid-template-columns:1fr}}
    `;d.head.appendChild(st);
  }

  function patchPassword(d){
    const form=d.getElementById('accountForm'),p=form?.elements.namedItem('password');if(!p)return;
    p.minLength=4;p.setAttribute('minlength','4');p.placeholder='由管理员自行设置，至少 4 位';
    const label=p.closest('label'),title=label?.querySelector('span');if(title)title.textContent='自定义登录密码 *';
    let note=label?.querySelector('.password-note')||label?.querySelector('small');if(note)note.textContent='至少 4 位；创建账号时由管理员直接设置。';
  }

  function patchAccountModal(d){
    const form=d.getElementById('accountForm'),sel=d.getElementById('accountPermissionSelect');if(!form||!sel)return;
    const groups=accountGroups();
    const previous=sel.value;
    const wanted=groups.includes(previous)?previous:'普通销售';
    const signature=groups.join('|');
    if(sel.dataset.groups!==signature){
      sel.innerHTML=groups.map(v=>`<option value="${esc(v)}">${esc(roleLabel(v))}</option>`).join('');
      sel.dataset.groups=signature;
    }
    sel.value=groups.includes(wanted)?wanted:groups[0];
    const title=sel.closest('label')?.querySelector('span');if(title)title.textContent='账号角色 *';
    const wa=d.getElementById('accountWaSelect'),waTitle=wa?.closest('label')?.querySelector('span');if(waTitle)waTitle.textContent='绑定 WhatsApp（可选）';
    const grid=form.querySelector('.form-grid');if(grid&&!d.getElementById('roleHelpCard')){const box=d.createElement('div');box.id='roleHelpCard';box.className='role-help-card';grid.appendChild(box);}
    const help=d.getElementById('roleHelpCard');
    if(help){
      if(sel.value==='超级管理员') help.innerHTML='<strong>超级管理员</strong><p>拥有全部客户、订单、成本利润、数据分析、账号管理、权限组和系统设置权限。仅超级管理员可以创建新的超级管理员。</p>';
      else help.innerHTML=`<strong>${esc(roleLabel(sel.value))}</strong><p>具体的数据范围和功能权限在“权限组”页面配置。</p>`;
    }
    if(!sel.dataset.permissionBoundV2){sel.dataset.permissionBoundV2='1';sel.addEventListener('change',()=>patchAccountModal(d));}
    patchPassword(d);
  }

  function ensurePasswordDialog(d){
    let mask=d.getElementById('pvPasswordMask');if(mask)return mask;
    mask=d.createElement('div');mask.id='pvPasswordMask';mask.className='pv-pass-mask';
    mask.innerHTML=`<div class="pv-pass-box"><div class="pv-pass-head"><h3>修改登录密码</h3><button type="button" class="pv-pass-close" aria-label="关闭">×</button></div><div class="pv-pass-body"><p class="pv-pass-target" id="pvPassTarget"></p><label class="pv-pass-field"><span>新密码</span><input id="pvPass1" type="password" minlength="4" autocomplete="new-password" placeholder="至少 4 位"></label><label class="pv-pass-field"><span>再次输入新密码</span><input id="pvPass2" type="password" minlength="4" autocomplete="new-password" placeholder="再次输入"></label><div class="pv-pass-error" id="pvPassError"></div></div><div class="pv-pass-actions"><button type="button" class="button secondary" id="pvPassCancel">取消</button><button type="button" class="button primary" id="pvPassSave">保存新密码</button></div></div>`;
    d.body.appendChild(mask);
    const close=()=>{mask.classList.remove('open');mask.dataset.username='';d.getElementById('pvPass1').value='';d.getElementById('pvPass2').value='';d.getElementById('pvPassError').textContent='';};
    d.querySelector('.pv-pass-close').onclick=close;d.getElementById('pvPassCancel').onclick=close;
    mask.addEventListener('click',e=>{if(e.target===mask)close();});
    d.getElementById('pvPassSave').onclick=async()=>{
      const username=mask.dataset.username||'',p1=d.getElementById('pvPass1').value,p2=d.getElementById('pvPass2').value,error=d.getElementById('pvPassError'),save=d.getElementById('pvPassSave');
      error.textContent='';
      if(p1.length<4){error.textContent='密码至少 4 位。';return;}
      if(p1!==p2){error.textContent='两次输入的密码不一致。';return;}
      save.disabled=true;save.textContent='保存中…';
      try{
        const res=await api('/api/users',{method:'PATCH',body:JSON.stringify({username,password:p1,mustChangePassword:false})});
        if(!res.r.ok||!res.d.ok)throw new Error(res.d.message||res.d.error||`HTTP ${res.r.status}`);
        if(currentUser?.username===username){alert('密码已修改，请使用新密码重新登录。');window.location.replace('./login.html?passwordChanged=1');return;}
        alert(`账号 ${username} 的密码已修改。该账号原有登录会话已失效。`);close();
      }catch(e){error.textContent='修改失败：'+(e?.message||e);}finally{save.disabled=false;save.textContent='保存新密码';}
    };
    return mask;
  }

  function openPasswordDialog(d,username,displayName){
    const mask=ensurePasswordDialog(d);mask.dataset.username=username;d.getElementById('pvPassTarget').textContent=`账号：${username}${displayName&&displayName!==username?' · '+displayName:''}`;mask.classList.add('open');setTimeout(()=>d.getElementById('pvPass1')?.focus(),30);
  }

  function patchAccounts(d){
    const content=d.getElementById('settingsContent'),table=content?.querySelector('.setting-table');if(!table)return;
    const th=table.querySelectorAll('thead th');if(th[2])th[2].textContent='权限组';
    const headRow=table.querySelector('thead tr');if(headRow&&!headRow.querySelector('[data-account-actions-head]')){const h=d.createElement('th');h.textContent='操作';h.dataset.accountActionsHead='1';headRow.appendChild(h);}
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.querySelectorAll('td')];if(!cells.length)return;
      const username=cells[0].textContent.trim(),displayName=cells[1]?.textContent.trim()||username;
      if(cells[2]){if(!cells[2].dataset.rawPermissionGroup)cells[2].dataset.rawPermissionGroup=cells[2].textContent.trim().replace(/权限组$/,'');const raw=cells[2].dataset.rawPermissionGroup;cells[2].textContent=roleLabel(raw);}
      let action=tr.querySelector('[data-account-actions-cell]');if(!action){action=d.createElement('td');action.dataset.accountActionsCell='1';tr.appendChild(action);}
      if(!action.querySelector('[data-change-password]')){const btn=d.createElement('button');btn.type='button';btn.className='account-action-btn';btn.textContent='修改密码';btn.dataset.changePassword=username;btn.onclick=()=>openPasswordDialog(d,username,displayName);action.appendChild(btn);}
    });
    const title=content.querySelector('.settings-toolbar h2'),desc=content.querySelector('.settings-toolbar p');if(title)title.textContent='子账号管理';if(desc)desc.textContent='可创建销售、组长、主管；超级管理员还可以创建新的超级管理员。密码由管理员自行设置和修改。';
    const aside=content.querySelector('.settings-grid > aside.panel');if(aside)aside.innerHTML='<div class="settings-toolbar"><div><h2>账号与权限</h2><p>组织归属和功能权限分开管理。</p></div></div><div class="system-note"><b>销售小组</b>：决定账号属于哪个团队。<br><br><b>权限组</b>：决定能看哪些数据、能使用哪些功能。<br><br><b>修改密码</b>：在账号列表右侧操作，最低 4 位。<br><br><b>超级管理员</b>：拥有全部权限，超管之间可以新建超管账号。</div>';
    ensurePasswordDialog(d);
  }

  const checkbox=(k,l,on,locked)=>`<label class="permission-check ${locked?'disabled':''}"><input type="checkbox" data-permission="${esc(k)}" ${on?'checked':''} ${locked?'disabled':''}><span>${esc(l)}</span></label>`;
  function groupCard(g,all){
    const set=new Set(g.permissions||[]),locked=!!g.locked;
    const scopes=(g.allowedScopes||[]).map(s=>`<option value="${esc(s)}" ${s===g.scope?'selected':''}>${esc(SCOPE_LABELS[s]||s)}</option>`).join('');
    const sections=PERMISSION_SECTIONS.map(([name,items])=>`<div class="permission-section"><div class="permission-section-title">${esc(name)}</div><div class="permission-checks">${items.filter(([k])=>all.includes(k)).map(([k,l])=>checkbox(k,l,locked||set.has(k),locked)).join('')}</div></div>`).join('');
    return `<section class="permission-editor-card ${locked?'super':''}" data-permission-group="${esc(g.name)}"><div class="permission-card-head"><div><h3>${esc(g.label)}权限组</h3><p>${esc(ROLES[g.name]?.summary||'')}</p></div>${locked?'<span class="permission-lock">全部权限 · 已锁定</span>':''}</div><div class="permission-scope"><span>数据范围</span><select data-group-scope ${locked?'disabled':''}>${scopes}</select></div><div class="permission-sections">${sections}</div><div class="permission-card-actions"><span class="permission-save-status">${locked?'不可修改':'修改后点击保存'}</span>${locked?'':'<button type="button" class="button primary small permission-save">保存权限</button>'}</div></section>`;
  }

  async function renderPermissionEditor(d){
    const content=d.getElementById('settingsContent');if(!content||!d.querySelector('[data-settings-tab="permissions"].active'))return;
    if(content.dataset.permissionEditor==='loading'||content.dataset.permissionEditor==='ready')return;
    content.dataset.permissionEditor='loading';content.innerHTML='<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><h2>权限组</h2><p>正在读取数据库权限配置…</p></div></div></article>';
    try{
      const res=await api('/api/permission-groups');if(!res.r.ok||!res.d.ok)throw new Error(res.d.message||res.d.error||`HTTP ${res.r.status}`);if(!d.querySelector('[data-settings-tab="permissions"].active'))return;
      content.innerHTML=`<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><h2>权限组</h2><p>数据范围决定“能看谁的数据”；功能权限决定“能做什么”。</p></div><div class="permission-editor-grid">${res.d.groups.map(g=>groupCard(g,res.d.allPermissions||[])).join('')}</div><div class="permission-note">超级管理员固定为全部数据 + 全部功能权限。销售、组长、主管的配置保存到 D1。子账号刷新页面后会按最新权限组加载。</div></div></article>`;content.dataset.permissionEditor='ready';bindSaves(content);
    }catch(e){content.dataset.permissionEditor='error';content.innerHTML=`<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><h2>权限组</h2><p style="color:#b42318">读取失败：${esc(e?.message||e)}</p></div><button type="button" class="button secondary" id="retryPermissionGroups">重新读取</button></div></article>`;d.getElementById('retryPermissionGroups')?.addEventListener('click',()=>{delete content.dataset.permissionEditor;renderPermissionEditor(d);});}
  }

  function bindSaves(content){
    content.querySelectorAll('.permission-save').forEach(btn=>btn.addEventListener('click',async()=>{
      const card=btn.closest('[data-permission-group]'),status=card.querySelector('.permission-save-status');const payload={name:card.dataset.permissionGroup,scope:card.querySelector('[data-group-scope]')?.value,permissions:[...card.querySelectorAll('[data-permission]:checked')].map(x=>x.dataset.permission)};
      btn.disabled=true;btn.textContent='保存中…';status.textContent='正在写入数据库';
      try{const res=await api('/api/permission-groups',{method:'PUT',body:JSON.stringify(payload)});if(!res.r.ok||!res.d.ok)throw new Error(res.d.message||res.d.error||`HTTP ${res.r.status}`);status.textContent='已保存 · 子账号刷新后生效';btn.textContent='已保存';setTimeout(()=>{btn.textContent='保存权限';status.textContent='修改后点击保存';},1400);}catch(e){status.textContent='保存失败：'+(e?.message||e);btn.textContent='重新保存';}finally{btn.disabled=false;}
    }));
  }

  function refresh(d){
    if(!d?.documentElement)return;patchStyles(d);const tab=d.querySelector('[data-settings-tab="permissions"]');if(tab)tab.textContent='权限组';const active=d.querySelector('[data-settings-tab].active')?.dataset.settingsTab;if(active==='accounts')patchAccounts(d);if(active==='permissions')renderPermissionEditor(d);patchAccountModal(d);
  }

  function install(d){
    if(!d?.documentElement)return;patchStyles(d);
    if(d.documentElement.dataset.permissionUiInstalledV2!=='1'){
      d.documentElement.dataset.permissionUiInstalledV2='1';
      d.addEventListener('click',e=>{if(e.target.closest('#addAccountBtn'))setTimeout(()=>patchAccountModal(d),30);if(e.target.closest('[data-settings-tab]'))setTimeout(()=>refresh(d),30);},true);
    }
    refresh(d);
  }

  function attach(){try{install(frame.contentDocument);}catch(_){}}

  loadCurrentUser().finally(()=>{attach();});
  frame.addEventListener('load',()=>{setTimeout(attach,50);setTimeout(attach,450);});
  setInterval(attach,900);
})();
