(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');if(!frame)return;
  let accounts=[];

  async function api(url){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});let d={};try{d=await r.json()}catch{}return{r,d};
  }
  async function refreshAccounts(){
    try{const x=await api('/api/users');if(x.r.ok&&x.d.ok)accounts=x.d.accounts||[];}catch(_){ }
  }
  function byLogin(login){return accounts.find(a=>String(a.login||'').trim()===String(login||'').trim());}

  function patchAccountTable(d){
    const active=d.querySelector('[data-settings-tab="accounts"].active');if(!active)return;
    const table=d.querySelector('#settingsContent .setting-table');if(!table)return;
    const heads=[...table.querySelectorAll('thead th')];
    let orgIndex=heads.findIndex(h=>/销售小组|所属组|组织范围/.test(h.textContent));
    if(orgIndex<0)orgIndex=3;
    if(heads[orgIndex])heads[orgIndex].textContent='组织范围';
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.querySelectorAll('td')];if(!cells.length||!cells[orgIndex])return;
      const login=cells[0].textContent.trim(),a=byLogin(login);if(!a)return;
      if(a.permissionGroup==='超级管理员')cells[orgIndex].textContent='全部 · 无销售组';
      else if(a.permissionGroup==='一级管理员')cells[orgIndex].textContent=(a.managedTeams||[]).join('、')||'未配置';
      else cells[orgIndex].textContent=a.team||'未配置';
    });
  }

  function patchPermissionScopes(d){
    const active=d.querySelector('[data-settings-tab="permissions"].active');if(!active)return;
    d.querySelectorAll('#settingsContent [data-permission-group]').forEach(card=>{
      const select=card.querySelector('[data-group-scope]');if(!select)return;
      select.disabled=true;select.title='数据范围由账号角色固定';
      const label=card.querySelector('.permission-scope span');if(label)label.textContent='数据范围（按角色固定）';
    });
    const note=d.querySelector('#settingsContent .permission-note');
    if(note)note.textContent='数据范围由账号角色固定：销售=本人、组长=本组、主管=所管理销售组、超级管理员=全部。这里仅配置各权限组可以使用哪些功能。';
  }

  function patch(d){patchAccountTable(d);patchPermissionScopes(d);}
  function attach(){try{patch(frame.contentDocument);}catch(_){}}
  refreshAccounts();
  frame.addEventListener('load',()=>{refreshAccounts().then(()=>{setTimeout(attach,100);setTimeout(attach,600);});});
  setInterval(()=>{refreshAccounts().then(attach);},1800);
})();
