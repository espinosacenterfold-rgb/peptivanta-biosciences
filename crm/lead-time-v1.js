(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  let leadFilter='all';

  function localDateTimeValue(d=new Date()){
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function localDateValue(d=new Date()){
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }
  function addDays(dateStr,days){
    const d=new Date(`${dateStr}T12:00:00`);d.setDate(d.getDate()+days);return localDateValue(d);
  }
  function parseState(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return{};}
  }

  function ensureStyles(d){
    if(d.getElementById('pvLeadTimeStyles'))return;
    const st=d.createElement('style');st.id='pvLeadTimeStyles';st.textContent=`
      .pv-field-note{display:block;margin-top:4px;color:#667085;font-size:11px;line-height:1.45}
      .pv-lead-time-hint{grid-column:1/-1;margin-top:-3px;border-left:3px solid #315fbd;background:#f7f9fc;padding:8px 10px;color:#475467;font-size:11.5px;line-height:1.55;border-radius:0 5px 5px 0}
      .pv-lead-badge{font-size:10.5px;color:#667085;background:#f6f8fb;border:1px solid #e1e6ed;border-radius:4px;padding:2px 5px;margin-left:6px;white-space:nowrap}
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
      hint.textContent='进粉时间用于客户池归类；建档时间由系统自动记录。补录历史客户不会被误算成今天的新粉。';
      label.parentNode.insertBefore(hint,label.nextSibling);
    }
    if(input&&!input.value)input.value=localDateTimeValue();
  }

  function ensureLeadFilter(d){
    const filters=d.querySelector('#view-dashboard .filter-selects');
    if(!filters||d.getElementById('pvLeadTimeFilter'))return;
    const label=d.createElement('label');
    label.id='pvLeadTimeFilterWrap';
    label.innerHTML='<span>进粉时间</span><select id="pvLeadTimeFilter"><option value="all">全部进粉</option><option value="today">今天进粉</option><option value="yesterday">昨天进粉</option><option value="3d">近3天</option><option value="7d">近7天</option><option value="month">本月</option></select>';
    const first=filters.querySelector('label');
    if(first?.nextSibling)filters.insertBefore(label,first.nextSibling);else filters.appendChild(label);
    const select=label.querySelector('select');
    select.value=leadFilter;
    select.addEventListener('change',()=>{leadFilter=select.value;applyLeadFilter(d,true);});
  }

  function customerLeadDate(c){
    return String(c?.leadDate||c?.leadAt||c?.createdAt||'').slice(0,10);
  }
  function leadMatches(c,mode){
    if(mode==='all')return true;
    const date=customerLeadDate(c);if(!date)return false;
    const today=localDateValue();
    if(mode==='today')return date===today;
    if(mode==='yesterday')return date===addDays(today,-1);
    if(mode==='3d')return date>=addDays(today,-2)&&date<=today;
    if(mode==='7d')return date>=addDays(today,-6)&&date<=today;
    if(mode==='month')return date.slice(0,7)===today.slice(0,7);
    return true;
  }

  function formatLead(c){
    const raw=String(c?.leadAt||'');
    if(raw.length>=16)return `${raw.slice(5,10).replace('-','/')} ${raw.slice(11,16)}`;
    const date=customerLeadDate(c);return date?date.slice(5).replace('-','/'):'未记录';
  }

  function applyLeadFilter(d,selectFirst=false){
    const state=parseState();
    const list=Array.isArray(state.customers)?state.customers:[];
    const byId=new Map(list.map(c=>[String(c.id),c]));
    const allowed=new Set(list.filter(c=>leadMatches(c,leadFilter)).map(c=>String(c.id)));

    let visiblePool=0,firstVisible=null;
    d.querySelectorAll('#customerPool [data-detail-customer]').forEach(card=>{
      const id=String(card.dataset.detailCustomer||'');
      const show=leadFilter==='all'||allowed.has(id);
      card.style.setProperty('display',show?'':'none','important');
      if(show){visiblePool++;if(!firstVisible)firstVisible=card;}
      const c=byId.get(id);
      if(c){
        const top=card.querySelector('.pool-person small');
        if(top&&!top.querySelector('.pv-lead-badge')){
          const badge=d.createElement('span');badge.className='pv-lead-badge';badge.textContent='进粉 '+formatLead(c);top.appendChild(badge);
        }
      }
    });
    if(leadFilter!=='all'){
      const count=d.getElementById('poolCount');if(count)count.textContent=`${visiblePool} 位客户`;
      if(selectFirst&&firstVisible)firstVisible.click();
    }

    let visibleRows=0;
    d.querySelectorAll('#customersBody [data-detail-row]').forEach(row=>{
      const id=String(row.dataset.detailRow||'');
      const show=leadFilter==='all'||allowed.has(id);
      row.style.setProperty('display',show?'':'none','important');if(show)visibleRows++;
    });
    if(leadFilter!=='all'){
      const rc=d.getElementById('customerResultCount');if(rc)rc.textContent=`${visibleRows} 位客户`;
    }
  }

  function patchSavedCustomer(meta){
    try{
      const state=parseState();
      const list=Array.isArray(state.customers)?state.customers:[];
      if(!list.length)return false;
      const customer=list.find(c=>String(c.name||'')===meta.name&&String(c.contact||'—')===meta.contact)||list[0];
      if(!customer)return false;
      const leadAt=meta.leadAt;
      const leadDate=leadAt.slice(0,10);
      customer.leadAt=leadAt;
      customer.leadDate=leadDate;
      customer.recordCreatedAt=customer.recordCreatedAt||new Date().toISOString();
      // Legacy createdAt is kept aligned to the business intake date; recordCreatedAt is the immutable CRM entry timestamp.
      customer.createdAt=leadDate;

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
    ensureField(d);ensureLeadFilter(d);applyLeadFilter(d,false);
    if(d.documentElement.dataset.leadTimeInstalled==='1')return;
    d.documentElement.dataset.leadTimeInstalled='1';

    d.addEventListener('click',e=>{
      if(e.target.closest('#addCustomerBtn')||e.target.closest('[data-create-mode]'))setTimeout(()=>ensureField(d),30);
      if(e.target.closest('[data-view="dashboard"]')||e.target.closest('[data-view="customers"]'))setTimeout(()=>{ensureLeadFilter(d);applyLeadFilter(d,false);},80);
    },true);

    d.addEventListener('submit',e=>{
      const form=e.target;if(form?.id!=='customerForm')return;
      const fd=new frame.contentWindow.FormData(form);
      const leadAt=String(fd.get('leadAt')||'').trim();
      if(!leadAt)return;
      const meta={leadAt,name:String(fd.get('name')||''),contact:String(fd.get('contact')||'—')||'—'};
      setTimeout(()=>{
        if(patchSavedCustomer(meta)){
          try{frame.contentWindow.location.reload();}catch(_){location.reload();}
        }
      },80);
    },true);
  }

  function attach(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,100);setTimeout(attach,500);});
  setInterval(attach,1200);
})();
