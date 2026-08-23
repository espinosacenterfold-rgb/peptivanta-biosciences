(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;

  let currentUser=null;

  async function api(url,opts={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};try{d=await r.json()}catch{}
    return{r,d};
  }
  async function loadMe(){
    try{const x=await api('/api/auth/me');if(x.r.ok&&x.d.ok)currentUser=x.d.user;}catch(_){ }
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function patchStyles(d){
    if(d.getElementById('pvOrgModelStyles'))return;
    const st=d.createElement('style');st.id='pvOrgModelStyles';st.textContent=`
      .pv-managed-teams{grid-column:1/-1;border:1px solid #d7dee8;border-radius:6px;background:#fbfcfd;padding:12px 13px}.pv-managed-teams>span{display:block;font-size:12px;font-weight:600;color:#344054;margin-bottom:8px}.pv-team-checks{display:flex;flex-wrap:wrap;gap:8px}.pv-team-check{display:flex;align-items:center;gap:6px;border:1px solid #d7dee8;background:#fff;border-radius:5px;padding:7px 9px;font-size:12px;color:#344054}.pv-team-check input{margin:0;width:15px;height:15px;accent-color:#2f65c8}.pv-org-note{grid-column:1/-1;font-size:11.5px;color:#667085;line-height:1.55;margin-top:8px}.pv-hidden-field{display:none!important}
    `;d.head.appendChild(st);
  }

  function teamOptions(select){
    return [...select.options].map(o=>String(o.value||o.textContent||'').trim()).filter(v=>v&&v!=='—');
  }
  function ensureDashOption(select){
    if(![...select.options].some(o=>o.value==='—')){
      const o=select.ownerDocument.createElement('option');o.value='—';o.textContent='—';select.appendChild(o);
    }
  }
  function ensureManagedBlock(d,form,teamSelect){
    let box=d.getElementById('pvManagedTeams');
    if(!box){
      box=d.createElement('div');box.id='pvManagedTeams';box.className='pv-managed-teams';
      const teamLabel=teamSelect.closest('label');
      if(teamLabel?.nextSibling)teamLabel.parentNode.insertBefore(box,teamLabel.nextSibling);else form.querySelector('.form-grid')?.appendChild(box);
    }
    const values=teamOptions(teamSelect);
    const signature=values.join('|');
    if(box.dataset.signature!==signature){
      const previous=new Set([...box.querySelectorAll('input:checked')].map(x=>x.value));
      box.innerHTML=`<span>管理销售组 *</span><div class="pv-team-checks">${values.map(v=>`<label class="pv-team-check"><input type="checkbox" name="managedTeam" value="${esc(v)}" ${previous.has(v)?'checked':''}><b>${esc(v)}</b></label>`).join('')}</div><div class="pv-org-note">主管可以同时管理多个销售组；这里决定主管可见和可管理的数据范围。</div>`;
      box.dataset.signature=signature;
    }
    return box;
  }

  function patchHelp(d,role){
    const help=d.getElementById('roleHelpCard');if(!help)return;
    if(role==='超级管理员')help.innerHTML='<strong>超级管理员</strong><p>不属于任何销售小组，固定查看全部数据并拥有全部功能权限。</p>';
    else if(role==='一级管理员')help.innerHTML='<strong>主管</strong><p>不归属单一销售组，而是管理一个或多个销售组。请在下方勾选负责的销售组。</p>';
    else if(role==='二级管理员 / 组长')help.innerHTML='<strong>组长</strong><p>必须归属一个销售组，可查看和协助管理本组数据。</p>';
    else help.innerHTML='<strong>销售</strong><p>必须归属一个销售组，只处理本人负责的客户和业务数据。</p>';
  }

  function patchForm(d){
    const form=d.getElementById('accountForm'),role=d.getElementById('accountPermissionSelect'),team=d.getElementById('accountTeamSelect');
    if(!form||!role||!team)return;
    patchStyles(d);ensureDashOption(team);
    const teamLabel=team.closest('label');const teamTitle=teamLabel?.querySelector('span');
    const managed=ensureManagedBlock(d,form,team);
    const value=role.value;

    if(value==='超级管理员'){
      team.value='—';team.required=false;if(teamLabel)teamLabel.classList.add('pv-hidden-field');managed.classList.add('pv-hidden-field');
    }else if(value==='一级管理员'){
      team.value='—';team.required=false;if(teamLabel)teamLabel.classList.add('pv-hidden-field');managed.classList.remove('pv-hidden-field');
    }else{
      if(teamLabel)teamLabel.classList.remove('pv-hidden-field');managed.classList.add('pv-hidden-field');team.required=true;
      if(teamTitle)teamTitle.textContent='所属销售小组 *';
      if(team.value==='—'||!team.value){const first=teamOptions(team)[0];if(first)team.value=first;}
    }
    patchHelp(d,value);

    if(!role.dataset.orgModelBound){
      role.dataset.orgModelBound='1';
      role.addEventListener('change',()=>setTimeout(()=>patchForm(d),0));
    }
  }

  function patchAccountsHelp(d){
    const content=d.getElementById('settingsContent');if(!content)return;
    const active=d.querySelector('[data-settings-tab="accounts"].active');if(!active)return;
    const aside=content.querySelector('.settings-grid > aside.panel');
    if(aside)aside.innerHTML='<div class="settings-toolbar"><div><h2>账号组织逻辑</h2><p>角色、组织归属和数据范围分开处理。</p></div></div><div class="system-note"><b>销售</b>：归属 1 个销售组，只处理本人客户。<br><br><b>组长</b>：归属 1 个销售组，管理本组。<br><br><b>主管</b>：不归属单一组，可管理 1 个或多个销售组。<br><br><b>超级管理员</b>：不归属任何销售组，固定全部数据 + 全部权限。</div>';
  }

  async function submitAccount(d,form){
    const fd=new frame.contentWindow.FormData(form),x=Object.fromEntries(fd);
    const role=String(x.permissionGroup||'');
    const managed=[...form.querySelectorAll('input[name="managedTeam"]:checked')].map(i=>i.value);
    let team=String(x.team||'').trim();
    if(role==='超级管理员')team='—';
    if(role==='一级管理员'){
      team='—';
      if(!managed.length){alert('主管至少需要选择 1 个管理销售组。');return;}
    }
    if((role==='普通销售'||role==='二级管理员 / 组长')&&(!team||team==='—')){alert('销售和组长必须选择所属销售小组。');return;}
    if(role==='超级管理员'&&currentUser?.permissionGroup!=='超级管理员'){alert('只有超级管理员可以创建新的超级管理员。');return;}
    const payload={
      username:x.login,
      displayName:x.displayName,
      permissionGroup:role,
      team,
      managedTeams:role==='一级管理员'?managed:[],
      password:x.password,
      status:x.status,
      mustChangePassword:false
    };
    const res=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});
    if(!res.r.ok||!res.d.ok){
      const map={managed_teams_required:'主管至少需要选择 1 个管理销售组',team_required:'销售或组长必须选择所属销售小组',username_exists:'登录账号已存在',password_too_short:'密码至少 4 位',super_admin_required:'只有超级管理员可以创建超级管理员'};
      alert('创建账号失败：'+(map[res.d.error]||res.d.message||res.d.error||res.r.status));return;
    }
    location.reload();
  }

  function install(d){
    if(!d?.documentElement)return;
    patchStyles(d);patchForm(d);patchAccountsHelp(d);
    if(d.documentElement.dataset.orgModelInstalled!=='1'){
      d.documentElement.dataset.orgModelInstalled='1';
      d.addEventListener('click',e=>{
        if(e.target.closest('#addAccountBtn')||e.target.closest('[data-settings-tab="accounts"]'))setTimeout(()=>{patchForm(d);patchAccountsHelp(d);},40);
      },true);
      d.addEventListener('submit',e=>{
        const form=e.target;if(form?.id!=='accountForm')return;
        e.preventDefault();e.stopImmediatePropagation();
        submitAccount(d,form).catch(err=>alert('创建账号失败：'+(err?.message||err)));
      },true);
    }
  }
  function attach(){try{install(frame.contentDocument);}catch(_){}}
  loadMe().finally(()=>{});
  frame.addEventListener('load',()=>{setTimeout(attach,80);setTimeout(attach,500);});
  setInterval(attach,900);
})();
