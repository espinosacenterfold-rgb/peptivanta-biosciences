(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  let scheduled=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const dateValue=(days=0)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};

  function styles(d){
    if(d.getElementById('pvFollowCleanStyles'))return;
    const st=d.createElement('style');st.id='pvFollowCleanStyles';st.textContent=`
      .pv-follow-clean{--pvf-line:#e1e5eb;--pvf-muted:#667085;--pvf-blue:#315fbd}
      .pv-follow-clean .v9-follow-context{display:flex!important;align-items:center!important;gap:14px!important;padding:9px 11px!important;margin:0 0 9px!important;border:1px solid var(--pvf-line)!important;background:#fafbfc!important;border-radius:6px!important}
      .pv-follow-clean .v9-follow-context .main{min-width:180px;flex:1}.pv-follow-clean .v9-follow-context .main strong{font-size:13px!important}.pv-follow-clean .v9-follow-context .main small{font-size:10px!important}.pv-follow-clean .v9-follow-context .metric{display:flex;gap:5px;align-items:baseline;white-space:nowrap}.pv-follow-clean .v9-follow-context .metric span{font-size:9.5px!important;margin:0!important}.pv-follow-clean .v9-follow-context .metric b{font-size:10.5px!important}
      .pv-follow-clean .v9-outcome-bar{margin:0!important;padding:9px 11px!important;border:1px solid var(--pvf-line)!important;border-radius:6px!important;background:#fff!important;gap:5px!important}
      .pv-follow-clean .v9-outcome-bar>span{width:100%;font-size:10px!important;font-weight:700;color:#475467!important;margin:0 0 2px!important}
      .pv-follow-clean .v9-outcome-btn{height:29px!important;padding:0 10px!important;font-size:10.5px!important;border-radius:5px!important}
      .pv-follow-clean .v9-outcome-effect{display:none!important}
      .pv-follow-core{margin-top:9px;border:1px solid var(--pvf-line);border-radius:7px;background:#fff;overflow:hidden}
      .pv-follow-core-head{padding:9px 11px;border-bottom:1px solid #edf0f3;background:#fafbfc;display:flex;justify-content:space-between;align-items:center;gap:10px}.pv-follow-core-head strong{font-size:11.5px;color:#273142}.pv-follow-core-head span{font-size:9.8px;color:#8a94a3}
      .pv-follow-core-grid{padding:10px 11px;display:grid;grid-template-columns:1fr 1fr;gap:9px 10px}.pv-follow-core-grid>label{margin:0!important;display:block!important}.pv-follow-core-grid>label.pv-follow-wide{grid-column:1/-1}.pv-follow-core-grid label>span{display:block;font-size:10.5px!important;font-weight:700!important;color:#475467!important;margin-bottom:4px}.pv-follow-core-grid textarea,.pv-follow-core-grid input,.pv-follow-core-grid select{width:100%;box-sizing:border-box;font-size:12px!important}.pv-follow-core-grid textarea{min-height:68px!important;resize:vertical}.pv-follow-core-grid input,.pv-follow-core-grid select{height:35px!important}
      .pv-follow-shortcuts{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.pv-follow-shortcuts button{height:25px;padding:0 7px;border:1px solid #d7dce3;background:#fff;border-radius:4px;color:#475467;font-size:9.8px;cursor:pointer}.pv-follow-shortcuts button:hover{border-color:#a9bddf;background:#f6f8fc}.pv-follow-shortcuts button.active{border-color:#8cace0;background:#eef4ff;color:#2456a4;font-weight:700}
      .pv-follow-more{margin-top:8px;border:1px solid var(--pvf-line);border-radius:6px;background:#fafbfc;overflow:hidden}.pv-follow-more>summary{list-style:none;cursor:pointer;padding:8px 10px;font-size:10.5px;font-weight:700;color:#475467}.pv-follow-more>summary::-webkit-details-marker{display:none}.pv-follow-more>summary::after{content:'展开';float:right;color:#98a2b3;font-weight:400}.pv-follow-more[open]>summary::after{content:'收起'}.pv-follow-more-grid{padding:9px 10px;border-top:1px solid #edf0f3;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}.pv-follow-more-grid label{margin:0!important}.pv-follow-more-grid label>span{display:block;font-size:9.8px!important;color:#667085!important;margin-bottom:3px}.pv-follow-more-grid select,.pv-follow-more-grid input{width:100%;height:32px!important;font-size:10.5px!important}
      .pv-follow-hidden{display:none!important}
      .pv-follow-clean .modal-actions,.pv-follow-clean~.modal-actions{margin-top:9px!important;padding-top:10px!important}.pv-follow-clean .modal-actions .button{min-height:34px!important}
      #followModal .modal-content,#detailModalBody #v9DetailPanel{max-width:760px}
      #view-followups .panel-heading,#view-followup .panel-heading{padding:10px 12px!important}#view-followups .data-table th,#view-followup .data-table th{font-size:10px!important;padding:7px 8px!important}#view-followups .data-table td,#view-followup .data-table td{font-size:10.8px!important;padding:8px!important}
      @media(max-width:680px){.pv-follow-clean .v9-follow-context{display:grid!important;grid-template-columns:1fr 1fr!important}.pv-follow-clean .v9-follow-context .main{grid-column:1/-1}.pv-follow-core-grid,.pv-follow-more-grid{grid-template-columns:1fr}.pv-follow-core-grid>label.pv-follow-wide{grid-column:auto}}
    `;d.head.appendChild(st);
  }

  function label(form,name){return form.elements?.namedItem(name)?.closest('label')||null;}
  function title(labelEl,text){const s=labelEl?.querySelector(':scope > span');if(s)s.textContent=text;}
  function addTextShortcuts(d,labelEl,input,items){
    if(!labelEl||!input||labelEl.querySelector('.pv-follow-text-shortcuts'))return;
    const bar=d.createElement('div');bar.className='pv-follow-shortcuts pv-follow-text-shortcuts';
    items.forEach(text=>{const b=d.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{const old=String(input.value||'').trim();input.value=old?`${old}${old.endsWith('。')||old.endsWith(';')||old.endsWith('；')?'':'；'}${text}`:text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};bar.appendChild(b);});
    labelEl.appendChild(bar);
  }
  function addActionShortcuts(d,labelEl,input){
    if(!labelEl||!input||labelEl.querySelector('.pv-follow-action-shortcuts'))return;
    const items=['再次联系确认','确认需求/数量','发送报价/资料','确认付款','跟进物流','售后回访'];
    const bar=d.createElement('div');bar.className='pv-follow-shortcuts pv-follow-action-shortcuts';
    items.forEach(text=>{const b=d.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));};bar.appendChild(b);});labelEl.appendChild(bar);
  }
  function addDateShortcuts(d,labelEl,input){
    if(!labelEl||!input||labelEl.querySelector('.pv-follow-date-shortcuts'))return;
    const bar=d.createElement('div');bar.className='pv-follow-shortcuts pv-follow-date-shortcuts';
    [['今天',0],['明天',1],['2天后',2],['3天后',3],['7天后',7]].forEach(([text,days])=>{const b=d.createElement('button');b.type='button';b.textContent=text;b.dataset.days=String(days);b.onclick=()=>{input.value=dateValue(days);input.dispatchEvent(new Event('input',{bubbles:true}));syncDateButtons(bar,input);};bar.appendChild(b);});labelEl.appendChild(bar);input.addEventListener('change',()=>syncDateButtons(bar,input));syncDateButtons(bar,input);
  }
  function syncDateButtons(bar,input){bar.querySelectorAll('button[data-days]').forEach(b=>b.classList.toggle('active',input.value===dateValue(Number(b.dataset.days))));}

  function compactOutcome(form){
    const bar=form.querySelector('.v9-outcome-bar')||form.parentElement?.querySelector('.v9-outcome-bar');
    if(bar){const head=bar.querySelector(':scope > span');if(head)head.textContent='本次结果';bar.querySelectorAll('[data-v9-outcome]').forEach(b=>{if(b.textContent.trim()==='等待客户')b.textContent='等客户回复';});}
  }

  function build(form,d){
    if(!form||form.dataset.pvFollowClean==='1')return;
    const grid=form.querySelector('.form-grid,.v9-edit-grid');if(!grid)return;
    form.dataset.pvFollowClean='1';form.classList.add('pv-follow-clean');styles(d);compactOutcome(form);

    const customer=label(form,'customerId'),content=label(form,'content'),feedback=label(form,'feedback'),nextAction=label(form,'nextAction'),nextDate=label(form,'nextDate');
    const channel=label(form,'channel'),type=label(form,'type'),author=label(form,'author'),objection=label(form,'objection'),result=label(form,'result');
    if(result)result.classList.add('pv-follow-hidden');

    title(content,'我这次做了什么 *');title(feedback,'客户反馈 / 原话 *');title(nextAction,'下一步 *');title(nextDate,'下次跟进 *');
    const contentInput=form.elements.namedItem('content'),feedbackInput=form.elements.namedItem('feedback'),actionInput=form.elements.namedItem('nextAction'),dateInput=form.elements.namedItem('nextDate');
    if(contentInput)contentInput.placeholder='例如：发送报价和 COA；确认客户需要的规格和数量。';
    if(feedbackInput)feedbackInput.placeholder='例如：价格可以接受，需要再确认数量；或直接记录“未回复”。';
    if(actionInput)actionInput.placeholder='例如：明天确认数量；确认后发送付款信息。';

    const core=d.createElement('section');core.className='pv-follow-core';core.innerHTML='<div class="pv-follow-core-head"><strong>跟进记录</strong><span>只记关键事实，后面能看懂就够了</span></div><div class="pv-follow-core-grid"></div>';
    const coreGrid=core.querySelector('.pv-follow-core-grid');
    if(customer){customer.classList.add('pv-follow-wide');coreGrid.appendChild(customer);}
    [feedback,content,nextAction,nextDate].forEach((x,i)=>{if(!x)return;if(i<3)x.classList.add('pv-follow-wide');coreGrid.appendChild(x);});
    grid.parentNode.insertBefore(core,grid);

    addTextShortcuts(d,feedback,feedbackInput,['未回复','已读未回','需要考虑','等待内部确认']);
    addActionShortcuts(d,nextAction,actionInput);
    addDateShortcuts(d,nextDate,dateInput);

    const more=d.createElement('details');more.className='pv-follow-more';more.innerHTML='<summary>更多记录项（方式 / 类型 / 主要阻力）</summary><div class="pv-follow-more-grid"></div>';
    const moreGrid=more.querySelector('.pv-follow-more-grid');[channel,type,author,objection].forEach(x=>{if(x)moreGrid.appendChild(x);});
    if(moreGrid.children.length){core.insertAdjacentElement('afterend',more);}else more.remove();
    if(!grid.children.length)grid.style.display='none';
  }

  function decorateExisting(d){
    styles(d);
    const forms=[d.getElementById('followForm'),d.getElementById('v9QuickFollowForm')].filter(Boolean);
    forms.forEach(f=>build(f,d));
    const nav=[...d.querySelectorAll('[data-view]')].find(x=>x.textContent.includes('跟进日志'));
    if(nav?.dataset.view){const view=d.getElementById(`view-${nav.dataset.view}`);if(view)view.classList.add('pv-follow-log-clean');}
  }

  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;try{decorateExisting(frame.contentDocument);}catch(_){}},25);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;decorateExisting(d);
    if(!d.documentElement.dataset.pvFollowObserver){d.documentElement.dataset.pvFollowObserver='1';new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});}
    if(!d.documentElement.dataset.pvFollowClicks){d.documentElement.dataset.pvFollowClicks='1';d.addEventListener('click',e=>{if(e.target.closest('#quickFollowBtn')||e.target.closest('[data-follow-customer]')||e.target.closest('[data-v9-quick-follow]')||e.target.closest('[data-view]'))setTimeout(schedule,20);},true);}
  }
  frame.addEventListener('load',()=>{setTimeout(attach,100);setTimeout(attach,600);});
  setInterval(()=>{try{attach();}catch(_){}},1800);
})();
