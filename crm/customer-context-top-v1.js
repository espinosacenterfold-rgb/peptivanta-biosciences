(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const STAGES={new:'新询盘',contacted:'已首次回复',qualifying:'需求确认中',catalog:'已发目录/资料',quoted:'已报价',negotiating:'议价中',payment:'待付款',fulfillment:'已付款/履约',repeat:'待复购/复购'};
  let queued=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const today=()=>new Date().toISOString().slice(0,10);
  const fmt=v=>{if(!v)return'未安排';try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(String(v).slice(0,10)+'T12:00:00'))}catch{return String(v)}};
  const daysSince=v=>{if(!v)return null;const a=new Date(String(v).slice(0,10)+'T12:00:00'),b=new Date();b.setHours(12,0,0,0);return Math.max(0,Math.round((b-a)/86400000));};

  function styles(d){
    if(d.getElementById('pvCustomerContextTopStyles'))return;
    const st=d.createElement('style');st.id='pvCustomerContextTopStyles';st.textContent=`
      .pv3-current-context{margin:12px 12px 0;background:#fff;border:1px solid #d9e1ec;border-radius:8px;overflow:hidden}
      .pv3-current-head{padding:9px 12px;border-bottom:1px solid #edf0f3;background:#f8faff;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .pv3-current-head h3{margin:0;font-size:13px;color:#172033}.pv3-current-head span{font-size:10px;color:#667085}
      .pv3-current-grid{display:grid;grid-template-columns:110px 90px minmax(180px,1.5fr) minmax(150px,1fr) 110px 110px;gap:0}
      .pv3-current-item{padding:10px 11px;border-right:1px solid #edf0f3;min-width:0}.pv3-current-item:last-child{border-right:0}
      .pv3-current-item small{display:block;font-size:9.5px;color:#8a94a3;margin-bottom:4px}.pv3-current-item b{display:block;font-size:11.5px;color:#273142;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pv3-current-item.feedback b,.pv3-current-item.objection b{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .pv3-current-item.due b{color:#9a5a08}.pv3-current-item.overdue b{color:#b42318}
      .pv3-side .pv3-card:first-child .pv3-info-row:nth-child(1),.pv3-side .pv3-card:first-child .pv3-info-row:nth-child(7){display:none}
      @media(max-width:1050px){.pv3-current-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.pv3-current-item{border-bottom:1px solid #edf0f3}.pv3-current-item:nth-child(3n){border-right:0}.pv3-current-item:nth-last-child(-n+3){border-bottom:0}}
      @media(max-width:620px){.pv3-current-grid{grid-template-columns:1fr 1fr}.pv3-current-item:nth-child(3n){border-right:1px solid #edf0f3}.pv3-current-item:nth-child(2n){border-right:0}.pv3-current-item:nth-last-child(-n+3){border-bottom:1px solid #edf0f3}.pv3-current-item:nth-last-child(-n+2){border-bottom:0}}
    `;d.head.appendChild(st);
  }

  function currentCustomer(d,body){
    const id=body?.dataset?.pvDetailId||body?.querySelector('[data-v9-edit-customer]')?.dataset.v9EditCustomer||body?.querySelector('[data-copy-contact]')?.dataset.copyContact;
    if(!id)return null;
    return (read().customers||[]).find(c=>String(c.id)===String(id))||null;
  }

  function render(d){
    const overlay=d.getElementById('detailOverlay'),body=d.getElementById('detailModalBody');
    if(!overlay?.classList.contains('open')||!body?.querySelector('.pv3-sticky-id'))return;
    const c=currentCustomer(d,body);if(!c)return;
    styles(d);
    const old=body.querySelector('.pv3-current-context');if(old?.dataset.customerId===String(c.id))return;old?.remove();
    const last=Array.isArray(c.timeline)&&c.timeline.length?c.timeline[0]:null;
    const feedback=last?.feedback||c.note||'暂无客户反馈记录';
    const objection=c.currentObjection&&c.currentObjection!=='未确认'?c.currentObjection:(c.risk&&c.risk!=='低'?c.risk:'未确认');
    const nextDate=String(c.nextFollowUp||'').slice(0,10),overdue=nextDate&&nextDate<today();
    const since=daysSince(c.lastContact);
    const section=d.createElement('section');section.className='pv3-current-context';section.dataset.customerId=String(c.id);
    section.innerHTML=`<div class="pv3-current-head"><h3>客户情况</h3><span>先看状态，再看登记和历史</span></div><div class="pv3-current-grid">
      <div class="pv3-current-item"><small>当前阶段</small><b>${esc(STAGES[c.stage]||c.stage||'待确认')}</b></div>
      <div class="pv3-current-item"><small>客户等级</small><b>${esc(c.grade||'B')}</b></div>
      <div class="pv3-current-item feedback"><small>最近客户反馈</small><b title="${esc(feedback)}">${esc(feedback)}</b></div>
      <div class="pv3-current-item objection"><small>当前主要阻力</small><b title="${esc(objection)}">${esc(objection)}</b></div>
      <div class="pv3-current-item ${overdue?'overdue':'due'}"><small>下次跟进</small><b>${overdue?'已逾期 · ':''}${esc(fmt(c.nextFollowUp))}</b></div>
      <div class="pv3-current-item"><small>负责人</small><b>${esc(c.owner||'未归属')}${since!==null?` · ${since}天未跟`:''}</b></div>
    </div>`;
    const sticky=body.querySelector('.pv3-sticky-id');sticky.insertAdjacentElement('afterend',section);
  }

  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;try{render(frame.contentDocument);}catch(_){}},20);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;render(d);
    const body=d.getElementById('detailModalBody');if(body&&!body.dataset.pvContextObserver){body.dataset.pvContextObserver='1';new MutationObserver(schedule).observe(body,{childList:true,subtree:true});}
  }
  frame.addEventListener('load',()=>{setTimeout(attach,120);setTimeout(attach,600);});
  setInterval(()=>{try{attach();}catch(_){}},900);
})();