(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const STAGES={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  let scheduled=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const customer=id=>(read().customers||[]).find(c=>String(c.id)===String(id));
  const fmt=v=>{if(!v)return'未安排';try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(String(v).slice(0,10)+'T12:00:00'))}catch{return String(v)}};
  const today=()=>new Date().toISOString().slice(0,10);
  const dueText=c=>{const d=String(c?.nextFollowUp||'').slice(0,10);if(!d)return'未安排';if(d<today())return`逾期 ${Math.max(1,Math.round((new Date(today()+'T12:00:00')-new Date(d+'T12:00:00'))/86400000))} 天`;if(d===today())return'今天';return fmt(d)};

  function styles(d){
    if(d.getElementById('pvWorkbenchCleanStyles'))return;
    const st=d.createElement('style');st.id='pvWorkbenchCleanStyles';st.textContent=`
      /* Workbench = execution surface, not a full customer dossier. */
      #view-dashboard{padding-top:10px!important}
      #view-dashboard .kpi-grid{gap:8px!important;margin-bottom:8px!important}
      #view-dashboard .kpi-card{min-height:54px!important;padding:8px 11px!important;display:grid!important;grid-template-columns:1fr auto!important;grid-template-rows:auto!important;align-items:center!important;gap:4px 10px!important}
      #view-dashboard .kpi-label{font-size:11px!important;color:#667085!important}
      #view-dashboard .kpi-value{font-size:20px!important;line-height:1!important;margin:0!important;grid-column:2!important;grid-row:1!important}
      #view-dashboard .kpi-foot{display:none!important}

      #view-dashboard .sequence-filter{padding:8px 11px!important;margin-bottom:8px!important}
      #view-dashboard .sequence-filter-title{min-height:28px!important;align-items:center!important}
      #view-dashboard .sequence-filter-title strong{font-size:12px!important}
      #view-dashboard .sequence-filter-title small{font-size:10px!important}
      #view-dashboard .sequence-filter.pv-filter-collapsed .filter-selects{display:none!important}
      #view-dashboard .sequence-filter.pv-filter-collapsed .sequence-filter-title small{display:none!important}
      #view-dashboard .sequence-filter.pv-filter-collapsed .active-filter-summary{margin-top:4px!important;min-height:0!important}
      #view-dashboard .filter-selects{margin-top:7px!important;gap:6px!important}
      #pvFilterToggle{height:27px;padding:0 9px;border:1px solid #d7dce3;background:#fff;border-radius:5px;color:#475467;font-size:10.5px;cursor:pointer;margin-left:auto}
      #pvFilterToggle:hover{background:#f7f9fc}

      #view-dashboard .workspace-layout{grid-template-columns:minmax(360px,430px) minmax(0,1fr)!important;gap:8px!important}
      #view-dashboard .customer-pool-panel,#view-dashboard .customer-workspace{height:calc(100vh - 205px)!important;min-height:520px!important}
      #view-dashboard .panel-heading{padding:10px 12px 8px!important}
      #view-dashboard .panel-heading h2{font-size:14px!important}
      #view-dashboard .panel-heading p{font-size:10.5px!important;margin-top:2px!important}
      #view-dashboard .pool-sort{padding:6px 9px!important}
      #view-dashboard .pool-card{padding:9px 10px!important}
      #view-dashboard .pool-card .avatar{width:31px!important;height:31px!important;font-size:10px!important}
      #view-dashboard .pool-card .pool-person strong{font-size:12.5px!important}
      #view-dashboard .pool-card .pool-person small{font-size:10px!important;max-width:245px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #view-dashboard .pool-card .pool-money{font-size:11px!important}
      #view-dashboard .pool-card .tag-row{gap:4px!important;margin-top:5px!important}
      #view-dashboard .pool-card .tag-row>*{font-size:9.5px!important;min-height:20px!important;padding:1px 6px!important}
      #view-dashboard .pool-card .tag-row>*:nth-child(n+4){display:none!important}
      #view-dashboard .pool-card .pool-meta{margin-top:6px!important;padding-top:5px!important;font-size:9.8px!important}
      #view-dashboard .pool-open-btn{font-size:10px!important}

      #customerWorkspace.pvw-clean{overflow:auto!important;background:#f6f7f9!important;padding:0!important}
      .pvw-head{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid #e1e5eb;padding:13px 15px 11px}
      .pvw-head-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .pvw-title{min-width:0}.pvw-title h2{font-size:19px;margin:0;color:#101828;line-height:1.25}.pvw-title p{margin:4px 0 0;font-size:10.8px;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pvw-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.pvw-actions .button{min-height:31px!important;height:31px!important;padding:0 10px!important;font-size:10.5px!important}
      .pvw-status{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.pvw-chip{display:inline-flex;align-items:center;min-height:22px;padding:1px 7px;border:1px solid #d9dee6;background:#f8fafc;border-radius:11px;color:#475467;font-size:9.8px}.pvw-chip.primary{border-color:#b9cbee;background:#eef4ff;color:#2456a4;font-weight:700}.pvw-chip.due{border-color:#f1c58e;background:#fff7ea;color:#a15800}
      .pvw-body{padding:10px;display:grid;gap:9px}
      .pvw-next{border:1px solid #cbd8ed;border-left:4px solid #315fbd;background:#f7f9fd;border-radius:6px;padding:10px 12px}.pvw-next small{display:block;color:#667085;font-size:9.8px;margin-bottom:4px}.pvw-next strong{display:block;font-size:13px;color:#172033;line-height:1.45}.pvw-next-meta{margin-top:6px;font-size:9.8px;color:#667085}
      .pvw-card{background:#fff;border:1px solid #e0e4ea;border-radius:7px;overflow:hidden}.pvw-card-head{padding:8px 11px;border-bottom:1px solid #edf0f3;display:flex;justify-content:space-between;align-items:center}.pvw-card-head h3{margin:0;font-size:11.5px;color:#273142}.pvw-card-head span{font-size:9.5px;color:#8a94a3}.pvw-card-body{padding:10px 11px}
      .pvw-reg{display:grid;grid-template-columns:1.25fr .75fr;gap:8px}.pvw-box{border:1px solid #e7e9ed;border-radius:5px;padding:8px 9px;min-width:0}.pvw-box small{display:block;color:#8a94a3;font-size:9.5px;margin-bottom:4px}.pvw-box p{margin:0;color:#344054;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word}.pvw-box p.main{font-size:11.8px;color:#172033;font-weight:600}.pvw-box.wide{grid-column:1/-1}
      .pvw-last{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.pvw-last>div{border:1px solid #e7e9ed;border-radius:5px;padding:8px 9px;min-width:0}.pvw-last small{display:block;color:#8a94a3;font-size:9.5px;margin-bottom:4px}.pvw-last p{margin:0;font-size:10.8px;line-height:1.42;color:#344054;white-space:pre-wrap;word-break:break-word}
      .pvw-empty{padding:16px;color:#98a2b3;font-size:11px;text-align:center}
      @media(max-width:1200px){#view-dashboard .workspace-layout{grid-template-columns:minmax(330px,390px) minmax(0,1fr)!important}.pvw-reg{grid-template-columns:1fr}.pvw-box.wide{grid-column:auto}.pvw-last{grid-template-columns:1fr}}
      @media(max-width:900px){#view-dashboard .workspace-layout{grid-template-columns:1fr!important}#view-dashboard .customer-pool-panel,#view-dashboard .customer-workspace{height:auto!important;min-height:420px!important}}
    `;d.head.appendChild(st);
  }

  function filterToggle(d){
    const panel=d.querySelector('#view-dashboard .sequence-filter'),title=panel?.querySelector('.sequence-filter-title');if(!panel||!title)return;
    let b=d.getElementById('pvFilterToggle');
    if(!b){b=d.createElement('button');b.type='button';b.id='pvFilterToggle';title.appendChild(b);const saved=sessionStorage.getItem('pv-workbench-filter-open');panel.classList.toggle('pv-filter-collapsed',saved!=='1');b.onclick=()=>{panel.classList.toggle('pv-filter-collapsed');sessionStorage.setItem('pv-workbench-filter-open',panel.classList.contains('pv-filter-collapsed')?'0':'1');syncFilterButton(panel,b);};}
    syncFilterButton(panel,b);
  }
  function syncFilterButton(panel,b){if(!panel||!b)return;b.textContent=panel.classList.contains('pv-filter-collapsed')?'筛选 ▾':'收起筛选 ▴';}

  function compactPool(d){
    d.querySelectorAll('#customerPool .pool-card').forEach(card=>{
      const money=card.querySelector('.pool-money');if(money&&/^\$0(?:\D|$)/.test(money.textContent.trim()))money.style.display='none';
      const firstMeta=card.querySelector('.pool-meta > span:first-child');if(firstMeta&&firstMeta.textContent.includes('距上次跟进 0 天'))firstMeta.style.opacity='.55';
    });
  }

  function selectedId(d){return d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#customerPool .pool-card.active')?.dataset.detailCustomer||'';}
  function workspaceHtml(c){
    const last=Array.isArray(c.timeline)&&c.timeline.length?c.timeline[0]:null;
    const next=last?.nextAction||c.nextAction||c.note||'确认客户当前需求，并记录下一步动作。';
    const demand=c.demandDetail||c.product||'待确认';
    const original=c.firstMessage||'登记时没有填写客户原始消息。';
    const note=c.note||'暂无内部备注。';
    const stage=STAGES[c.stage]||c.stage||'—';
    return `
      <div class="pvw-head">
        <div class="pvw-head-top">
          <div class="pvw-title"><h2>${esc(c.name||'未命名客户')}</h2><p>${esc(c.contact||'无联系方式')} · ${esc(c.country||'待确认')} · ${esc(demand)}</p></div>
          <div class="pvw-actions"><button type="button" class="button primary small" data-follow-customer="${esc(c.id)}">＋ 记录跟进</button><button type="button" class="button secondary small" data-open-detail="${esc(c.id)}">完整资料</button></div>
        </div>
        <div class="pvw-status"><span class="pvw-chip primary">${esc(c.grade||'B')}级</span><span class="pvw-chip">${esc(stage)}</span><span class="pvw-chip">负责人 ${esc(c.owner||'—')}</span>${c.whatsapp&&c.whatsapp!=='—'?`<span class="pvw-chip">${esc(c.whatsapp)}</span>`:''}<span class="pvw-chip ${String(c.nextFollowUp||'').slice(0,10)<=today()?'due':''}">下次 ${esc(dueText(c))}</span></div>
      </div>
      <div class="pvw-body">
        <section class="pvw-next"><small>下一步</small><strong>${esc(next)}</strong><div class="pvw-next-meta">${last?`上次跟进 ${fmt(last.date)} · ${esc(last.author||c.owner||'')}`:'还没有正式跟进记录'}</div></section>
        <section class="pvw-card"><div class="pvw-card-head"><h3>登记内容</h3><span>业务员录入的信息</span></div><div class="pvw-card-body"><div class="pvw-reg"><div class="pvw-box"><small>客户最初说了什么</small><p class="main">${esc(original)}</p></div><div class="pvw-box"><small>需求 / 规格数量</small><p>${esc(demand)}</p></div><div class="pvw-box wide"><small>内部备注</small><p>${esc(note)}</p></div></div></div></section>
        <section class="pvw-card"><div class="pvw-card-head"><h3>最近一次跟进</h3><span>${last?`${fmt(last.date)} · ${esc(last.author||'')}`:'暂无'}</span></div><div class="pvw-card-body">${last?`<div class="pvw-last"><div><small>做了什么</small><p>${esc(last.content||'—')}</p></div><div><small>客户反馈</small><p>${esc(last.feedback||'—')}</p></div><div><small>下一步</small><p>${esc(last.nextAction||'—')}</p></div></div>`:'<div class="pvw-empty">还没有跟进记录。直接点击上方“记录跟进”开始。</div>'}</div></section>
      </div>`;
  }

  function renderWorkspace(d){
    const ws=d.getElementById('customerWorkspace');if(!ws)return;
    const id=selectedId(d);if(!id)return;
    const c=customer(id);if(!c)return;
    if(ws.dataset.pvwCleanId===String(id)&&ws.querySelector('.pvw-head'))return;
    ws.classList.add('pvw-clean');ws.dataset.pvwCleanId=String(id);ws.innerHTML=workspaceHtml(c);
  }

  function apply(d){
    if(!d)return;styles(d);filterToggle(d);compactPool(d);renderWorkspace(d);
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;try{apply(frame.contentDocument);}catch(_){}},30);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;apply(d);
    const dash=d.getElementById('view-dashboard');if(dash&&!dash.dataset.pvwObserved){dash.dataset.pvwObserved='1';new MutationObserver(schedule).observe(dash,{childList:true,subtree:true});}
    if(!d.documentElement.dataset.pvwClickBound){d.documentElement.dataset.pvwClickBound='1';d.addEventListener('click',e=>{if(e.target.closest('[data-select-customer]')||e.target.closest('[data-pool-filter]')||e.target.closest('#resetPoolFilters'))schedule();},true);d.addEventListener('change',e=>{if(e.target.closest('#view-dashboard .filter-selects')||e.target.closest('#poolSort'))schedule();},true);}
  }

  frame.addEventListener('load',()=>{setTimeout(attach,100);setTimeout(attach,500);});
  setInterval(()=>{try{attach();}catch(_){}},1800);
})();
