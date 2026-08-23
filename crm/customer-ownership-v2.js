(() => {
  'use strict';
  const frame=document.getElementById('crmFrame'),KEY='peptivanta-crm-v2';if(!frame)return;
  let me=null;
  const readState=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  async function loadMe(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(r.ok&&d.ok)me=d.user;}catch(_){}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function activeAccounts(){return (readState().accounts||[]).filter(a=>a.status==='正常');}
  function eligibleAccounts(){
    const a=activeAccounts();if(!me)return a;
    if(me.permissionGroup==='普通销售')return a.filter(x=>x.login===me.username||x.displayName===me.displayName);
    if(me.permissionGroup==='二级管理员 / 组长')return a.filter(x=>x.team===me.team&&['普通销售','二级管理员 / 组长'].includes(x.permissionGroup));
    if(me.permissionGroup==='一级管理员')return a.filter(x=>(me.managedTeams||[]).includes(x.team)&&['普通销售','二级管理员 / 组长'].includes(x.permissionGroup));
    return a.filter(x=>x.permissionGroup!=='超级管理员');
  }
  function findAccount(name){return activeAccounts().find(a=>a.displayName===name);}
  function ensureStyles(d){if(d.getElementById('pvCustomerOwnershipStyles'))return;const st=d.createElement('style');st.id='pvCustomerOwnershipStyles';st.textContent=`.pv-derived-select{background:#f4f6f8!important;color:#475467}.pv-owner-note{display:block;margin-top:4px;color:#667085;font-size:11px;line-height:1.45}.pv-source-wa-note{display:block;margin-top:4px;color:#667085;font-size:11px}`;d.head.appendChild(st);}
  function ensureWaField(d,form){let sel=form.elements.namedItem('sourceWhatsapp');if(sel)return sel;const team=form.elements.namedItem('team'),teamLabel=team?.closest('label'),label=d.createElement('label');label.id='pvSourceWhatsappField';label.innerHTML='<span>来源 WhatsApp</span><select name="sourceWhatsapp"></select><small class="pv-source-wa-note">根据负责人绑定的 WhatsApp 自动提供选项。</small>';if(teamLabel?.nextSibling)teamLabel.parentNode.insertBefore(label,teamLabel.nextSibling);else form.querySelector('.form-grid')?.appendChild(label);return label.querySelector('select');}
  function setTeamAndWa(d,form){
    const owner=form.elements.namedItem('owner'),team=form.elements.namedItem('team'),wa=ensureWaField(d,form);if(!owner||!team||!wa)return;
    const acc=findAccount(owner.value);
    if(!acc){team.value='—';wa.innerHTML='<option>—</option>';return;}
    team.value=acc.team&&acc.team!=='—'?acc.team:'—';
    const ws=Array.isArray(acc.whatsappAccounts)?acc.whatsappAccounts:[];wa.innerHTML=ws.length?ws.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''):'<option value="—">—</option>';
  }
  function patchForm(d){
    const form=d.getElementById('customerForm'),owner=form?.elements.namedItem('owner'),team=form?.elements.namedItem('team');if(!form||!owner||!team)return;ensureStyles(d);
    const choices=eligibleAccounts(),allowUnowned=me&&['一级管理员','超级管理员'].includes(me.permissionGroup),current=owner.value;
    owner.innerHTML=choices.map(a=>`<option value="${esc(a.displayName)}">${esc(a.displayName)} · ${esc(a.team||'—')}</option>`).join('')+(allowUnowned?'<option value="未归属">未归属</option>':'');
    const preferred=(me?.permissionGroup==='普通销售'||me?.permissionGroup==='二级管理员 / 组长')&&choices.some(a=>a.displayName===me.displayName)?me.displayName:(choices.some(a=>a.displayName===current)?current:(choices[0]?.displayName||'未归属'));
    owner.value=preferred;
    team.classList.add('pv-derived-select');team.style.pointerEvents='none';team.title='所属销售组由负责人自动决定';
    let note=owner.closest('label')?.querySelector('.pv-owner-note');if(!note){note=d.createElement('small');note.className='pv-owner-note';owner.closest('label')?.appendChild(note);}
    if(note)note.textContent=me?.permissionGroup==='普通销售'?'客户默认且固定归属本人。':me?.permissionGroup==='二级管理员 / 组长'?'默认归组长本人；只有主动选择组员才会直接分配给组员。':'选择负责人后，销售组和可用 WhatsApp 自动跟随。';
    if(me?.permissionGroup==='普通销售'){owner.classList.add('pv-derived-select');owner.style.pointerEvents='none';owner.title='普通销售只能登记到本人名下';}else{owner.style.pointerEvents='';owner.classList.remove('pv-derived-select');}
    ensureWaField(d,form);setTeamAndWa(d,form);
    if(!owner.dataset.ownershipBound){owner.dataset.ownershipBound='1';owner.addEventListener('change',()=>setTeamAndWa(d,form));}
  }
  function patchSavedNewCustomer(meta,beforeIds){
    try{
      const state=readState(),list=Array.isArray(state.customers)?state.customers:[],c=list.find(x=>!beforeIds.has(x.id));if(!c)return false;
      const acc=findAccount(meta.owner);
      c.createdByUserId=Number(me?.id||0)||c.createdByUserId||null;c.createdBy=me?.displayName||c.createdBy||'';
      if(acc){c.owner=acc.displayName;c.ownerUserId=Number(acc.dbId||String(acc.id||'').replace('U-',''))||c.ownerUserId||null;c.team=acc.team||'—';c.whatsapp=meta.sourceWhatsapp||'—';}
      else{c.owner='未归属';c.ownerUserId=null;c.team='—';c.whatsapp='—';}
      localStorage.setItem(KEY,JSON.stringify(state));return true;
    }catch(_){return false;}
  }
  function install(d){
    if(!d)return;patchForm(d);if(d.documentElement.dataset.customerOwnershipV2==='1')return;d.documentElement.dataset.customerOwnershipV2='1';
    d.addEventListener('click',e=>{if(e.target.closest('#addCustomerBtn')||e.target.closest('[data-create-mode]'))setTimeout(()=>patchForm(d),30);},true);
    d.addEventListener('submit',e=>{
      const form=e.target;if(form?.id!=='customerForm')return;const state=readState(),beforeIds=new Set((state.customers||[]).map(c=>c.id)),fd=new frame.contentWindow.FormData(form),meta={owner:String(fd.get('owner')||''),sourceWhatsapp:String(fd.get('sourceWhatsapp')||'—')};
      setTimeout(()=>{if(patchSavedNewCustomer(meta,beforeIds)){try{frame.contentWindow.location.reload();}catch(_){}}},140);
    },true);
  }
  function attach(){try{install(frame.contentDocument);}catch(_){}}
  loadMe();frame.addEventListener('load',()=>{loadMe().then(()=>{setTimeout(attach,100);setTimeout(attach,500);});});setInterval(attach,1600);
})();
