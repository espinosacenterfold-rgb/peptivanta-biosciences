(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;

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

  function install(d){
    if(!d?.documentElement)return;
    patchStyles(d);patchForm(d);
    if(d.documentElement.dataset.orgModelInstalled!=='1'){
      d.documentElement.dataset.orgModelInstalled='1';
      d.addEventListener('click',e=>{
        if(e.target.closest('#addAccountBtn')||e.target.closest('[data-settings-tab="accounts"]'))setTimeout(()=>patchForm(d),40);
      },true);
    }
  }
  function attach(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,80);setTimeout(attach,500);});
  setInterval(attach,1200);
})();
