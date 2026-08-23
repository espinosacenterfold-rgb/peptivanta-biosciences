(() => {
  'use strict';

  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  const ROLES = {
    '普通销售': { label:'销售', summary:'用于一线业务员。' },
    '二级管理员 / 组长': { label:'组长', summary:'用于销售组负责人。' },
    '一级管理员': { label:'主管', summary:'用于管理一个或多个销售组。' },
    '超级管理员': { label:'超级管理员', summary:'系统最高权限账号，始终拥有全部权限。' }
  };
  const ACCOUNT_GROUPS = ['普通销售','二级管理员 / 组长','一级管理员'];

  const PERMISSION_SECTIONS = [
    ['客户', [
      ['客户查看','查看客户'],['客户编辑','新增 / 编辑客户'],['负责人转移','转移客户负责人']
    ]],
    ['销售过程', [
      ['跟进管理','记录和编辑跟进'],['销售管道','推进销售阶段'],['报价管理','报价管理']
    ]],
    ['订单与物流', [
      ['订单管理','编辑可见订单'],['订单查看','查看可见订单'],['本人订单查看','仅本人订单'],
      ['成本利润','查看成本和利润'],['物流管理','编辑物流信息'],['物流查看','查看物流信息']
    ]],
    ['数据', [
      ['数据分析','完整数据分析'],['小组数据分析','小组数据分析'],['数据导出','导出数据']
    ]],
    ['管理', [
      ['子账号管理','管理子账号'],['销售小组管理','管理销售小组'],['权限组管理','配置权限组'],['系统设置','系统设置']
    ]]
  ];

  const SCOPE_LABELS = {
    owner:'仅本人数据', team:'本销售组', managed_teams:'所管理销售组', all:'全部数据'
  };

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function roleLabel(v){ return ROLES[v]?.label || v || '—'; }

  async function api(url, opts={}) {
    const r = await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};try{d=await r.json()}catch{}
    return {r,d};
  }

  function patchStyles(d) {
    if (d.getElementById('roleUiStyles')) return;
    const st=d.createElement('style');st.id='roleUiStyles';
    st.textContent=`
      .role-help-card{grid-column:1/-1;border:1px solid #d7e1ef;background:#f7f9fc;border-radius:6px;padding:11px 13px;margin-top:-2px}
      .role-help-card strong{display:block;font-size:13px;color:#172033;margin-bottom:3px}.role-help-card p{margin:2px 0;color:#667085;font-size:12px;line-height:1.55}
      .permission-editor{padding:16px}.permission-editor-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.permission-editor-head h2{margin:0;font-size:17px}.permission-editor-head p{margin:4px 0 0;color:#667085;font-size:12px}
      .permission-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.permission-editor-card{border:1px solid #dce1e8;border-radius:8px;background:#fff;overflow:hidden}.permission-editor-card.super{border-color:#b9cbea;background:#fbfcff}
      .permission-card-head{padding:14px 15px;border-bottom:1px solid #e7eaf0;display:flex;justify-content:space-between;gap:12px}.permission-card-head h3{margin:0;font-size:15px}.permission-card-head p{margin:3px 0 0;color:#667085;font-size:11.5px}.permission-lock{font-size:11px;color:#315fbd;background:#edf4ff;border:1px solid #c7d7f4;border-radius:4px;padding:3px 7px;white-space:nowrap;height:max-content}
      .permission-scope{padding:12px 15px;border-bottom:1px solid #edf0f3;display:grid;grid-template-columns:105px 1fr;gap:10px;align-items:center}.permission-scope span{font-size:12px;color:#475467;font-weight:600}.permission-scope select{height:34px;border:1px solid #cfd5dc;border-radius:5px;background:#fff;padding:0 9px;font-size:12px}
      .permission-sections{padding:4px 15px 10px}.permission-section{padding:10px 0;border-bottom:1px solid #eef0f3}.permission-section:last-child{border-bottom:0}.permission-section-title{font-size:11px;color:#667085;font-weight:700;margin-bottom:7px}.permission-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px}.permission-check{display:flex;align-items:center;gap:7px;min-height:28px;font-size:12px;color:#344054}.permission-check input{width:15px;height:15px;margin:0;accent-color:#2f65c8}.permission-check.disabled{color:#98a2b3}
      .permission-card-actions{padding:11px 15px;border-top:1px solid #e7eaf0;display:flex;justify-content:flex-end;align-items:center;gap:10px}.permission-save-status{font-size:11px;color:#667085;margin-right:auto}.permission-save{min-width:88px}
      .permission-note{margin-top:12px;border-left:3px solid #315fbd;background:#f5f8ff;padding:10px 12px;color:#475467;font-size:12px;line-height:1.6}
      .password-note{display:block;color:#667085;font-size:11px;margin-top:4px}
      @media(max-width:1000px){.permission-editor-grid{grid-template-columns:1fr}.permission-checks{grid-template-columns:1fr 1fr}}
      @media(max-width:680px){.permission-checks{grid-template-columns:1fr}.permission-scope{grid-template-columns:1fr}}
    `;
    d.head.appendChild(st);
  }

  function patchPasswordField(d){
    const form=d.getElementById('accountForm');if(!form)return;
    const p=form.elements.namedItem('password');if(!p)return;
    const label=p.closest('label');const span=label?.querySelector('span');if(span)span.textContent='自定义登录密码 *';
    p.placeholder='由管理员自行设置，至少 10 位';
    let note=label?.querySelector('.password-note');
    if(!note&&label){note=d.createElement('small');note.className='password-note';note.textContent='创建账号时直接设置该员工的登录密码。';label.appendChild(note);}
  }

  function updateGroupHelp(d){
    const sel=d.getElementById('accountPermissionSelect'),box=d.getElementById('roleHelpCard');if(!sel||!box)return;
    const r=ROLES[sel.value]||ROLES['普通销售'];
    box.innerHTML=`<strong>${esc(r.label)}权限组</strong><p>${esc(r.summary)} 具体功能权限可在“权限组”页面单独调整。</p>`;
    const team=d.getElementById('accountTeamSelect');const span=team?.closest('label')?.querySelector('span');
    if(span)span.textContent=sel.value==='一级管理员'?'主管所属 / 默认销售组 *':'所属销售小组 *';
  }

  function patchAccountModal(d){
    const form=d.getElementById('accountForm'),sel=d.getElementById('accountPermissionSelect');if(!form||!sel)return;
    const current=ACCOUNT_GROUPS.includes(sel.value)?sel.value:'普通销售';
    sel.innerHTML=ACCOUNT_GROUPS.map(v=>`<option value="${esc(v)}">${esc(roleLabel(v))}权限组</option>`).join('');sel.value=current;
    const span=sel.closest('label')?.querySelector('span');if(span)span.textContent='权限组 *';
    const wa=d.getElementById('accountWaSelect');const ws=wa?.closest('label')?.querySelector('span');if(ws)ws.textContent='绑定 WhatsApp（可选）';
    const grid=form.querySelector('.form-grid');if(grid&&!d.getElementById('roleHelpCard')){const x=d.createElement('div');x.id='roleHelpCard';x.className='role-help-card';const anchor=sel.closest('label');if(anchor?.nextSibling)grid.insertBefore(x,anchor.nextSibling);else grid.appendChild(x);}
    if(!sel.dataset.permissionUiBound){sel.dataset.permissionUiBound='1';sel.addEventListener('change',()=>updateGroupHelp(d));}
    patchPasswordField(d);updateGroupHelp(d);
    setTimeout(()=>patchPasswordField(d),200);
  }

  function patchAccountsTable(d){
    const content=d.getElementById('settingsContent');if(!content)return;const table=content.querySelector('.setting-table');if(!table)return;
    const heads=table.querySelectorAll('thead th');if(heads[2])heads[2].textContent='权限组';
    table.querySelectorAll('tbody tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c[2])c[2].textContent=roleLabel(c[2].textContent.trim())+'权限组';});
    const title=content.querySelector('.settings-toolbar h2'),desc=content.querySelector('.settings-toolbar p');
    if(title)title.textContent='子账号管理';if(desc)desc.textContent='账号密码由管理员自行设置；权限由所选权限组统一控制。';
    const aside=content.querySelector('.settings-grid > aside.panel');if(aside)aside.innerHTML=`<div class="settings-toolbar"><div><h2>权限逻辑</h2><p>账号归属与功能权限分开。</p></div></div><div class="system-note"><b>销售组</b>决定人员组织归属。<br><br><b>权限组</b>决定这个账号能看多大范围的数据、能使用哪些功能。<br><br><b>登录密码</b>在新增账号时由管理员直接自定义。<br><br><b>超级管理员</b>始终拥有全部权限，不能降级。</div>`;
  }

  function permissionHtml(key,label,checked,locked){
    return `<label class="permission-check ${locked?'disabled':''}"><input type="checkbox" data-permission="${esc(key)}" ${checked?'checked':''} ${locked?'disabled':''}><span>${esc(label)}</span></label>`;
  }

  function groupCardHtml(group, allPermissions){
    const selected=new Set(group.permissions||[]),locked=group.locked;
    const scopeOptions=(group.allowedScopes||[]).map(s=>`<option value="${esc(s)}" ${s===group.scope?'selected':''}>${esc(SCOPE_LABELS[s]||s)}</option>`).join('');
    const sections=PERMISSION_SECTIONS.map(([title,items])=>`<div class="permission-section"><div class="permission-section-title">${esc(title)}</div><div class="permission-checks">${items.filter(([k])=>allPermissions.includes(k)).map(([k,l])=>permissionHtml(k,l,locked||selected.has(k),locked)).join('')}</div></div>`).join('');
    return `<section class="permission-editor-card ${locked?'super':''}" data-permission-group="${esc(group.name)}"><div class="permission-card-head"><div><h3>${esc(group.label)}权限组</h3><p>${esc(ROLES[group.name]?.summary||'')}</p></div>${locked?'<span class="permission-lock">全部权限 · 已锁定</span>':''}</div><div class="permission-scope"><span>数据范围</span><select data-group-scope ${locked?'disabled':''}>${scopeOptions}</select></div><div class="permission-sections">${sections}</div><div class="permission-card-actions"><span class="permission-save-status">${locked?'不可修改':'修改后点击保存'}</span>${locked?'':`<button class="button primary small permission-save" type="button">保存权限</button>`}</div></section>`;
  }

  async function renderPermissionEditor(d){
    const content=d.getElementById('settingsContent');const active=d.querySelector('[data-settings-tab="permissions"].active');if(!content||!active)return;
    if(content.dataset.permissionEditor==='loading'||content.dataset.permissionEditor==='ready')return;
    content.dataset.permissionEditor='loading';
    content.innerHTML='<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><div><h2>权限组</h2><p>正在读取数据库权限配置…</p></div></div></div></article>';
    const {r,data}= {r:null,data:null};
    try{
      const res=await api('/api/permission-groups');
      if(!res.r.ok||!res.d.ok)throw new Error(res.d.message||res.d.error||`HTTP ${res.r.status}`);
      if(!d.querySelector('[data-settings-tab="permissions"].active'))return;
      const editor=`<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><div><h2>权限组</h2><p>数据范围决定“能看谁的数据”；功能权限决定“能做什么”。</p></div></div><div class="permission-editor-grid">${res.d.groups.map(g=>groupCardHtml(g,res.d.allPermissions||[])).join('')}</div><div class="permission-note">超级管理员固定为全部数据 + 全部功能权限。销售、组长、主管的配置保存到 D1 数据库，已有账号会自动按最新权限组生效。</div></div></article>`;
      content.innerHTML=editor;content.dataset.permissionEditor='ready';
      bindPermissionEditor(d,content);
    }catch(e){content.dataset.permissionEditor='error';content.innerHTML=`<article class="panel full-panel"><div class="permission-editor"><div class="permission-editor-head"><div><h2>权限组</h2><p style="color:#b42318">读取失败：${esc(e?.message||e)}</p></div></div><button type="button" class="button secondary" id="retryPermissionGroups">重新读取</button></div></article>`;d.getElementById('retryPermissionGroups')?.addEventListener('click',()=>{delete content.dataset.permissionEditor;renderPermissionEditor(d);});}
  }

  function bindPermissionEditor(d,content){
    content.querySelectorAll('.permission-save').forEach(btn=>btn.addEventListener('click',async()=>{
      const card=btn.closest('[data-permission-group]'),name=card.dataset.permissionGroup,scope=card.querySelector('[data-group-scope]')?.value;
      const permissions=[...card.querySelectorAll('[data-permission]:checked')].map(x=>x.dataset.permission);
      const status=card.querySelector('.permission-save-status');btn.disabled=true;btn.textContent='保存中…';status.textContent='正在写入数据库';
      try{const res=await api('/api/permission-groups',{method:'PUT',body:JSON.stringify({name,scope,permissions})});if(!res.r.ok||!res.d.ok)throw new Error(res.d.message||res.d.error||`HTTP ${res.r.status}`);status.textContent='已保存 · 新权限立即生效';btn.textContent='已保存';setTimeout(()=>{btn.textContent='保存权限';status.textContent='修改后点击保存';},1200);}catch(e){status.textContent='保存失败：'+(e?.message||e);btn.textContent='重新保存';}finally{btn.disabled=false;}
    }));
  }

  function patchSettings(d){
    patchStyles(d);const active=d.querySelector('[data-settings-tab].active')?.dataset.settingsTab,content=d.getElementById('settingsContent');if(!content)return;
    const tab=d.querySelector('[data-settings-tab="permissions"]');if(tab)tab.textContent='权限组';
    if(active==='accounts')patchAccountsTable(d);
    if(active==='permissions')renderPermissionEditor(d);
  }

  function install(d){
    if(!d||d.documentElement.dataset.roleUiInstalled==='1')return;d.documentElement.dataset.roleUiInstalled='1';patchStyles(d);
    d.addEventListener('click',e=>{if(e.target.closest('#addAccountBtn'))setTimeout(()=>patchAccountModal(d),20);if(e.target.closest('[data-settings-tab]'))setTimeout(()=>{const c=d.getElementById('settingsContent');if(c)delete c.dataset.permissionEditor;patchSettings(d);},20);},true);
    const settings=d.getElementById('settingsContent');if(settings){let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;setTimeout(()=>{pending=false;const active=d.querySelector('[data-settings-tab].active')?.dataset.settingsTab;if(active==='accounts')patchAccountsTable(d);},30);}).observe(settings,{childList:true,subtree:true});}
    patchSettings(d);patchAccountModal(d);setTimeout(()=>{patchSettings(d);patchAccountModal(d);},500);
  }

  function attach(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,50);setTimeout(attach,500);});setInterval(attach,1500);
})();
