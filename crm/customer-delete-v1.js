(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  let me=null,queued=false;

  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const canDelete=()=>me?.permissionGroup==='超级管理员'||Boolean(me?.permissions?.includes('客户删除'));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function loadMe(){
    try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(r.ok&&d.ok)me=d.user;}catch(_){}
  }
  function selectedId(d){
    return d.getElementById('detailModalBody')?.dataset.pvDetailId||d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#customerPool .pool-card.active')?.dataset.detailCustomer||'';
  }
  function styles(d){
    if(d.getElementById('pvCustomerDeleteStyles'))return;
    const s=d.createElement('style');s.id='pvCustomerDeleteStyles';s.textContent=`
      .pv-delete-customer{border:1px solid #efb2ad!important;background:#fff7f6!important;color:#b42318!important;font-weight:700!important}.pv-delete-customer:hover{background:#fff0ee!important;border-color:#e7877d!important}.pv-delete-note{font-size:10px;color:#b42318}
    `;d.head.appendChild(s);
  }
  function hasOrder(state,c){
    return (state.orders||[]).some(o=>String(o.customerId||'')===String(c.id)||(!o.customerId&&String(o.customer||'')===String(c.name||'')));
  }
  function toast(d,text){const t=d.getElementById('toast');if(!t)return;t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
  function deleteCustomer(d,id){
    if(!canDelete())return;
    const state=read(),c=(state.customers||[]).find(x=>String(x.id)===String(id));if(!c)return;
    if(hasOrder(state,c)){alert(`客户“${c.name||id}”已有订单，不能直接删除。\n请保留客户记录，避免订单、物流和财务链路断开。`);return;}
    const extra=c.protected?'\n该客户当前还是保护客户。':'';
    if(!confirm(`确认删除客户“${c.name||id}”？\n\n客户登记信息和跟进历史会一起从 CRM 删除。${extra}\n此操作会记录管理员审计日志。`))return;
    state.customers=(state.customers||[]).filter(x=>String(x.id)!==String(id));
    write(state);toast(d,'客户已删除，正在同步数据库…');
    setTimeout(()=>{try{frame.contentWindow.location.reload();}catch{}},900);
  }
  function makeButton(d,id,compact=false){
    const b=d.createElement('button');b.type='button';b.className='button secondary small pv-delete-customer';b.dataset.pvDeleteCustomer=id;b.textContent=compact?'删除':'删除客户';return b;
  }
  function decorateDetail(d){
    const body=d.getElementById('detailModalBody');if(!body||!canDelete())return;
    const id=body.dataset.pvDetailId||selectedId(d);if(!id)return;
    const actions=body.querySelector('.pv3-id-actions');if(actions&&!actions.querySelector('[data-pv-delete-customer]'))actions.appendChild(makeButton(d,id,false));
  }
  function decorateWorkbench(d){
    if(!canDelete())return;
    const id=d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#customerPool .pool-card.active')?.dataset.detailCustomer;if(!id)return;
    const actions=d.querySelector('#customerWorkspace .pv2-head-actions');if(actions&&!actions.querySelector('[data-pv-delete-customer]'))actions.appendChild(makeButton(d,id,true));
  }
  function apply(){try{const d=frame.contentDocument;if(!d)return;styles(d);decorateDetail(d);decorateWorkbench(d);}catch(_){} }
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply();},45);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;apply();
    if(!d.documentElement.dataset.pvCustomerDeleteObs){d.documentElement.dataset.pvCustomerDeleteObs='1';new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});}
    if(!d.documentElement.dataset.pvCustomerDeleteClick){d.documentElement.dataset.pvCustomerDeleteClick='1';d.addEventListener('click',e=>{const b=e.target.closest('[data-pv-delete-customer]');if(!b)return;e.preventDefault();e.stopPropagation();deleteCustomer(d,b.dataset.pvDeleteCustomer);},true);}
  }
  frame.addEventListener('load',()=>{setTimeout(attach,160);setTimeout(attach,700);});
  loadMe().then(()=>{setTimeout(attach,120);setTimeout(attach,650);});
  setInterval(apply,1500);
})();
