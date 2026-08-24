(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  let me=null,queued=false,current=null;
  const ADMIN_ROLES=new Set(['超级管理员','一级管理员','二级管理员 / 组长']);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const nowText=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
  const isAdmin=()=>ADMIN_ROLES.has(me?.permissionGroup);
  const canEdit=(c,t)=>isAdmin()||String(t?.author||'')===String(me?.displayName||'')||String(c?.owner||'')===String(me?.displayName||'');

  async function loadMe(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(r.ok&&d.ok)me=d.user;}catch(_){}}
  function customer(state,id){return (state.customers||[]).find(c=>String(c.id)===String(id));}
  function findIndex(c,hint){
    if(!c||!Array.isArray(c.timeline))return -1;
    if(Number.isInteger(hint?.index)&&c.timeline[hint.index])return hint.index;
    return c.timeline.findIndex(t=>String(t.date||'')===String(hint?.date||'')&&String(t.content||'')===String(hint?.content||'')&&String(t.author||'')===String(hint?.author||''));
  }
  function snapshot(t){return {date:t.date||'',channel:t.channel||'',type:t.type||'',content:t.content||'',feedback:t.feedback||'',nextAction:t.nextAction||'',nextDate:t.nextDate||'',author:t.author||'',result:t.result||'',updatedAt:t.updatedAt||'',updatedBy:t.updatedBy||''};}

  function styles(d){if(d.getElementById('pvFollowEditStyles'))return;const s=d.createElement('style');s.id='pvFollowEditStyles';s.textContent=`
    .pv-follow-edit-btn,.pv-follow-versions-btn{border:1px solid #cfd8e6;background:#fff;color:#315fbd;border-radius:5px;padding:4px 8px;font-size:11px;font-weight:650;cursor:pointer}.pv-follow-edit-btn:hover,.pv-follow-versions-btn:hover{background:#f2f6fd}.pv-follow-tools{display:flex;gap:6px;align-items:center;margin-left:auto}.pv-follow-edited{font-size:10px;color:#8a94a3;margin-left:6px}
    .pv-follow-edit-overlay{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.46);display:grid;place-items:center;padding:24px}.pv-follow-edit-modal{width:min(720px,calc(100vw - 36px));max-height:88vh;overflow:auto;background:#fff;border:1px solid #d8dee7;border-radius:10px;box-shadow:0 24px 70px rgba(15,23,42,.22)}.pv-follow-edit-head{padding:14px 16px;border-bottom:1px solid #e6eaf0;display:flex;align-items:center;justify-content:space-between}.pv-follow-edit-head h3{margin:0;font-size:16px;color:#172033}.pv-follow-edit-close{border:0;background:transparent;font-size:20px;color:#667085;cursor:pointer}.pv-follow-edit-body{padding:14px 16px}.pv-follow-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.pv-follow-edit-grid label{display:block;margin:0}.pv-follow-edit-grid label.wide{grid-column:1/-1}.pv-follow-edit-grid label>span{display:block;margin-bottom:5px;font-size:11px;font-weight:700;color:#475467}.pv-follow-edit-grid input,.pv-follow-edit-grid textarea{width:100%;box-sizing:border-box;border:1px solid #cfd6df;border-radius:6px;padding:9px 10px;font:inherit;font-size:13px}.pv-follow-edit-grid textarea{min-height:86px;resize:vertical}.pv-follow-edit-meta{margin:0 0 12px;padding:9px 10px;background:#f7f9fc;border:1px solid #e2e7ef;border-radius:6px;font-size:11px;color:#667085}.pv-follow-edit-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e6eaf0}.pv-follow-edit-actions button{height:34px;padding:0 14px;border-radius:6px;border:1px solid #ccd4df;background:#fff;font-weight:650;cursor:pointer}.pv-follow-edit-actions .primary{background:#2866d7;color:#fff;border-color:#2866d7}
    .pv-version-list{display:grid;gap:9px}.pv-version{border:1px solid #e0e5ec;border-radius:7px;overflow:hidden}.pv-version-head{padding:8px 10px;background:#f7f9fc;border-bottom:1px solid #e8ecf1;display:flex;justify-content:space-between;gap:10px;font-size:11px}.pv-version-head b{color:#344054}.pv-version-head span{color:#7b8494}.pv-version-body{padding:9px 10px;display:grid;gap:6px}.pv-version-row{display:grid;grid-template-columns:82px 1fr;gap:8px;font-size:11.5px;line-height:1.5}.pv-version-row span{color:#8a94a3}.pv-version-row b{color:#344054;font-weight:500;white-space:pre-wrap;word-break:break-word}.pv-version-empty{padding:18px;text-align:center;color:#98a2b3;font-size:12px}
    .pv3-history-item{position:relative}.pv3-history-item .pv-follow-tools{margin-top:7px;justify-content:flex-end}.pv2-section-head .pv-follow-tools{margin-left:auto}.follow-row{position:relative}.follow-row .pv-follow-tools{position:absolute;right:12px;bottom:8px;z-index:2}
    @media(max-width:620px){.pv-follow-edit-grid{grid-template-columns:1fr}.pv-follow-edit-grid label.wide{grid-column:auto}}
  `;d.head.appendChild(s);}

  function ensureOverlay(d){
    let o=d.getElementById('pvFollowEditOverlay');if(o)return o;
    o=d.createElement('div');o.id='pvFollowEditOverlay';o.className='pv-follow-edit-overlay';o.style.display='none';o.innerHTML='<div class="pv-follow-edit-modal"><div class="pv-follow-edit-head"><h3 id="pvFollowEditTitle">编辑跟进</h3><button class="pv-follow-edit-close" type="button">×</button></div><div class="pv-follow-edit-body" id="pvFollowEditBody"></div><div class="pv-follow-edit-actions" id="pvFollowEditActions"></div></div>';
    d.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('.pv-follow-edit-close'))closeOverlay(d);});return o;
  }
  function closeOverlay(d){const o=d.getElementById('pvFollowEditOverlay');if(o)o.style.display='none';current=null;}

  function openEditor(d,customerId,hint){
    const state=read(),c=customer(state,customerId),idx=findIndex(c,hint);if(!c||idx<0)return;const t=c.timeline[idx];if(!canEdit(c,t))return;
    current={customerId:c.id,index:idx};const o=ensureOverlay(d),body=d.getElementById('pvFollowEditBody'),actions=d.getElementById('pvFollowEditActions');d.getElementById('pvFollowEditTitle').textContent=`编辑跟进 · ${c.name||'客户'}`;
    body.innerHTML=`<div class="pv-follow-edit-meta">原记录人：<b>${esc(t.author||'—')}</b> · 跟进日期：${esc(t.date||'—')}${t.updatedAt?` · 最近修改：${esc(t.updatedAt)} / ${esc(t.updatedBy||'—')}`:''}</div><form id="pvFollowEditForm"><div class="pv-follow-edit-grid"><label class="wide"><span>这次做了什么</span><textarea name="content" required>${esc(t.content||'')}</textarea></label><label class="wide"><span>客户反馈</span><textarea name="feedback" required>${esc(t.feedback||'')}</textarea></label><label class="wide"><span>下一步</span><input name="nextAction" value="${esc(t.nextAction||'')}" required></label><label><span>跟进日期</span><input type="date" name="date" value="${esc(t.date||'')}"></label><label><span>下次跟进</span><input type="date" name="nextDate" value="${esc(t.nextDate||'')}"></label></div></form>`;
    actions.innerHTML='<button type="button" data-pv-cancel>取消</button><button type="submit" form="pvFollowEditForm" class="primary">保存修改</button>';actions.querySelector('[data-pv-cancel]').onclick=()=>closeOverlay(d);
    body.querySelector('#pvFollowEditForm').onsubmit=e=>{e.preventDefault();saveEdit(d,new FormData(e.currentTarget));};o.style.display='grid';
  }

  function saveEdit(d,fd){
    if(!current)return;const state=read(),c=customer(state,current.customerId),idx=findIndex(c,{index:current.index});if(!c||idx<0)return;const t=c.timeline[idx];if(!canEdit(c,t))return;
    const old=snapshot(t),versions=Array.isArray(t.versions)?t.versions.slice():[];versions.unshift({...old,archivedAt:nowText(),archivedBy:me?.displayName||me?.username||'未知'});t.versions=versions.slice(0,3);
    t.content=String(fd.get('content')||'').trim();t.feedback=String(fd.get('feedback')||'').trim();t.nextAction=String(fd.get('nextAction')||'').trim();t.date=String(fd.get('date')||t.date||'');t.nextDate=String(fd.get('nextDate')||'');t.updatedAt=nowText();t.updatedBy=me?.displayName||me?.username||'未知';t.editCount=Number(t.editCount||0)+1;
    c.timeline.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));if(c.timeline[0]){c.lastContact=c.timeline[0].date||c.lastContact;if(c.timeline[0].nextDate)c.nextFollowUp=c.timeline[0].nextDate;}
    write(state);closeOverlay(d);
    const toast=d.getElementById('toast');if(toast){toast.textContent='跟进已修改，旧版本已保留';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);}
    setTimeout(()=>{try{frame.contentWindow.location.reload();}catch{}},850);
  }

  function openVersions(d,customerId,hint){
    if(!isAdmin())return;const state=read(),c=customer(state,customerId),idx=findIndex(c,hint);if(!c||idx<0)return;const t=c.timeline[idx],versions=(t.versions||[]).slice(0,3),o=ensureOverlay(d),body=d.getElementById('pvFollowEditBody'),actions=d.getElementById('pvFollowEditActions');d.getElementById('pvFollowEditTitle').textContent=`修改记录 · ${c.name||'客户'}`;
    body.innerHTML=versions.length?`<div class="pv-version-list">${versions.map((v,i)=>`<section class="pv-version"><div class="pv-version-head"><b>历史版本 ${i+1}</b><span>${esc(v.archivedAt||'—')} · 修改人 ${esc(v.archivedBy||'—')}</span></div><div class="pv-version-body"><div class="pv-version-row"><span>做了什么</span><b>${esc(v.content||'—')}</b></div><div class="pv-version-row"><span>客户反馈</span><b>${esc(v.feedback||'—')}</b></div><div class="pv-version-row"><span>下一步</span><b>${esc(v.nextAction||'—')}</b></div><div class="pv-version-row"><span>跟进日期</span><b>${esc(v.date||'—')}</b></div><div class="pv-version-row"><span>下次跟进</span><b>${esc(v.nextDate||'—')}</b></div></div></section>`).join('')}</div>`:'<div class="pv-version-empty">这条跟进还没有修改记录。</div>';
    actions.innerHTML='<button type="button" data-pv-cancel>关闭</button>';actions.querySelector('[data-pv-cancel]').onclick=()=>closeOverlay(d);o.style.display='grid';
  }

  function tools(d,c,t,index){
    const box=d.createElement('div');box.className='pv-follow-tools';
    if(canEdit(c,t)){const b=d.createElement('button');b.type='button';b.className='pv-follow-edit-btn';b.textContent='编辑';b.dataset.pvEditFollow=c.id;b.dataset.pvIndex=String(index);box.appendChild(b);}
    if(isAdmin()){const v=d.createElement('button');v.type='button';v.className='pv-follow-versions-btn';v.textContent=`版本${(t.versions||[]).length?` ${(t.versions||[]).length}`:''}`;v.dataset.pvVersionsFollow=c.id;v.dataset.pvIndex=String(index);box.appendChild(v);}
    if(t.updatedAt){const e=d.createElement('span');e.className='pv-follow-edited';e.textContent='已编辑';box.appendChild(e);}return box;
  }

  function decorateWorkbench(d){
    const state=read(),active=d.querySelector('#customerPool .pool-card.active'),id=active?.dataset.selectCustomer||active?.dataset.detailCustomer;if(!id)return;const c=customer(state,id),t=c?.timeline?.[0];if(!c||!t)return;
    const sections=[...d.querySelectorAll('#customerWorkspace .pv2-section')];const sec=sections.find(x=>x.querySelector('.pv2-section-head h3')?.textContent?.includes('最近一次跟进'));const head=sec?.querySelector('.pv2-section-head');if(head&&!head.querySelector('.pv-follow-tools'))head.appendChild(tools(d,c,t,0));
  }
  function decorateDetail(d){
    const state=read(),body=d.getElementById('detailModalBody');if(!body)return;const id=body.dataset.pvDetailId||body.querySelector('[data-copy-contact]')?.dataset.copyContact;if(!id)return;const c=customer(state,id);if(!c)return;
    const recent=[...body.querySelectorAll('.pv3-card')].find(x=>x.querySelector('.pv3-card-head h3')?.textContent?.includes('最近一次跟进'));const recentHead=recent?.querySelector('.pv3-card-head');if(recentHead&&c.timeline?.[0]&&!recentHead.querySelector('.pv-follow-tools'))recentHead.appendChild(tools(d,c,c.timeline[0],0));
    body.querySelectorAll('.pv3-history-item').forEach((item,i)=>{if(c.timeline?.[i]&&!item.querySelector('.pv-follow-tools'))item.appendChild(tools(d,c,c.timeline[i],i));});
  }
  function decorateLog(d){
    const state=read();d.querySelectorAll('#followupLog .follow-row').forEach(row=>{if(row.querySelector('.pv-follow-tools'))return;const id=row.dataset.openListDetail,c=customer(state,id);if(!c)return;const content=(row.querySelector('.follow-body strong')?.textContent||'').replace(/^具体跟进：/,'').trim();const idx=(c.timeline||[]).findIndex(t=>String(t.content||'').trim()===content);if(idx>=0)row.appendChild(tools(d,c,c.timeline[idx],idx));});
  }
  function decorate(){try{const d=frame.contentDocument;if(!d)return;styles(d);ensureOverlay(d);decorateWorkbench(d);decorateDetail(d);decorateLog(d);}catch(_){}}
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;decorate();},50);}
  function attach(){const d=frame.contentDocument;if(!d)return;decorate();if(!d.documentElement.dataset.pvFollowEditObs){d.documentElement.dataset.pvFollowEditObs='1';new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});d.addEventListener('click',e=>{const eb=e.target.closest('[data-pv-edit-follow]');if(eb){e.preventDefault();e.stopPropagation();openEditor(d,eb.dataset.pvEditFollow,{index:Number(eb.dataset.pvIndex)});return;}const vb=e.target.closest('[data-pv-versions-follow]');if(vb){e.preventDefault();e.stopPropagation();openVersions(d,vb.dataset.pvVersionsFollow,{index:Number(vb.dataset.pvIndex)});}},true);}}
  frame.addEventListener('load',()=>{setTimeout(attach,140);setTimeout(attach,700);});loadMe().then(()=>setTimeout(attach,80));setInterval(()=>{try{decorate();}catch(_){}},1600);
})();
