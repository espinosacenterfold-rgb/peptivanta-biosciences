(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  const PENDING_FOLLOW='pv-customer-v3-follow';
  let me=null;

  const TAG_GROUPS=[
    ['采购特征',['批量采购','长期采购','试单/小批量','复购潜力','急单']],
    ['重点关注',['价格敏感','MOQ关注','COA关注','HPLC/MS关注','物流敏感','付款方式关注']],
    ['客户背景',['科研用途','经销/转售','机构采购','品牌/OEM','定制需求','样品评估']]
  ];
  const COUNTRY_CODES=[
    ['+52','Mexico'],['+61','Australia'],['+44','United Kingdom'],['+49','Germany'],['+33','France'],['+39','Italy'],['+34','Spain'],['+31','Netherlands'],['+48','Poland'],['+351','Portugal'],['+353','Ireland'],['+41','Switzerland'],['+43','Austria'],['+32','Belgium'],['+45','Denmark'],['+46','Sweden'],['+47','Norway'],['+358','Finland'],['+30','Greece'],['+420','Czech Republic'],['+40','Romania'],['+81','Japan'],['+82','South Korea'],['+64','New Zealand']
  ].sort((a,b)=>b[0].length-a[0].length);

  const readState=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const splitTags=v=>[...new Set(String(v||'').split(/[,，;；]/).map(x=>x.trim()).filter(Boolean))];
  const pad=n=>String(n).padStart(2,'0');
  const localDateTimeValue=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dbId=a=>Number(a?.dbId||String(a?.id||'').replace('U-',''))||null;

  async function loadMe(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(r.ok&&d.ok)me=d.user;}catch(_){}}
  function activeAccounts(){return (readState().accounts||[]).filter(a=>a.status==='正常');}
  function eligibleAccounts(){
    const all=activeAccounts();
    if(!me)return all;
    if(me.permissionGroup==='普通销售')return all.filter(a=>a.login===me.username||a.displayName===me.displayName);
    if(me.permissionGroup==='二级管理员 / 组长')return all.filter(a=>a.team===me.team&&['普通销售','二级管理员 / 组长'].includes(a.permissionGroup));
    if(me.permissionGroup==='一级管理员')return all.filter(a=>(me.managedTeams||[]).includes(a.team)&&['普通销售','二级管理员 / 组长'].includes(a.permissionGroup));
    return all.filter(a=>a.permissionGroup!=='超级管理员');
  }
  function findAccount(name){return activeAccounts().find(a=>a.displayName===name);}

  function styles(d){
    if(d.getElementById('pvCustomerRegistrationV3Styles'))return;
    const st=d.createElement('style');st.id='pvCustomerRegistrationV3Styles';st.textContent=`
      #customerModal.modal-wide{width:min(860px,calc(100vw - 36px));max-height:90vh;overflow:auto}
      #customerForm{padding-top:10px}
      #customerForm>.form-grid{display:block}
      .pv-reg-section{border:1px solid #e0e5ec;border-radius:8px;background:#fff;margin-bottom:11px;overflow:hidden}
      .pv-reg-head{padding:10px 13px;border-bottom:1px solid #edf0f3;background:#fafbfc;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .pv-reg-head strong{font-size:13px;color:#101828}.pv-reg-head span{font-size:11px;color:#667085}
      .pv-reg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 12px;padding:12px 13px}
      .pv-reg-grid>label{margin:0}.pv-reg-grid>label.span-2{grid-column:1/-1}
      .pv-reg-grid input,.pv-reg-grid select,.pv-reg-grid textarea{width:100%}
      .pv-reg-note{display:block;margin-top:4px;color:#667085;font-size:10.5px;line-height:1.45}
      .pv-reg-derived{background:#f4f6f8!important;color:#475467!important;pointer-events:none}
      .pv-owner-summary{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px;padding:8px 10px;background:#f7f9fc;border:1px solid #dce4ef;border-radius:6px;font-size:11px;color:#475467}
      .pv-owner-summary b{color:#101828}.pv-owner-summary span{white-space:nowrap}
      .pv-reg-more{border:1px solid #e0e5ec;border-radius:8px;background:#fff;margin-bottom:10px;overflow:hidden}
      .pv-reg-more>summary{list-style:none;cursor:pointer;padding:11px 13px;font-size:12px;font-weight:700;color:#344054;background:#fafbfc;display:flex;justify-content:space-between;gap:10px}
      .pv-reg-more>summary::-webkit-details-marker{display:none}.pv-reg-more>summary::after{content:'展开';font-size:10.5px;color:#667085;font-weight:500}.pv-reg-more[open]>summary::after{content:'收起'}
      .pv-grade-note{font-size:10.5px;color:#667085;margin-top:4px;line-height:1.45}
      .pv-tag-presets-v3{margin-top:6px;padding:8px;border:1px solid #e4e7ec;background:#fafbfc;border-radius:6px}
      .pv-tag-row-v3{display:grid;grid-template-columns:62px 1fr;gap:6px;margin:5px 0}.pv-tag-row-v3:first-child{margin-top:0}.pv-tag-row-v3:last-child{margin-bottom:0}
      .pv-tag-title-v3{font-size:10.5px;font-weight:700;color:#667085;line-height:25px}.pv-tag-options-v3{display:flex;flex-wrap:wrap;gap:5px}
      .pv-tag-v3{height:25px;padding:0 8px;border:1px solid #d5dbe3;background:#fff;color:#475467;border-radius:13px;font-size:10.5px;cursor:pointer}
      .pv-tag-v3.active{border-color:#4e79c8;background:#edf3ff;color:#234f9a;font-weight:600}
      .pv-duplicate{display:none;margin-top:5px;padding:7px 9px;border-left:3px solid #d92d20;background:#fff4f3;color:#7a271a;font-size:10.5px;line-height:1.45}
      .pv-duplicate.show{display:block}
      .pv-country-hint{display:none;margin-top:4px;font-size:10.5px;color:#315fbd;cursor:pointer}.pv-country-hint.show{display:inline-block}
      .pv-hidden-field{display:none!important}
      #customerForm .modal-actions{position:sticky;bottom:0;background:#fff;margin:8px -20px -20px;padding:12px 20px;border-top:1px solid #e4e7ec;z-index:3}
      #pvSaveFollowBtn{border-color:#adc2e6;color:#254f95;background:#f5f8ff}
      @media(max-width:700px){.pv-reg-grid{grid-template-columns:1fr}.pv-reg-grid>label.span-2{grid-column:auto}.pv-tag-row-v3{grid-template-columns:1fr}.pv-tag-title-v3{line-height:18px}}
    `;d.head.appendChild(st);
  }

  function labelFor(form,name){return form.elements.namedItem(name)?.closest('label')||null;}
  function ensureLeadField(d,form){
    let input=form.elements.namedItem('leadAt');if(input)return input;
    const label=d.createElement('label');label.dataset.pvField='leadAt';label.innerHTML='<span>进粉时间</span><input name="leadAt" type="datetime-local"><small class="pv-reg-note">客户真正进入 WhatsApp / 广告线索的时间。</small>';
    form.querySelector('.form-grid')?.appendChild(label);return label.querySelector('input');
  }
  function ensureWaField(d,form){
    let sel=form.elements.namedItem('sourceWhatsapp');if(sel)return sel;
    const label=d.createElement('label');label.dataset.pvField='sourceWhatsapp';label.innerHTML='<span>来源 WhatsApp</span><select name="sourceWhatsapp"><option value="—">—</option></select><small class="pv-reg-note">只显示当前负责人已绑定的 WhatsApp。</small>';
    form.querySelector('.form-grid')?.appendChild(label);return label.querySelector('select');
  }

  function addPendingOption(select){
    if(!select)return;
    if(![...select.options].some(o=>o.value==='待确认'))select.insertAdjacentHTML('afterbegin','<option value="待确认">待确认</option>');
  }

  function buildLayout(d,form){
    if(form.dataset.registrationV3Layout==='1')return;
    form.dataset.registrationV3Layout='1';
    styles(d);ensureLeadField(d,form);ensureWaField(d,form);
    const grid=form.querySelector('.form-grid');if(!grid)return;

    const name=form.elements.namedItem('name'),country=form.elements.namedItem('country'),product=form.elements.namedItem('product'),contact=form.elements.namedItem('contact');
    if(name){name.required=false;name.placeholder='WhatsApp名称、客户姓名或备注名';}
    if(country){country.required=false;country.placeholder='不知道可先留空';}
    if(product){product.required=false;product.placeholder='不知道可先留空';}
    if(contact)contact.placeholder='建议填写，便于查重';
    const type=form.elements.namedItem('customerType'),grade=form.elements.namedItem('grade');addPendingOption(type);
    if(type&&type.value==='个人客户')type.value='待确认';
    if(grade)grade.value='B';

    const quick=d.createElement('section');quick.className='pv-reg-section';quick.innerHTML='<div class="pv-reg-head"><strong>快速建档</strong><span>先把线索收进来，其他资料可以后补</span></div><div class="pv-reg-grid" data-pv-quick></div>';
    const quickGrid=quick.querySelector('[data-pv-quick]');
    ['name','contact','country','product','source','leadAt','firstMessage'].forEach(n=>{const l=labelFor(form,n);if(l)quickGrid.appendChild(l);});

    const ownership=d.createElement('section');ownership.className='pv-reg-section';ownership.innerHTML='<div class="pv-reg-head"><strong>客户归属</strong><span>负责人决定销售组和可用 WhatsApp</span></div><div class="pv-reg-grid" data-pv-owner><div class="pv-owner-summary" id="pvOwnerSummary"></div></div>';
    const ownerGrid=ownership.querySelector('[data-pv-owner]');
    ['owner','team','sourceWhatsapp'].forEach(n=>{const l=labelFor(form,n);if(l)ownerGrid.insertBefore(l,ownerGrid.querySelector('#pvOwnerSummary'));});
    const teamLabel=labelFor(form,'team');if(teamLabel)teamLabel.classList.add('pv-hidden-field');

    const more=d.createElement('details');more.className='pv-reg-more';more.innerHTML='<summary><span>补充客户资料</span><span>公司 / 类型 / 等级 / 金额 / 标签 / 备注</span></summary><div class="pv-reg-grid" data-pv-more></div>';
    const moreGrid=more.querySelector('[data-pv-more]');
    ['company','customerType','grade','value','traits','note'].forEach(n=>{const l=labelFor(form,n);if(l)moreGrid.appendChild(l);});

    grid.appendChild(quick);grid.appendChild(ownership);grid.appendChild(more);
    const gradeLabel=labelFor(form,'grade');if(gradeLabel&&!gradeLabel.querySelector('.pv-grade-note'))gradeLabel.insertAdjacentHTML('beforeend','<small class="pv-grade-note">S 核心 · A 重点 · B 正常 · C 低频 · D 无效。新客户默认 B，可后续再调整。</small>');
    installTagPresets(d,form);
    installDuplicateCheck(d,form);
    setupActions(d,form);
  }

  function installTagPresets(d,form){
    const input=form.elements.namedItem('traits'),label=input?.closest('label');if(!input||!label||label.querySelector('#pvTagPresetsV3'))return;
    input.placeholder='还可以手动补充，用逗号分隔';
    const box=d.createElement('div');box.id='pvTagPresetsV3';box.className='pv-tag-presets-v3';
    box.innerHTML=TAG_GROUPS.map(([g,tags])=>`<div class="pv-tag-row-v3"><div class="pv-tag-title-v3">${g}</div><div class="pv-tag-options-v3">${tags.map(t=>`<button type="button" class="pv-tag-v3" data-pv-tag="${t}">${t}</button>`).join('')}</div></div>`).join('');
    input.parentNode.insertBefore(box,input);
    const sync=()=>{const set=new Set(splitTags(input.value));box.querySelectorAll('[data-pv-tag]').forEach(b=>b.classList.toggle('active',set.has(b.dataset.pvTag)));};
    box.onclick=e=>{const b=e.target.closest('[data-pv-tag]');if(!b)return;const arr=splitTags(input.value),i=arr.indexOf(b.dataset.pvTag);if(i>=0)arr.splice(i,1);else arr.push(b.dataset.pvTag);input.value=arr.join(', ');input.dispatchEvent(new Event('input',{bubbles:true}));sync();};
    input.addEventListener('input',sync);form.addEventListener('reset',()=>setTimeout(sync,0));sync();
  }

  function normalizedContact(v){return String(v||'').trim().toLowerCase();}
  function digits(v){return String(v||'').replace(/\D/g,'');}
  function findDuplicate(value){
    const raw=normalizedContact(value),ds=digits(value);if(!raw)return null;
    return (readState().customers||[]).find(c=>{
      const cr=normalizedContact(c.contact),cd=digits(c.contact);
      return (ds.length>=6&&cd===ds)||(!ds&&cr===raw);
    })||null;
  }
  function inferCountry(value){const s=String(value||'').replace(/[\s()-]/g,'');for(const [code,country] of COUNTRY_CODES)if(s.startsWith(code))return country;return'';}
  function installDuplicateCheck(d,form){
    const input=form.elements.namedItem('contact'),label=input?.closest('label');if(!input||!label)return;
    let warn=label.querySelector('#pvDuplicateWarn');if(!warn){warn=d.createElement('div');warn.id='pvDuplicateWarn';warn.className='pv-duplicate';label.appendChild(warn);}
    let countryHint=label.querySelector('#pvCountryHint');if(!countryHint){countryHint=d.createElement('button');countryHint.type='button';countryHint.id='pvCountryHint';countryHint.className='pv-country-hint';label.appendChild(countryHint);}
    const check=()=>{
      const dup=findDuplicate(input.value);warn.classList.toggle('show',!!dup);warn.innerHTML=dup?`已存在相同联系方式：<b>${esc(dup.name)}</b> · 负责人 ${esc(dup.owner||'—')}。建议先打开原客户，不要重复建档。`:'';
      const country=form.elements.namedItem('country'),guess=country&&!country.value.trim()?inferCountry(input.value):'';countryHint.classList.toggle('show',!!guess);countryHint.textContent=guess?`识别到国家：${guess}，点击填入`:'';countryHint.onclick=()=>{if(country&&guess){country.value=guess;countryHint.classList.remove('show');}};
    };
    input.addEventListener('input',check);input.addEventListener('blur',check);check();
  }

  function populateOwnership(d,form){
    const owner=form.elements.namedItem('owner'),team=form.elements.namedItem('team'),wa=form.elements.namedItem('sourceWhatsapp');if(!owner||!team||!wa)return;
    const choices=eligibleAccounts(),current=owner.value,allowUnowned=me&&['一级管理员','超级管理员'].includes(me.permissionGroup);
    owner.innerHTML=choices.map(a=>`<option value="${esc(a.displayName)}">${esc(a.displayName)}${a.team&&a.team!=='—'?` · ${esc(a.team)}`:''}</option>`).join('')+(allowUnowned?'<option value="未归属">未归属</option>':'');
    const selfAllowed=choices.some(a=>a.displayName===me?.displayName);let preferred='';
    if(choices.some(a=>a.displayName===current)||current==='未归属'&&allowUnowned)preferred=current;
    else if((me?.permissionGroup==='普通销售'||me?.permissionGroup==='二级管理员 / 组长')&&selfAllowed)preferred=me.displayName;
    else preferred=choices[0]?.displayName||(allowUnowned?'未归属':'');
    owner.value=preferred;
    if(me?.permissionGroup==='普通销售'){owner.classList.add('pv-reg-derived');owner.tabIndex=-1;}else{owner.classList.remove('pv-reg-derived');owner.tabIndex=0;}
    updateDerived(form);
    if(!owner.dataset.pvV3OwnerBound){owner.dataset.pvV3OwnerBound='1';owner.addEventListener('change',()=>updateDerived(form));}
  }

  function updateDerived(form){
    const owner=form.elements.namedItem('owner'),team=form.elements.namedItem('team'),wa=form.elements.namedItem('sourceWhatsapp'),summary=form.querySelector('#pvOwnerSummary');if(!owner||!team||!wa)return;
    const a=findAccount(owner.value);
    if(!a){team.value='—';wa.innerHTML='<option value="—">—</option>';if(summary)summary.innerHTML='<span><b>未归属</b></span><span>由管理员后续分配负责人</span>';return;}
    team.value=a.team&&a.team!=='—'?a.team:'—';
    const list=Array.isArray(a.whatsappAccounts)?a.whatsappAccounts:[];const old=wa.value;
    wa.innerHTML=list.length?list.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''):'<option value="—">—</option>';
    if([...wa.options].some(o=>o.value===old))wa.value=old;
    if(summary)summary.innerHTML=`<span>负责人：<b>${esc(a.displayName)}</b></span><span>销售组：<b>${esc(team.value)}</b></span><span>WhatsApp：<b>${esc(wa.value||'—')}</b></span>${me?.permissionGroup==='二级管理员 / 组长'&&a.displayName===me.displayName?'<span>组长本人客户，组员不可见</span>':''}`;
    if(!wa.dataset.pvV3WaBound){wa.dataset.pvV3WaBound='1';wa.addEventListener('change',()=>updateDerived(form));}
  }

  function setupActions(d,form){
    const actions=form.querySelector('.modal-actions'),normal=actions?.querySelector('button.primary');if(!actions||!normal)return;
    normal.textContent='保存客户';normal.onclick=()=>{form.dataset.afterSave='save';};
    if(!d.getElementById('pvSaveFollowBtn')){const b=d.createElement('button');b.type='submit';b.id='pvSaveFollowBtn';b.className='button secondary';b.textContent='保存并跟进';b.onclick=()=>{form.dataset.afterSave='follow';};actions.insertBefore(b,normal);}
  }

  function resetDefaults(form){
    const lead=form.elements.namedItem('leadAt');if(lead&&!lead.value)lead.value=localDateTimeValue();
    const type=form.elements.namedItem('customerType');if(type&&!type.value)type.value='待确认';
    const grade=form.elements.namedItem('grade');if(grade&&!grade.value)grade.value='B';
    form.dataset.afterSave='save';
  }

  function prepareSubmit(e,form){
    const name=form.elements.namedItem('name'),contact=form.elements.namedItem('contact'),country=form.elements.namedItem('country'),product=form.elements.namedItem('product'),type=form.elements.namedItem('customerType'),grade=form.elements.namedItem('grade'),lead=form.elements.namedItem('leadAt');
    if(!String(name?.value||'').trim()&&!String(contact?.value||'').trim()){
      e.preventDefault();e.stopImmediatePropagation();alert('客户名称和 WhatsApp / 联系方式至少填写一项。');name?.focus();return null;
    }
    if(name&&!name.value.trim())name.value=contact.value.trim()||'未命名客户';
    if(country&&!country.value.trim())country.value=inferCountry(contact?.value)||'待确认';
    if(product&&!product.value.trim())product.value='待确认';
    if(type&&!type.value)type.value='待确认';
    if(grade&&!grade.value)grade.value='B';
    if(lead&&!lead.value)lead.value=localDateTimeValue();
    updateDerived(form);
    const state=readState(),beforeIds=new Set((state.customers||[]).map(c=>c.id));
    return {beforeIds,leadAt:lead?.value||localDateTimeValue(),owner:form.elements.namedItem('owner')?.value||'',sourceWhatsapp:form.elements.namedItem('sourceWhatsapp')?.value||'—',mode:form.dataset.afterSave||'save'};
  }

  function patchSaved(meta){
    try{
      const state=readState(),list=Array.isArray(state.customers)?state.customers:[],c=list.find(x=>!meta.beforeIds.has(x.id));if(!c)return null;
      const a=findAccount(meta.owner),leadAt=meta.leadAt,leadDate=leadAt.slice(0,10);
      c.leadAt=leadAt;c.leadDate=leadDate;c.recordCreatedAt=c.recordCreatedAt||new Date().toISOString();
      c.createdByUserId=Number(me?.id||0)||c.createdByUserId||null;c.createdBy=me?.displayName||c.createdBy||'';
      if(a){c.owner=a.displayName;c.ownerUserId=dbId(a);c.team=a.team||'—';c.whatsapp=meta.sourceWhatsapp||'—';}else{c.owner='未归属';c.ownerUserId=null;c.team='—';c.whatsapp='—';}
      if(!Array.isArray(c.timeline)||c.timeline.length===0){c.lastContact=leadDate;c.nextFollowUp=leadDate;}
      else if(c.timeline.length===1&&c.timeline[0]?.type==='首次咨询'&&c.timeline[0]?.feedback==='待业务员首次回复'){c.timeline[0].date=leadDate;c.timeline[0].nextDate=leadDate;c.timeline[0].author=c.owner;c.lastContact=leadDate;c.nextFollowUp=leadDate;}
      localStorage.setItem(KEY,JSON.stringify(state));
      return c.id;
    }catch(_){return null;}
  }

  function maybeOpenFollow(d){
    const id=sessionStorage.getItem(PENDING_FOLLOW);if(!id)return;sessionStorage.removeItem(PENDING_FOLLOW);
    setTimeout(()=>{const btn=d.getElementById('quickFollowBtn');if(!btn)return;btn.click();setTimeout(()=>{const sel=d.getElementById('followCustomerSelect');if(sel)sel.value=id;const c=(readState().customers||[]).find(x=>x.id===id),author=d.getElementById('followAuthorSelect');if(author&&c&&[...author.options].some(o=>o.value===c.owner))author.value=c.owner;},40);},100);
  }

  function install(d){
    const form=d?.getElementById('customerForm');if(!form)return;
    buildLayout(d,form);populateOwnership(d,form);resetDefaults(form);maybeOpenFollow(d);
    if(d.documentElement.dataset.customerRegistrationV3==='1')return;d.documentElement.dataset.customerRegistrationV3='1';
    d.addEventListener('click',e=>{if(e.target.closest('#addCustomerBtn'))setTimeout(()=>{resetDefaults(form);const owner=form.elements.namedItem('owner');if(owner&&me&&['普通销售','二级管理员 / 组长'].includes(me.permissionGroup))owner.value=me.displayName;populateOwnership(d,form);},20);},true);
    d.addEventListener('submit',e=>{
      if(e.target!==form)return;
      const meta=prepareSubmit(e,form);if(!meta)return;
      setTimeout(()=>{const id=patchSaved(meta);if(!id)return;if(meta.mode==='follow')sessionStorage.setItem(PENDING_FOLLOW,id);try{frame.contentWindow.location.reload();}catch(_){}},170);
    },true);
  }

  function attach(){try{install(frame.contentDocument);}catch(_){}}
  loadMe();
  frame.addEventListener('load',()=>{loadMe().then(()=>{setTimeout(attach,80);setTimeout(attach,450);});});
  setInterval(attach,1600);
})();
