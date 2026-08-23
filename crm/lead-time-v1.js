(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';

  function localDateTimeValue(d=new Date()){
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function ensureStyles(d){
    if(d.getElementById('pvLeadTimeStyles'))return;
    const st=d.createElement('style');st.id='pvLeadTimeStyles';st.textContent=`
      .pv-field-note{display:block;margin-top:4px;color:#667085;font-size:11px;line-height:1.45}
      .pv-lead-time-hint{grid-column:1/-1;margin-top:-3px;border-left:3px solid #315fbd;background:#f7f9fc;padding:8px 10px;color:#475467;font-size:11.5px;line-height:1.55;border-radius:0 5px 5px 0}
    `;d.head.appendChild(st);
  }

  function ensureField(d){
    const form=d.getElementById('customerForm');if(!form)return;
    ensureStyles(d);
    let input=form.elements.namedItem('leadAt');
    if(!input){
      const source=form.elements.namedItem('source');
      const sourceLabel=source?.closest('label');
      const label=d.createElement('label');
      label.id='pvLeadAtField';
      label.innerHTML='<span>进粉时间 *</span><input name="leadAt" type="datetime-local" required><small class="pv-field-note">客户实际进入 WhatsApp / 广告线索的时间。补录旧客户时请改成真实时间。</small>';
      if(sourceLabel?.nextSibling)sourceLabel.parentNode.insertBefore(label,sourceLabel.nextSibling);else form.querySelector('.form-grid')?.appendChild(label);
      input=label.querySelector('input');

      const hint=d.createElement('div');hint.id='pvLeadTimeHint';hint.className='pv-lead-time-hint';
      hint.textContent='进粉时间用于客户池时效判断；建档时间由系统自动记录。补录历史客户不会再被误算成今天的新粉。';
      label.parentNode.insertBefore(hint,label.nextSibling);
    }
    if(input&&!input.value)input.value=localDateTimeValue();
  }

  function patchSavedCustomer(meta){
    try{
      const state=JSON.parse(localStorage.getItem(KEY)||'{}');
      const list=Array.isArray(state.customers)?state.customers:[];
      if(!list.length)return false;
      const customer=list.find(c=>String(c.name||'')===meta.name&&String(c.contact||'—')===meta.contact)||list[0];
      if(!customer)return false;
      const leadAt=meta.leadAt;
      const leadDate=leadAt.slice(0,10);
      customer.leadAt=leadAt;
      customer.leadDate=leadDate;
      customer.recordCreatedAt=customer.recordCreatedAt||new Date().toISOString();

      // A freshly registered lead with no completed sales follow-up should age from the real intake time.
      if(!Array.isArray(customer.timeline)||customer.timeline.length===0){
        customer.lastContact=leadDate;
        customer.nextFollowUp=leadDate;
      }else if(customer.timeline.length===1&&customer.timeline[0]?.type==='首次咨询'&&customer.timeline[0]?.feedback==='待业务员首次回复'){
        customer.timeline[0].date=leadDate;
        customer.timeline[0].nextDate=leadDate;
        customer.lastContact=leadDate;
        customer.nextFollowUp=leadDate;
      }
      localStorage.setItem(KEY,JSON.stringify(state));
      return true;
    }catch(_){return false;}
  }

  function install(d){
    if(!d?.documentElement)return;
    ensureField(d);
    if(d.documentElement.dataset.leadTimeInstalled==='1')return;
    d.documentElement.dataset.leadTimeInstalled='1';

    d.addEventListener('click',e=>{
      if(e.target.closest('#addCustomerBtn')||e.target.closest('[data-create-mode]'))setTimeout(()=>ensureField(d),30);
    },true);

    d.addEventListener('submit',e=>{
      const form=e.target;if(form?.id!=='customerForm')return;
      const fd=new frame.contentWindow.FormData(form);
      const leadAt=String(fd.get('leadAt')||'').trim();
      if(!leadAt)return;
      const meta={
        leadAt,
        name:String(fd.get('name')||''),
        contact:String(fd.get('contact')||'—')||'—'
      };
      // Let the existing CRM create the customer first, then attach the real intake timestamp.
      setTimeout(()=>{
        if(patchSavedCustomer(meta)){
          try{frame.contentWindow.location.reload();}catch(_){location.reload();}
        }
      },80);
    },true);
  }

  function attach(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,100);setTimeout(attach,500);});
  setInterval(attach,1400);
})();
