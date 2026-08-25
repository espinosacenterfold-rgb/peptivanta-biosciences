(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const STAGES={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  let queued=false,pendingSubmit=null;

  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const addDays=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(days||0));return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const fmt=v=>{if(!v)return'无需自动跟进';try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(String(v).slice(0,10)+'T12:00:00'))}catch{return String(v)}};
  const norm=v=>String(v||'').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function latest(c){return Array.isArray(c?.timeline)&&c.timeline.length?c.timeline[0]:{};}
  function effectiveStage(c,last){
    const r=String(last?.result||'');
    if(r==='待付款')return'payment';
    if(r==='已成交')return'fulfillment';
    return c.stage||'new';
  }
  function fingerprint(c){
    const l=latest(c);
    return JSON.stringify([
      c.grade||'',c.stage||'',c.customerType||'',c.currentObjection||'',c.demandDetail||'',c.purchasePurpose||'',c.risk||'',
      ...(c.traits||[]),
      l.date||'',l.feedback||'',l.result||'',l.nextAction||'',l.content||'',l.updatedAt||'',Number(l.editCount||0)
    ]);
  }
  function gradeDays(grade,map){return Object.prototype.hasOwnProperty.call(map,grade)?map[grade]:map.B;}

  function analyze(c,override={}){
    const l={...latest(c),...(override.latest||{})};
    const grade=String(override.grade||c.grade||'B').toUpperCase();
    const stage=override.stage||effectiveStage(c,l);
    const objection=String(override.currentObjection??c.currentObjection??'');
    const demand=String(override.demandDetail??c.demandDetail??'');
    const customerType=String(c.customerType||'');
    const traits=[...(c.traits||[])];
    const result=String(l.result||'');
    const text=norm([l.feedback,l.nextAction,l.content,objection,demand,c.purchasePurpose,traits.join(' '),customerType].join(' | '));

    if(grade==='D'||result==='无效'||String(c.risk||'')==='黑名单'){
      return{date:null,days:null,priority:'stop',reason:grade==='D'?'D级客户 · 停止自动提醒':'无效/黑名单 · 停止自动提醒'};
    }

    if(/\b(today|asap|urgent)\b|今天|马上|尽快|急单|急需/.test(text))return{date:addDays(0),days:0,priority:'urgent',reason:`${grade}级 · 明确急需/当天处理`};
    if(/\b(tomorrow)\b|明天/.test(text))return{date:addDays(1),days:1,priority:'high',reason:`${grade}级 · 客户明确明天继续`};

    let days=3,signal='常规培育';
    if(stage==='payment'||/待付款|准备付款|安排付款|确认付款|付款信息|payment|pay today|send payment/.test(text)){
      days=0;signal='付款节点';
    }else if(stage==='fulfillment'){
      days=gradeDays(grade,{S:1,A:2,B:3,C:5,D:null});signal='订单/物流节点';
    }else if(stage==='repeat'){
      days=gradeDays(grade,{S:4,A:6,B:9,C:14,D:null});signal='复购维护';
    }else if(/等待内部确认|内部确认|需要考虑|再考虑|考虑一下|think about|check internally|internal confirmation/.test(text)){
      days=gradeDays(grade,{S:2,A:3,B:4,C:7,D:null});signal='等待客户内部确认';
    }else if(/未回复|已读未回|不回复|没有回复|no reply|no response|seen/.test(text)){
      days=gradeDays(grade,{S:1,A:2,B:3,C:5,D:null});signal='客户暂未回复';
    }else if(stage==='quoted'||stage==='negotiating'){
      days=gradeDays(grade,{S:0,A:1,B:2,C:4,D:null});signal=stage==='quoted'?'报价后推进':'议价中';
    }else if(stage==='qualifying'||stage==='catalog'){
      days=gradeDays(grade,{S:0,A:1,B:2,C:3,D:null});signal=stage==='qualifying'?'需求确认中':'资料已发送';
    }else if(stage==='new'||stage==='contacted'){
      days=gradeDays(grade,{S:0,A:1,B:1,C:2,D:null});signal=stage==='new'?'新询盘':'首次回复后';
    }else{
      days=gradeDays(grade,{S:1,A:2,B:3,C:5,D:null});
    }

    if(days===null)return{date:null,days:null,priority:'stop',reason:`${grade}级 · 停止自动提醒`};

    const strongNeed=Boolean(demand.trim()&&!/待确认|未补充|不知道/.test(demand));
    const hardObjection=Boolean(objection&&!/未确认|无明显阻力|待确认/.test(objection));
    const highValueSignal=traits.some(x=>/急单|批量采购|长期采购|机构采购|样品评估/.test(String(x)))||/机构采购|经销|品牌|oem/i.test(customerType);
    if(days>0&&(strongNeed||hardObjection))days-=1;
    if(days>0&&highValueSignal)days-=1;
    days=Math.max(0,days);

    const parts=[`${grade}级`,STAGES[stage]||stage,signal];
    if(strongNeed)parts.push('需求已较明确');
    if(hardObjection)parts.push(`阻力：${objection}`);
    return{date:addDays(days),days,priority:days===0?'urgent':days<=1?'high':days<=3?'normal':'low',reason:parts.join(' · ')};
  }

  function applyCustomer(c,force=false){
    if(!c)return false;
    const fp=fingerprint(c),old=c.smartFollowUp||{};
    if(!force&&old.fingerprint===fp)return false;
    const a=analyze(c),l=latest(c);
    c.nextFollowUp=a.date;
    if(l&&Object.keys(l).length)l.nextDate=a.date||'';
    c.smartFollowUp={mode:'auto',fingerprint:fp,date:a.date,days:a.days,priority:a.priority,reason:a.reason,generatedAt:new Date().toISOString()};
    return true;
  }

  function applyAll(forceInitial=false){
    const state=read();let changed=false;
    (state.customers||[]).forEach(c=>{
      if(!c.smartFollowUp&&forceInitial){if(applyCustomer(c,true))changed=true;}
      else if(applyCustomer(c,false))changed=true;
    });
    if(changed)write(state);
    return changed;
  }

  function customerById(id){return (read().customers||[]).find(c=>String(c.id)===String(id));}
  function selectedCustomerId(d){
    return d.getElementById('followCustomerSelect')?.value||d.getElementById('v9QuickFollowForm')?.elements?.namedItem('customerId')?.value||d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#detailModalBody')?.dataset.pvDetailId||'';
  }

  function styles(d){
    if(d.getElementById('pvSmartFollowStyles'))return;
    const s=d.createElement('style');s.id='pvSmartFollowStyles';s.textContent=`
      .pv-smart-follow-hint{margin-top:6px;padding:7px 9px;border:1px solid #cddaf0;border-radius:6px;background:#f4f7fd;color:#3f536f;font-size:10.5px;line-height:1.45}.pv-smart-follow-hint b{color:#2459ad}.pv-smart-follow-hint.stop{border-color:#e4e7ec;background:#f8f9fb;color:#667085}.pv-smart-follow-hint .pv-smart-recalc{margin-left:7px;border:0;background:transparent;color:#315fbd;font-size:10.5px;font-weight:700;cursor:pointer;padding:0}
      .pv-smart-workbench{display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:2px 8px;border-radius:12px;background:#eef4ff;border:1px solid #c7d8f5;color:#315fbd;font-size:10.5px;font-weight:650}.pv-smart-workbench.stop{background:#f5f6f8;border-color:#e1e5ea;color:#667085}
      .pv-smart-date-label{display:block;margin-top:4px;color:#667085;font-size:10px;line-height:1.35}
    `;d.head.appendChild(s);
  }

  function formVirtualCustomer(form,c){
    if(!c)return null;
    const feedback=form.elements?.namedItem('feedback')?.value||latest(c).feedback||'';
    const nextAction=form.elements?.namedItem('nextAction')?.value||latest(c).nextAction||'';
    const content=form.elements?.namedItem('content')?.value||latest(c).content||'';
    const result=form.elements?.namedItem('result')?.value||latest(c).result||'';
    let stage=c.stage;
    if(result==='待付款')stage='payment';else if(result==='已成交')stage='fulfillment';
    return{...c,stage,timeline:[{...latest(c),feedback,nextAction,content,result},...(c.timeline||[]).slice(1)]};
  }

  function enhanceFollowForm(d,form){
    if(!form)return;
    const date=form.elements?.namedItem('nextDate');if(!date)return;
    const id=form.elements?.namedItem('customerId')?.value||selectedCustomerId(d),c=customerById(id);if(!c)return;
    const virtual=formVirtualCustomer(form,c),a=analyze(virtual);
    const label=date.closest('label');if(!label)return;
    let hint=label.querySelector('.pv-smart-follow-hint');if(!hint){hint=d.createElement('div');hint.className='pv-smart-follow-hint';label.appendChild(hint);}
    hint.classList.toggle('stop',!a.date);
    hint.innerHTML=a.date?`智能建议：<b>${esc(fmt(a.date))}</b> · ${esc(a.reason)} <button type="button" class="pv-smart-recalc">采用建议</button>`:`智能建议：<b>无需自动跟进</b> · ${esc(a.reason)}`;
    hint.querySelector('.pv-smart-recalc')?.addEventListener('click',()=>{date.value=a.date||'';date.dataset.pvSmartManual='0';date.dispatchEvent(new Event('change',{bubbles:true}));});
    if(date.dataset.pvSmartManual!=='1'&&date.value!==a.date){date.value=a.date||'';date.dataset.pvSmartAuto=a.date||'';}
  }

  function enhanceQuickUpdate(d){
    const stage=d.getElementById('detailStageSelect'),grade=d.getElementById('detailGradeSelect'),date=d.getElementById('detailNextDate');if(!stage||!grade||!date)return;
    const id=d.querySelector('[data-save-detail-status]')?.dataset.saveDetailStatus||d.getElementById('detailModalBody')?.dataset.pvDetailId,c=customerById(id);if(!c)return;
    const virtual={...c,stage:stage.value||c.stage,grade:grade.value||c.grade};const a=analyze(virtual);
    const label=date.closest('label');if(label){let hint=label.querySelector('.pv-smart-follow-hint');if(!hint){hint=d.createElement('div');hint.className='pv-smart-follow-hint';label.appendChild(hint);}hint.classList.toggle('stop',!a.date);hint.innerHTML=a.date?`按当前等级/阶段：<b>${esc(fmt(a.date))}</b> · ${esc(a.reason)}`:`<b>无需自动跟进</b> · ${esc(a.reason)}`;}
    if(date.dataset.pvSmartManual!=='1')date.value=a.date||'';
  }

  function decorateCustomer(d){
    const id=d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#customerPool .pool-card.active')?.dataset.detailCustomer;if(!id)return;const c=customerById(id);if(!c)return;const a=c.smartFollowUp||analyze(c);
    const meta=d.querySelector('#customerWorkspace .pv4-meta-row')||d.querySelector('#customerWorkspace .pv2-summary-sub');if(meta&&!meta.querySelector('.pv-smart-workbench')){
      const chip=d.createElement('span');chip.className='pv-smart-workbench'+(!a.date?' stop':'');chip.textContent=a.date?`智能跟进 ${fmt(a.date)} · ${a.reason}`:`无需自动跟进 · ${a.reason}`;meta.appendChild(chip);
    }
  }

  function markManual(d,e){
    const t=e.target;if(!(t instanceof frame.contentWindow.HTMLInputElement))return;
    if(t.name==='nextDate'||t.id==='detailNextDate')t.dataset.pvSmartManual='1';
  }

  function captureSubmit(d,e){
    const form=e.target;if(!(form instanceof frame.contentWindow.HTMLFormElement))return;
    if(!(form.id==='followForm'||form.id==='v9QuickFollowForm'))return;
    const cid=form.elements?.namedItem('customerId')?.value||selectedCustomerId(d),date=form.elements?.namedItem('nextDate');
    pendingSubmit={customerId:cid,manual:date?.dataset.pvSmartManual==='1',manualDate:date?.value||''};
    setTimeout(()=>finalizeFollowSubmit(),120);
  }

  function finalizeFollowSubmit(){
    if(!pendingSubmit)return;const p=pendingSubmit;pendingSubmit=null;const state=read(),c=(state.customers||[]).find(x=>String(x.id)===String(p.customerId));if(!c)return;
    const fp=fingerprint(c),l=latest(c);
    if(p.manual&&p.manualDate){c.nextFollowUp=p.manualDate;if(l)l.nextDate=p.manualDate;c.smartFollowUp={mode:'manual',fingerprint:fp,date:p.manualDate,days:null,priority:'manual',reason:'业务员手动指定本轮跟进时间',generatedAt:new Date().toISOString()};}
    else applyCustomer(c,true);
    write(state);
  }

  function captureQuickSave(d,e){
    const btn=e.target.closest('[data-save-detail-status]');if(!btn)return;
    const id=btn.dataset.saveDetailStatus,date=d.getElementById('detailNextDate');
    const manual=date?.dataset.pvSmartManual==='1',manualDate=date?.value||'';
    setTimeout(()=>{const state=read(),c=(state.customers||[]).find(x=>String(x.id)===String(id));if(!c)return;if(manual&&manualDate){const fp=fingerprint(c),l=latest(c);c.nextFollowUp=manualDate;if(l)l.nextDate=manualDate;c.smartFollowUp={mode:'manual',fingerprint:fp,date:manualDate,days:null,priority:'manual',reason:'业务员手动指定本轮跟进时间',generatedAt:new Date().toISOString()};}else applyCustomer(c,true);write(state);},120);
  }

  function bind(d){
    if(d.documentElement.dataset.pvSmartBound)return;d.documentElement.dataset.pvSmartBound='1';
    d.addEventListener('change',e=>{markManual(d,e);if(e.target.matches('#followCustomerSelect,[name="feedback"],[name="result"],[name="nextAction"],#detailStageSelect,#detailGradeSelect'))setTimeout(()=>decorate(d),20);},true);
    d.addEventListener('input',e=>{if(e.target.matches('[name="feedback"],[name="nextAction"]'))setTimeout(()=>decorate(d),80);},true);
    d.addEventListener('click',e=>{if(e.target.closest('.pv-follow-date-shortcuts button')){const form=e.target.closest('form');const date=form?.elements?.namedItem('nextDate');if(date)date.dataset.pvSmartManual='1';}captureQuickSave(d,e);if(e.target.closest('[data-follow-customer],[data-v9-quick-follow],[data-open-detail],[data-select-customer]'))setTimeout(()=>decorate(d),60);},true);
    d.addEventListener('submit',e=>captureSubmit(d,e),true);
    new MutationObserver(()=>schedule(d)).observe(d.body,{childList:true,subtree:true});
  }

  function decorate(d){
    if(!d)return;styles(d);applyAll(false);enhanceFollowForm(d,d.getElementById('followForm'));enhanceFollowForm(d,d.getElementById('v9QuickFollowForm'));enhanceQuickUpdate(d);decorateCustomer(d);
  }
  function schedule(d){if(queued)return;queued=true;setTimeout(()=>{queued=false;try{decorate(d);}catch(_){}},45);}
  function attach(){const d=frame.contentDocument;if(!d)return;applyAll(true);bind(d);decorate(d);}

  frame.addEventListener('load',()=>{setTimeout(attach,180);setTimeout(attach,850);});
  setInterval(()=>{try{const d=frame.contentDocument;if(d){const changed=applyAll(false);if(changed)setTimeout(()=>decorate(d),30);}}catch(_){}},1200);
})();
