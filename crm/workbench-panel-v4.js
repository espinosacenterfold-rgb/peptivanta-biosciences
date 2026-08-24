(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const STAGES={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  let queued=false;

  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const selectedId=d=>d.querySelector('#customerPool .pool-card.active')?.dataset.selectCustomer||d.querySelector('#customerPool .pool-card.active')?.dataset.detailCustomer||'';
  const customer=id=>(read().customers||[]).find(c=>String(c.id)===String(id));
  const fmt=v=>{if(!v)return'—';const s=String(v).slice(0,10);try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(s+'T12:00:00'))}catch{return s}};
  const dueText=c=>{const d=String(c?.nextFollowUp||'').slice(0,10);if(!d)return'未安排';if(d===today())return'今天';if(d<today()){const n=Math.max(1,Math.round((new Date(today()+'T12:00:00')-new Date(d+'T12:00:00'))/86400000));return`逾期 ${n} 天`;}return fmt(d)};

  function styles(d){
    if(d.getElementById('pvWorkbenchPanelV4Styles'))return;
    const s=d.createElement('style');s.id='pvWorkbenchPanelV4Styles';s.textContent=`
      /* Remove unassigned as a normal workbench concept. */
      #view-dashboard [data-pool-filter="unowned"]{display:none!important}

      /* Scale up the workbench so it matches the approved visual direction. */
      #view-dashboard{font-size:14px!important}
      #view-dashboard .pv2-kpi{min-height:104px!important;padding:18px 20px 16px 82px!important}
      #view-dashboard .pv2-kpi-icon{width:46px!important;height:46px!important;left:20px!important;top:21px!important}
      #view-dashboard .pv2-kpi .kpi-label{font-size:14px!important;font-weight:650!important}
      #view-dashboard .pv2-kpi .kpi-value{font-size:31px!important}
      #view-dashboard .pv2-kpi .kpi-foot{font-size:12px!important}
      #view-dashboard .sequence-filter-title strong{font-size:14px!important}
      #view-dashboard .filter-selects label span{font-size:12px!important}
      #view-dashboard .filter-selects select{font-size:13px!important;height:40px!important}
      #view-dashboard .panel-heading h2{font-size:17px!important}
      #view-dashboard .pool-sort{font-size:12px!important}
      #view-dashboard .pool-card{padding:12px 13px!important}
      #view-dashboard .pool-card .avatar{width:36px!important;height:36px!important;font-size:12px!important}
      #view-dashboard .pool-person strong{font-size:14px!important}
      #view-dashboard .pool-person small{font-size:11px!important}
      #view-dashboard .pool-card .tag-row>*{font-size:10.5px!important;min-height:22px!important}
      #view-dashboard .pool-meta{font-size:11px!important}

      /* Rebuilt customer situation header. */
      #customerWorkspace .pv4-situation{display:grid;grid-template-columns:minmax(300px,1.7fr) repeat(3,minmax(130px,.72fr));gap:0;margin-top:16px;border-top:1px solid #e7ebf1;border-bottom:1px solid #e7ebf1;background:#fff}
      #customerWorkspace .pv4-sit-item{min-width:0;padding:14px 16px;border-right:1px solid #e7ebf1}
      #customerWorkspace .pv4-sit-item:last-child{border-right:0}
      #customerWorkspace .pv4-sit-item small{display:block;color:#7d8798;font-size:11.5px;font-weight:600;margin-bottom:6px}
      #customerWorkspace .pv4-sit-item b{display:block;color:#13213a;font-size:15px;line-height:1.4;font-weight:750;white-space:normal;word-break:break-word}
      #customerWorkspace .pv4-product b{font-size:16px}
      #customerWorkspace .pv4-product-extra{display:grid;gap:5px;margin-top:9px;padding-top:8px;border-top:1px dashed #e2e7ee}
      #customerWorkspace .pv4-product-extra div{font-size:11.5px;line-height:1.45;color:#556173;display:grid;grid-template-columns:74px minmax(0,1fr);gap:7px}
      #customerWorkspace .pv4-product-extra span{color:#8a94a3}
      #customerWorkspace .pv4-stage b{color:#245fc3}
      #customerWorkspace .pv4-grade b{color:#23865b}
      #customerWorkspace .pv4-meta-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
      #customerWorkspace .pv4-meta-chip{display:inline-flex;align-items:center;min-height:26px;padding:2px 9px;border:1px solid #dce2e9;border-radius:13px;background:#f8fafc;color:#566173;font-size:11px}
      #customerWorkspace .pv4-meta-chip.due{border-color:#f0c98f;background:#fff7ea;color:#a35e00;font-weight:700}
      #customerWorkspace .pv2-title h2{font-size:23px!important}
      #customerWorkspace .pv2-contact-line{font-size:12.5px!important}
      #customerWorkspace .pv2-phone{font-size:16px!important;font-weight:850!important}
      #customerWorkspace .pv2-next small,#customerWorkspace .pv2-section-head span{font-size:11px!important}
      #customerWorkspace .pv2-next strong{font-size:15px!important}
      #customerWorkspace .pv2-section-head h3{font-size:14px!important}
      #customerWorkspace .pv2-register-cell small,#customerWorkspace .pv2-follow-cell small{font-size:11px!important}
      #customerWorkspace .pv2-register-cell p,#customerWorkspace .pv2-follow-cell p{font-size:12.5px!important;line-height:1.55!important}
      #customerWorkspace .pv2-actions .button{font-size:12px!important;height:40px!important}

      @media(max-width:1200px){#customerWorkspace .pv4-situation{grid-template-columns:1.5fr repeat(3,.7fr)}#customerWorkspace .pv4-sit-item{padding:12px}}
      @media(max-width:900px){#customerWorkspace .pv4-situation{grid-template-columns:1fr 1fr}.pv4-product{grid-column:1/-1}.pv4-sit-item{border-bottom:1px solid #e7ebf1}}
    `;d.head.appendChild(s);
  }

  function replaceFourthKpi(d){
    const cards=[...d.querySelectorAll('#kpiGrid .kpi-card')];if(cards.length<4)return;
    const card=cards[3],state=read();
    const n=(state.customers||[]).filter(c=>String(c.leadAt||c.createdAt||'').slice(0,10)===today()).length;
    const label=card.querySelector('.kpi-label'),value=card.querySelector('.kpi-value'),foot=card.querySelector('.kpi-foot');
    if(label)label.textContent='今日新粉';if(value)value.textContent=String(n);if(foot)foot.textContent='按真实进粉时间统计';
  }

  function rebuildSituation(d){
    const ws=d.getElementById('customerWorkspace');if(!ws)return;
    const id=selectedId(d);if(!id)return;const c=customer(id);if(!c)return;
    if(ws.dataset.pv4Situation===String(id)&&ws.querySelector('.pv4-situation'))return;

    const head=ws.querySelector('.pv2-head');if(!head)return;
    head.querySelector('.pv2-summary')?.remove();
    head.querySelector('.pv2-summary-sub')?.remove();
    head.querySelector('.pv4-situation')?.remove();
    head.querySelector('.pv4-meta-row')?.remove();

    const product=c.product||'待确认';
    const demand=c.demandDetail||'未补充';
    const objection=c.currentObjection||'未确认';
    const stage=STAGES[c.stage]||c.stage||'—';
    const type=c.customerType||'待确认';
    const grade=(c.grade||'B')+'级';
    const situation=d.createElement('div');situation.className='pv4-situation';situation.innerHTML=`
      <div class="pv4-sit-item pv4-product"><small>主要产品 / 需求</small><b>${esc(product)}</b><div class="pv4-product-extra"><div><span>规格 / 数量</span><strong>${esc(demand)}</strong></div><div><span>主要阻力</span><strong>${esc(objection)}</strong></div></div></div>
      <div class="pv4-sit-item"><small>客户类型</small><b>${esc(type)}</b></div>
      <div class="pv4-sit-item pv4-stage"><small>销售阶段</small><b>${esc(stage)}</b></div>
      <div class="pv4-sit-item pv4-grade"><small>客户等级</small><b>${esc(grade)}</b></div>`;
    head.appendChild(situation);

    const meta=d.createElement('div');meta.className='pv4-meta-row';
    const traits=[...(c.traits||[])].filter(Boolean).slice(0,3);
    meta.innerHTML=`<span class="pv4-meta-chip">负责人：${esc(c.owner||'—')}</span><span class="pv4-meta-chip">团队：${esc(c.team||'—')}</span><span class="pv4-meta-chip">最后跟进：${esc(fmt(c.lastContact))}</span><span class="pv4-meta-chip due">下次跟进：${esc(dueText(c))}</span>${traits.map(x=>`<span class="pv4-meta-chip">${esc(x)}</span>`).join('')}`;
    head.appendChild(meta);
    ws.dataset.pv4Situation=String(id);
  }

  function removeDuplicateDetailFields(d){
    const ws=d.getElementById('customerWorkspace');if(!ws)return;
    ws.querySelectorAll('.pv2-register-cell').forEach(cell=>{
      const label=cell.querySelector('small')?.textContent?.trim()||'';
      if(/需求\s*\/\s*规格|规格\s*\/\s*数量|当前主要阻力|主要阻力/.test(label))cell.remove();
    });
  }

  function apply(){
    try{const d=frame.contentDocument;if(!d)return;styles(d);replaceFourthKpi(d);rebuildSituation(d);removeDuplicateDetailFields(d);}catch(_){}
  }
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply();},45);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;apply();
    if(!d.documentElement.dataset.pv4Observed){d.documentElement.dataset.pv4Observed='1';new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});}
    if(!d.documentElement.dataset.pv4Clicks){d.documentElement.dataset.pv4Clicks='1';d.addEventListener('click',e=>{if(e.target.closest('[data-select-customer]')||e.target.closest('[data-pool-filter]')||e.target.closest('[data-view]'))schedule();},true);}
  }
  frame.addEventListener('load',()=>{setTimeout(attach,160);setTimeout(attach,800);});
  setInterval(()=>{try{apply();}catch(_){}},1400);
})();
