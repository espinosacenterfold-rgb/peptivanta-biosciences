(() => {
  'use strict';

  const KEY='peptivanta-crm-v2';
  const choice=localStorage.getItem('pv-cloud-migration-choice');
  const done=localStorage.getItem('pv-undo-import-done-v1');

  function loadShell(){
    const s=document.createElement('script');
    s.src='./cloud-shell-v2.js';
    document.body.appendChild(s);
  }

  if(choice!=='import'||done==='1'){
    loadShell();
    return;
  }

  const text=document.getElementById('bootText');
  const detail=document.getElementById('bootDetail');
  const retry=document.getElementById('retryBtn');
  const spin=document.querySelector('.spin');
  if(text)text.textContent='正在清空误导入的数据…';
  if(detail)detail.textContent='保留管理员账号和权限，仅清空客户、跟进、订单和旧示例数据';

  fetch('/api/admin/reset-import',{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({confirm:'UNDO_IMPORTED_CRM_DATA'})
  }).then(async r=>{
    let d={};try{d=await r.json()}catch{}
    if(!r.ok||!d.ok)throw new Error(d.message||d.error||`HTTP ${r.status}`);
    localStorage.removeItem(KEY);
    localStorage.setItem('pv-cloud-migration-choice','empty');
    localStorage.setItem('pv-undo-import-done-v1','1');
    location.reload();
  }).catch(e=>{
    if(text)text.textContent='清空数据失败';
    if(detail)detail.textContent=e?.message||String(e);
    if(spin)spin.style.display='none';
    if(retry){retry.hidden=false;retry.onclick=()=>location.reload();}
  });
})();
