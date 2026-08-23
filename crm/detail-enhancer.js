(() => {
  const KEY='peptivanta-crm-v2';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stages={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  const days=iso=>{if(!iso)return 999;const a=new Date(iso+'T12:00:00'),b=new Date();b.setHours(12,0,0,0);return Math.max(0,Math.round((b-a)/86400000))};
  const fmt=iso=>iso?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(iso+'T12:00:00')):'未安排';
  const readState=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  let open=false, currentId=null, sequence=[], sequenceLabel='当前客户序列', lastTapId=null, lastTapAt=0;

  function customer(id){return (readState().customers||[]).find(x=>x.id===id)}
  function advice(c){const d=days(c.lastContact),fb=String(c.timeline?.[0]?.feedback||'');if(c.owner==='未归属')return'先确认负责人和 WhatsApp 归属，避免多人重复联系。';if(['new','contacted'].includes(c.stage))return'先确认产品、规格、数量、目的地和客户身份，再发送针对性资料。';if(['qualifying','catalog'].includes(c.stage))return c.customerType==='机构采购'?'先把资质、检测文件和采购流程确认清楚，再进入报价。':'把规格、数量、MOQ 和物流等关键需求补齐后再报价。';if(['quoted','negotiating'].includes(c.stage))return fb.includes('未回复')||d>=3?'做一次轻度唤醒，从客户上次关注点切入，不要重复整份报价。':'围绕报价后的具体阻力推进，只解决当前最关键的一项。';if(c.stage==='payment')return'本次只推进付款确认和到账，不再重新介绍产品。';if(c.stage==='fulfillment')return'以物流、签收和异常处理为主，签收后再进入售后或复购。';if(c.stage==='repeat')return'从上次订单和补货周期切入复购，不要把熟客当新询盘重新教育。';return'根据最近一次沟通内容推进下一步。'}
  function tags(c){const out=[c.grade,stages[c.stage]||c.stage,c.customerType,...(c.traits||[])].filter(Boolean);if(days(c.lastContact)>=3)out.splice(2,0,days(c.lastContact)+'天未跟进');if(c.protected)out.push('保护客户');return [...new Set(out)].slice(0,8).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}

  function idsFromPool(){return $$('#customerPool [data-detail-customer]').map(x=>x.dataset.detailCustomer).filter(Boolean)}
  function idsFromList(){return $$('#customersBody [data-detail-row]').map(x=>x.dataset.detailRow).filter(Boolean)}
  function idsFromFollowups(){return [...new Set($$('#followupLog [data-open-list-detail]').map(x=>x.dataset.openListDetail).filter(Boolean))]}
  function idsFromPipeline(el){const col=el?.closest('.kanban-column');return col?$$('[data-pipeline-detail]',col).map(x=>x.dataset.pipelineDetail).filter(Boolean):[]}
  function sequenceFor(el,id){
    if(el?.closest('#customerPool'))return{ids:idsFromPool(),label:'当前筛选客户'};
    if(el?.closest('#customersBody'))return{ids:idsFromList(),label:'当前客户列表'};
    if(el?.closest('#followupLog'))return{ids:idsFromFollowups(),label:'当前跟进列表'};
    if(el?.closest('.kanban-column'))return{ids:idsFromPipeline(el),label:'当前销售阶段'};
    const pool=idsFromPool();return{ids:pool.includes(id)?pool:(readState().customers||[]).map(c=>c.id),label:pool.includes(id)?'当前筛选客户':'全部客户'};
  }

  function ensurePoolButtons(){
    $$('#customerPool .pool-card').forEach(card=>{
      const id=card.dataset.detailCustomer||card.dataset.selectCustomer;if(!id||card.querySelector('[data-runtime-open]'))return;
      const meta=card.querySelector('.pool-meta');if(!meta)return;
      const btn=document.createElement('button');btn.type='button';btn.className='text-button pool-open-btn';btn.dataset.runtimeOpen=id;btn.textContent='打开客户';meta.appendChild(btn);
    });
  }

  function render(){
    if(!open)return;const c=customer(currentId),overlay=$('#detailOverlay'),body=$('#detailModalBody');if(!c||!overlay||!body){close();return}
    let idx=sequence.indexOf(currentId);if(idx<0){idx=0;currentId=sequence[0];return render()}
    const prev=sequence[idx-1],next=sequence[idx+1],last=c.timeline?.[0];
    $('#sequencePosition').textContent=`${idx+1} / ${sequence.length} · ${sequenceLabel}`;
    $('#sequencePrev').disabled=!prev;$('#sequenceNext').disabled=!next;
    $('#prevCustomerName').textContent=prev?(customer(prev)?.name||'上一个'):'已到第一位';
    $('#nextCustomerName').textContent=next?(customer(next)?.name||'下一个'):'已到最后一位';
    $('#detailFollowBtn').dataset.runtimeCustomer=currentId;
    body.innerHTML=`<div class="enhanced-detail-root"><div class="detail-command"><div class="detail-identity"><div class="avatar">${esc((c.name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div><h2>${esc(c.name)}</h2><p>${esc(c.company||'')} · ${esc(c.country||'')} · ${esc(c.contact||'')}</p><div class="tag-row">${tags(c)}</div></div></div><div class="detail-command-actions"><button class="button secondary small" data-runtime-copy-contact>复制联系方式</button><button class="button secondary small" data-runtime-copy-summary>复制客户摘要</button><button class="button primary small" data-runtime-follow>记录跟进</button></div></div><div class="detail-working-grid"><main class="detail-main-column"><section class="detail-section detail-priority"><div class="section-title-row"><h3>当前要做</h3><span>下次：${esc(fmt(c.nextFollowUp))}</span></div><div class="priority-action">${esc(advice(c))}</div><div class="priority-meta"><span><b>销售阶段</b>${esc(stages[c.stage]||c.stage)}</span><span><b>距上次跟进</b>${days(c.lastContact)} 天</span><span><b>负责人</b>${esc(c.owner)}</span><span><b>客户类型</b>${esc(c.customerType)}</span></div></section>${c.firstMessage?`<section class="detail-section"><div class="section-title-row"><h3>客户原始消息</h3><span>${esc(c.source||'')}</span></div><div class="original-message">${esc(c.firstMessage)}</div></section>`:''}<section class="detail-section"><div class="section-title-row"><h3>最近一次跟进</h3><span>${last?`${fmt(last.date)} · ${esc(last.author||'')}`:'暂无记录'}</span></div>${last?`<div class="detail-follow-cards"><div><small>跟进内容</small><p>${esc(last.content||'')}</p></div><div><small>客户反馈</small><p>${esc(last.feedback||'')}</p></div><div><small>下一步</small><p>${esc(last.nextAction||'')}</p></div></div>`:'<div class="empty-detail-note">还没有跟进记录。</div>'}</section><section class="detail-section"><div class="section-title-row"><h3>跟进历史</h3><span>${c.timeline?.length||0} 条</span></div><div class="timeline">${(c.timeline||[]).map(t=>`<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-head"><strong>${esc(t.type||'跟进')} · ${esc(t.channel||'')}</strong><span>${fmt(t.date)} · ${esc(t.author||'')}</span></div><div class="timeline-grid"><div class="timeline-box"><small>跟进内容</small><p>${esc(t.content||'')}</p></div><div class="timeline-box"><small>客户反馈</small><p>${esc(t.feedback||'')}</p></div><div class="timeline-box"><small>下一步</small><p>${esc(t.nextAction||'')}</p></div><div class="timeline-box"><small>下次跟进</small><p>${fmt(t.nextDate)}</p></div></div></div>`).join('')}</div></section></main><aside class="detail-side-column"><div class="detail-side-card"><h3>客户信息</h3><dl><div><dt>负责人</dt><dd>${esc(c.owner)}</dd></div><div><dt>销售组</dt><dd>${esc(c.team)}</dd></div><div><dt>WhatsApp</dt><dd>${esc(c.whatsapp)}</dd></div><div><dt>客户类型</dt><dd>${esc(c.customerType)}</dd></div><div><dt>主要产品</dt><dd>${esc(c.product)}</dd></div><div><dt>机会金额</dt><dd>${money(c.value)}</dd></div><div><dt>销售阶段</dt><dd>${esc(stages[c.stage]||c.stage)}</dd></div><div><dt>最后跟进</dt><dd>${days(c.lastContact)} 天前</dd></div><div><dt>下次跟进</dt><dd>${esc(fmt(c.nextFollowUp))}</dd></div><div><dt>风险</dt><dd>${esc(c.risk||'')}</dd></div></dl></div><div class="detail-side-card"><h3>内部备注</h3><p>${esc(c.note||'暂无备注')}</p></div></aside></div></div>`;
    body.scrollTop=0;
  }

  function openDetail(id,el){const c=customer(id);if(!c)return;const s=sequenceFor(el,id);sequence=s.ids.includes(id)?s.ids:[id];sequenceLabel=s.label;currentId=id;open=true;const overlay=$('#detailOverlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');render()}
  function close(){open=false;currentId=null;sequence=[];const overlay=$('#detailOverlay');overlay?.classList.remove('open');overlay?.setAttribute('aria-hidden','true')}
  function move(step){if(!open)return;const i=sequence.indexOf(currentId),id=sequence[i+step];if(!id)return;currentId=id;render()}
  function startFollow(){const id=currentId;if(!id)return;close();const quick=$('#quickFollowBtn');quick?.click();setTimeout(()=>{const sel=$('#followCustomerSelect');if(sel)sel.value=id;const date=$('#followForm [name=nextDate]');if(date&&!date.value){const d=new Date();d.setDate(d.getDate()+1);date.value=d.toISOString().slice(0,10)}},0)}

  document.addEventListener('click',e=>{
    const runtime=e.target.closest('[data-runtime-open]');if(runtime){e.preventDefault();e.stopImmediatePropagation();openDetail(runtime.dataset.runtimeOpen,runtime);return}
    const od=e.target.closest('[data-open-detail]');if(od){e.preventDefault();e.stopImmediatePropagation();openDetail(od.dataset.openDetail,od);return}
    const ld=e.target.closest('[data-open-list-detail]');if(ld){e.preventDefault();e.stopImmediatePropagation();openDetail(ld.dataset.openListDetail,ld);return}
    const card=e.target.closest('#customerPool [data-detail-customer]');if(card){const id=card.dataset.detailCustomer,now=Date.now();if(lastTapId===id&&now-lastTapAt<450){e.preventDefault();e.stopImmediatePropagation();lastTapId=null;lastTapAt=0;openDetail(id,card);return}lastTapId=id;lastTapAt=now;return}
    if(open&&e.target.closest('#sequencePrev')){e.preventDefault();e.stopImmediatePropagation();move(-1);return}
    if(open&&e.target.closest('#sequenceNext')){e.preventDefault();e.stopImmediatePropagation();move(1);return}
    if(open&&e.target.closest('#detailClose')){e.preventDefault();e.stopImmediatePropagation();close();return}
    if(open&&e.target=== $('#detailOverlay')){e.preventDefault();e.stopImmediatePropagation();close();return}
    if(open&&e.target.closest('#detailFollowBtn,[data-runtime-follow]')){e.preventDefault();e.stopImmediatePropagation();startFollow();return}
    if(open&&e.target.closest('[data-runtime-copy-contact]')){e.preventDefault();e.stopImmediatePropagation();const c=customer(currentId);if(c)navigator.clipboard?.writeText(c.contact||'');return}
    if(open&&e.target.closest('[data-runtime-copy-summary]')){e.preventDefault();e.stopImmediatePropagation();const c=customer(currentId);if(c)navigator.clipboard?.writeText(`${c.name} | ${c.country} | ${c.customerType} | ${c.product} | ${stages[c.stage]||c.stage} | 负责人:${c.owner}`);return}
  },true);

  document.addEventListener('dblclick',e=>{const card=e.target.closest('[data-detail-customer]'),row=e.target.closest('[data-detail-row]'),deal=e.target.closest('[data-pipeline-detail]');const el=card||row||deal;if(!el)return;e.preventDefault();e.stopImmediatePropagation();openDetail(card?.dataset.detailCustomer||row?.dataset.detailRow||deal?.dataset.pipelineDetail,el)},true);
  document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();move(-1)}else if(e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();move(1)}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}},true);

  const pool=$('#customerPool');if(pool)new MutationObserver(()=>queueMicrotask(ensurePoolButtons)).observe(pool,{childList:true,subtree:true});ensurePoolButtons();
})();