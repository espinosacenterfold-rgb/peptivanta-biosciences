(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const STAGES={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  const fmt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(String(v).slice(0,10)+'T12:00:00'))}catch{return String(v)}};
  const daysSince=iso=>{if(!iso)return'—';const a=new Date(String(iso).slice(0,10)+'T12:00:00'),b=new Date();b.setHours(12,0,0,0);return Math.max(0,Math.round((b-a)/86400000))};

  function styles(d){if(d.getElementById('pvCustomerDetailV3Styles'))return;const st=d.createElement('style');st.id='pvCustomerDetailV3Styles';st.textContent=`
    #detailModalBody.pv-detail-v3{padding:0!important;background:#f6f7f9!important}
    .pv3-sticky-id{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #dfe4ea;padding:14px 18px 12px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
    .pv3-id-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.pv3-id-main{min-width:0}.pv3-id-main h2{margin:0;font-size:21px;line-height:1.25;color:#101828}.pv3-id-main p{margin:4px 0 0;color:#667085;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pv3-id-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .pv3-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.pv3-chip{display:inline-flex;align-items:center;min-height:24px;padding:2px 8px;border:1px solid #d9dee6;border-radius:12px;background:#f8fafc;color:#475467;font-size:10.5px}.pv3-chip.strong{border-color:#b9cbee;background:#eef4ff;color:#2456a4;font-weight:700}.pv3-chip.warn{border-color:#f4ca98;background:#fff8ed;color:#9a5a08}
    .pv3-layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:12px;padding:12px}.pv3-main{display:grid;gap:12px;min-width:0}.pv3-side{display:grid;gap:12px;align-content:start}
    .pv3-card{background:#fff;border:1px solid #dfe4ea;border-radius:8px;overflow:hidden}.pv3-card-head{padding:10px 13px;border-bottom:1px solid #edf0f3;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fafbfc}.pv3-card-head h3{margin:0;font-size:13px;color:#101828}.pv3-card-head span{font-size:10.5px;color:#667085}.pv3-card-body{padding:12px 13px}
    .pv3-registered{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.pv3-field{border:1px solid #e5e8ed;border-radius:6px;padding:9px 10px;min-width:0}.pv3-field.wide{grid-column:1/-1}.pv3-field small{display:block;color:#8a94a3;font-size:10px;margin-bottom:4px}.pv3-field p{margin:0;color:#273142;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word}.pv3-field p.emphasis{font-size:13px;font-weight:600;color:#172033}
    .pv3-next{border-left:4px solid #315fbd;background:#f7f9fd;padding:12px 13px}.pv3-next small{display:block;color:#667085;font-size:10.5px;margin-bottom:5px}.pv3-next strong{display:block;color:#172033;font-size:14px;line-height:1.55}.pv3-next-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;color:#667085;font-size:10.5px}
    .pv3-last{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pv3-last>div{border:1px solid #e5e8ed;border-radius:6px;padding:9px 10px}.pv3-last small{display:block;color:#8a94a3;font-size:10px;margin-bottom:4px}.pv3-last p{margin:0;font-size:11.5px;line-height:1.5;color:#344054;white-space:pre-wrap}.pv3-last .wide{grid-column:1/-1}
    .pv3-history{display:grid;gap:7px}.pv3-history-item{border-left:2px solid #d4dbe5;padding:7px 9px 7px 11px;background:#fafbfc}.pv3-history-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:4px}.pv3-history-head b{font-size:11.5px;color:#273142}.pv3-history-head span{font-size:10px;color:#8a94a3}.pv3-history-item p{margin:2px 0;font-size:10.8px;color:#475467;line-height:1.45}.pv3-history-more{margin-top:8px}
    .pv3-info{display:grid;gap:0}.pv3-info-row{display:grid;grid-template-columns:78px 1fr;gap:8px;padding:8px 0;border-bottom:1px solid #eef0f3;font-size:11px}.pv3-info-row:last-child{border-bottom:0}.pv3-info-row span{color:#8a94a3}.pv3-info-row b{color:#344054;font-weight:600;word-break:break-word}
    .pv3-quick label{display:block;margin-bottom:9px}.pv3-quick label span{display:block;font-size:10.5px;color:#667085;margin-bottom:4px}.pv3-quick select,.pv3-quick input{width:100%;height:34px;border:1px solid #cfd5dc;border-radius:5px;background:#fff;padding:0 8px;font-size:11px}.pv3-quick button{width:100%;margin-top:2px}
    .pv3-system summary{cursor:pointer;font-size:11px;font-weight:700;color:#475467;list-style:none}.pv3-system summary::-webkit-details-marker{display:none}.pv3-system summary::after{content:'展开';float:right;color:#98a2b3;font-weight:400}.pv3-system[open] summary::after{content:'收起'}.pv3-system p{margin:8px 0 0;font-size:10.8px;line-height:1.55;color:#667085}
    @media(max-width:900px){.pv3-layout{grid-template-columns:1fr}.pv3-side{grid-template-columns:1fr 1fr}.pv3-registered{grid-template-columns:1fr 1fr}}
    @media(max-width:620px){.pv3-id-top{display:block}.pv3-id-actions{justify-content:flex-start;margin-top:9px}.pv3-side{grid-template-columns:1fr}.pv3-registered,.pv3-last{grid-template-columns:1fr}.pv3-field.wide,.pv3-last .wide{grid-column:auto}}
  `;d.head.appendChild(st);}

  function currentId(body){return body.querySelector('[data-copy-contact]')?.dataset.copyContact||body.querySelector('[data-save-detail-status]')?.dataset.saveDetailStatus||body.querySelector('[data-v9-edit-customer]')?.dataset.v9EditCustomer||'';}
  function customer(id){return (read().customers||[]).find(c=>String(c.id)===String(id));}
  function tags(c){const xs=[c.grade,STAGES[c.stage]||c.stage,c.customerType,...(c.traits||[])].filter(Boolean);return [...new Set(xs)].slice(0,8).map((x,i)=>`<span class="pv3-chip ${i===0?'strong':''}">${esc(x)}</span>`).join('');}
  function history(c){const all=Array.isArray(c.timeline)?c.timeline:[];if(!all.length)return'<div style="font-size:11px;color:#98a2b3">还没有跟进记录。</div>';return `<div class="pv3-history">${all.slice(0,5).map(t=>`<div class="pv3-history-item"><div class="pv3-history-head"><b>${esc(t.type||'跟进')} · ${esc(t.channel||'')}</b><span>${fmt(t.date)} · ${esc(t.author||'')}</span></div><p><b>做了什么：</b>${esc(t.content||'—')}</p><p><b>客户反馈：</b>${esc(t.feedback||'—')}</p><p><b>下一步：</b>${esc(t.nextAction||'—')}</p></div>`).join('')}</div>${all.length>5?`<details class="pv3-history-more"><summary>还有 ${all.length-5} 条更早记录</summary><div class="pv3-history" style="margin-top:7px">${all.slice(5).map(t=>`<div class="pv3-history-item"><div class="pv3-history-head"><b>${esc(t.type||'跟进')}</b><span>${fmt(t.date)}</span></div><p>${esc(t.content||'')}</p></div>`).join('')}</div></details>`:''}`;}
  function render(body,c,d){
    if(!c)return;
    styles(d);
    const last=c.timeline?.[0];
    const next=last?.nextAction||c.note||'先确认客户当前需求，再记录下一步动作。';
    const due=c.nextFollowUp?fmt(c.nextFollowUp):'未安排';
    const leadAt=c.leadAt?String(c.leadAt).replace('T',' '):(c.createdAt||'—');
    const sequence=d.getElementById('sequencePosition');if(sequence){const old=sequence.textContent||'';const count=old.includes('·')?old.split('·')[0].trim():old;sequence.textContent=`${c.name} · ${count}`;}
    body.classList.add('pv-detail-v3');body.dataset.pvDetailId=c.id;
    body.innerHTML=`
      <div class="pv3-sticky-id">
        <div class="pv3-id-top"><div class="pv3-id-main"><h2>${esc(c.name||'未命名客户')}</h2><p>${esc(c.contact||'无联系方式')} · ${esc(c.country||'待确认')} · ${esc(c.product||'待确认')}</p></div><div class="pv3-id-actions"><button type="button" class="button secondary small" data-v9-edit-customer="${esc(c.id)}">编辑登记信息</button><button type="button" class="button primary small" data-v9-quick-follow="${esc(c.id)}">立即记录跟进</button><button type="button" class="button secondary small" data-copy-contact="${esc(c.id)}">复制联系方式</button></div></div>
        <div class="pv3-chips">${tags(c)}${c.protected?'<span class="pv3-chip strong">保护客户</span>':''}${c.nextFollowUp&&String(c.nextFollowUp).slice(0,10)<=new Date().toISOString().slice(0,10)?'<span class="pv3-chip warn">需要跟进</span>':''}</div>
      </div>
      <div class="pv3-layout">
        <main class="pv3-main">
          <section class="pv3-card"><div class="pv3-card-head"><h3>业务员登记信息</h3><span>打开客户先看这里</span></div><div class="pv3-card-body"><div class="pv3-registered">
            <div class="pv3-field wide"><small>客户最初说了什么</small><p class="emphasis">${esc(c.firstMessage||'登记时没有填写原始消息')}</p></div>
            <div class="pv3-field"><small>主要产品 / 需求</small><p>${esc(c.product||'待确认')}</p></div>
            <div class="pv3-field"><small>客户类型</small><p>${esc(c.customerType||'待确认')}</p></div>
            <div class="pv3-field wide"><small>业务员内部备注</small><p>${esc(c.note||'暂无内部备注')}</p></div>
            <div class="pv3-field wide"><small>登记标签</small><p>${esc((c.traits||[]).join(' · ')||'暂无标签')}</p></div>
          </div></div></section>
          <section class="pv3-card"><div class="pv3-card-head"><h3>现在要做什么</h3><span>下次跟进 ${due}</span></div><div class="pv3-next"><small>下一步动作</small><strong>${esc(next)}</strong><div class="pv3-next-meta"><span>负责人：${esc(c.owner||'—')}</span><span>阶段：${esc(STAGES[c.stage]||c.stage||'—')}</span><span>等级：${esc(c.grade||'—')}</span></div></div></section>
          <section class="pv3-card"><div class="pv3-card-head"><h3>最近一次跟进</h3><span>${last?`${fmt(last.date)} · ${esc(last.author||'')}`:'暂无记录'}</span></div><div class="pv3-card-body">${last?`<div class="pv3-last"><div><small>做了什么</small><p>${esc(last.content||'—')}</p></div><div><small>客户反馈</small><p>${esc(last.feedback||'—')}</p></div><div class="wide"><small>下一步</small><p>${esc(last.nextAction||'—')}</p></div></div>`:'<div style="font-size:11px;color:#98a2b3">还没有正式跟进记录。可以直接点击上方“立即记录跟进”。</div>'}</div></section>
          <section class="pv3-card"><div class="pv3-card-head"><h3>跟进历史</h3><span>最近记录优先</span></div><div class="pv3-card-body">${history(c)}</div></section>
        </main>
        <aside class="pv3-side">
          <section class="pv3-card"><div class="pv3-card-head"><h3>客户身份</h3></div><div class="pv3-card-body pv3-info">
            <div class="pv3-info-row"><span>负责人</span><b>${esc(c.owner||'—')}</b></div><div class="pv3-info-row"><span>销售组</span><b>${esc(c.team||'—')}</b></div><div class="pv3-info-row"><span>来源 WS</span><b>${esc(c.whatsapp||'—')}</b></div><div class="pv3-info-row"><span>来源</span><b>${esc(c.source||'—')}</b></div><div class="pv3-info-row"><span>进粉时间</span><b>${esc(leadAt)}</b></div><div class="pv3-info-row"><span>机会金额</span><b>${money(c.value)}</b></div><div class="pv3-info-row"><span>上次跟进</span><b>${daysSince(c.lastContact)} 天前</b></div>
          </div></section>
          <section class="pv3-card"><div class="pv3-card-head"><h3>快速更新</h3><span>不用打开编辑页</span></div><div class="pv3-card-body pv3-quick"><label><span>销售阶段</span><select id="detailStageSelect">${Object.entries(STAGES).map(([k,v])=>`<option value="${k}" ${c.stage===k?'selected':''}>${v}</option>`).join('')}</select></label><label><span>客户等级</span><select id="detailGradeSelect">${['S','A','B','C','D'].map(x=>`<option ${c.grade===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>下次跟进</span><input id="detailNextDate" type="date" value="${esc(c.nextFollowUp||'')}"></label><button class="button primary" data-save-detail-status="${esc(c.id)}">保存状态</button></div></section>
          <section class="pv3-card"><div class="pv3-card-body"><details class="pv3-system"><summary>系统建议（可选看）</summary><p>系统建议仅作辅助。实际跟进优先看业务员登记信息、客户原始消息、最近反馈和下一步动作。</p></details></div></section>
        </aside>
      </div>`;
  }

  function patch(){try{const d=frame.contentDocument,overlay=d?.getElementById('detailOverlay'),body=d?.getElementById('detailModalBody');if(!d||!overlay||!body||!overlay.classList.contains('open'))return;const id=currentId(body)||body.dataset.pvDetailId;if(!id)return;const c=customer(id);if(!c)return;if(body.dataset.pvDetailId===String(id)&&body.querySelector('.pv3-sticky-id'))return;render(body,c,d);}catch(_){}}
  function attach(){try{const d=frame.contentDocument,body=d?.getElementById('detailModalBody');if(!d||!body)return;if(body.dataset.pvDetailObserver!=='1'){body.dataset.pvDetailObserver='1';new MutationObserver(()=>setTimeout(patch,0)).observe(body,{childList:true,subtree:false});}patch();}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,120);setTimeout(attach,600);});setInterval(attach,700);
})();
