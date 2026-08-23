(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  const KEY='peptivanta-crm-v2';
  let pendingNew=null;

  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=x=>localStorage.setItem(KEY,JSON.stringify(x));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const dtValue=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const split=v=>[...new Set(String(v||'').split(/[,，;；]/).map(x=>x.trim()).filter(Boolean))];
  const customer=id=>(read().customers||[]).find(c=>String(c.id)===String(id));

  const options=(list,current)=>list.map(x=>`<option value="${esc(x)}" ${String(x)===String(current)?'selected':''}>${esc(x)}</option>`).join('');
  const CONTACT_ROLES=['待确认','本人 / 个人买家','采购负责人','公司负责人 / 老板','合伙人','科研 / 技术人员','经销 / 销售人员','其他'];
  const LANGUAGES=['待确认','English','Español','Português','Français','Deutsch','Italiano','中文','其他'];
  const PURPOSES=['待确认','个人需求','科研 / 实验','经销 / 转售','机构采购','品牌 / OEM','样品 / 测试','其他'];
  const OBJECTIONS=['未确认','无明显阻力','价格','MOQ / 数量','规格 / 库存','COA / 检测文件','物流 / 时效','付款方式','竞争供应商','等待内部确认','其他'];
  const TYPES=['待确认','个人客户','经销商','零售商','机构采购','科研客户','品牌方','OEM/定制','其他'];
  const GRADES=['S','A','B','C','D'];
  const RISKS=['低','待确认','高','黑名单'];

  function styles(d){
    if(d.getElementById('pvProfileV1Styles'))return;
    const st=d.createElement('style');st.id='pvProfileV1Styles';st.textContent=`
      .pv-profile-extra-title{grid-column:1/-1;font-size:11px;font-weight:700;color:#475467;margin:4px 0 -2px;padding-top:6px;border-top:1px dashed #e4e7ec}
      .pv-lead-shortcuts{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.pv-lead-shortcuts button{height:24px;padding:0 7px;border:1px solid #d5dbe3;background:#fff;border-radius:4px;font-size:10px;color:#475467;cursor:pointer}.pv-lead-shortcuts button:hover{background:#f5f8fd;border-color:#a9bddf}
      .pv-profile-mask{position:fixed;inset:0;z-index:9900;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;padding:18px}.pv-profile-mask.open{display:flex}.pv-profile-modal{width:min(900px,calc(100vw - 30px));max-height:92vh;overflow:auto;background:#fff;border:1px solid #d0d5dd;border-radius:9px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
      .pv-profile-head{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid #e4e7ec;padding:14px 17px;display:flex;align-items:center;justify-content:space-between}.pv-profile-head h3{margin:0;font-size:16px}.pv-profile-close{border:0;background:transparent;font-size:22px;color:#667085;cursor:pointer}
      .pv-profile-body{padding:15px 17px}.pv-profile-section{border:1px solid #e1e5eb;border-radius:7px;margin-bottom:11px;overflow:hidden}.pv-profile-section>strong{display:block;padding:9px 11px;background:#fafbfc;border-bottom:1px solid #edf0f3;font-size:12px;color:#344054}.pv-profile-grid{padding:11px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pv-profile-grid label{display:block}.pv-profile-grid label.wide{grid-column:1/-1}.pv-profile-grid label.span2{grid-column:span 2}.pv-profile-grid span{display:block;font-size:10.5px;font-weight:600;color:#667085;margin-bottom:4px}.pv-profile-grid input,.pv-profile-grid select,.pv-profile-grid textarea{width:100%;box-sizing:border-box;border:1px solid #cfd5dc;border-radius:5px;padding:8px 9px;background:#fff;color:#1d2939;font:inherit;font-size:12px}.pv-profile-grid textarea{resize:vertical}.pv-profile-readonly{background:#f5f6f8!important;color:#667085!important}.pv-profile-note{display:block!important;font-size:10px!important;font-weight:400!important;color:#98a2b3!important;margin-top:4px!important;line-height:1.4}.pv-profile-actions{position:sticky;bottom:0;background:#fff;border-top:1px solid #e4e7ec;padding:11px 17px;display:flex;justify-content:flex-end;gap:8px}.pv-profile-error{margin-right:auto;color:#b42318;font-size:11px;align-self:center}
      .pv3-profile-extra{display:contents}
      @media(max-width:760px){.pv-profile-grid{grid-template-columns:1fr 1fr}.pv-profile-grid label.wide{grid-column:1/-1}.pv-profile-grid label.span2{grid-column:auto}}@media(max-width:520px){.pv-profile-grid{grid-template-columns:1fr}.pv-profile-grid label.wide,.pv-profile-grid label.span2{grid-column:auto}}
    `;d.head.appendChild(st);
  }

  function ensureRegField(d,grid,name,label,html){
    let el=grid.querySelector(`[data-pv-profile-field="${name}"]`);if(el)return el;
    el=d.createElement('label');el.dataset.pvProfileField=name;el.innerHTML=`<span>${label}</span>${html}`;grid.appendChild(el);return el;
  }

  function patchRegistration(d){
    const form=d.getElementById('customerForm');if(!form)return;
    styles(d);
    const more=form.querySelector('[data-pv-more]');if(!more)return;
    const value=form.elements.namedItem('value');if(value?.closest('label'))value.closest('label').style.display='none';
    if(value)value.value='0';

    const country=form.elements.namedItem('country');const countryTitle=country?.closest('label')?.querySelector(':scope > span');if(countryTitle)countryTitle.textContent='客户所在国家 / 地区';
    const product=form.elements.namedItem('product');const productTitle=product?.closest('label')?.querySelector(':scope > span');if(productTitle)productTitle.textContent='主要产品 / 需求';

    if(!more.querySelector('.pv-profile-extra-title')){const t=d.createElement('div');t.className='pv-profile-extra-title';t.textContent='可选业务资料 · 有信息就填，没有可以以后补';more.appendChild(t);}
    ensureRegField(d,more,'contactRole','联系人身份',`<select name="contactRole">${options(CONTACT_ROLES,'待确认')}</select>`);
    ensureRegField(d,more,'language','沟通语言',`<select name="language">${options(LANGUAGES,'待确认')}</select>`);
    ensureRegField(d,more,'destinationCountry','收货国家 / 地区','<input name="destinationCountry" placeholder="与客户所在国家不同时再填写">');
    const demand=ensureRegField(d,more,'demandDetail','需求规格 / 数量','<textarea name="demandDetail" rows="2" placeholder="例：Retatrutide 20mg × 10盒；另询 Tirzepatide 10mg"></textarea>');demand.classList.add('span-2');
    ensureRegField(d,more,'purchasePurpose','采购用途',`<select name="purchasePurpose">${options(PURPOSES,'待确认')}</select>`);
    ensureRegField(d,more,'currentObjection','当前主要阻力',`<select name="currentObjection">${options(OBJECTIONS,'未确认')}</select>`);
    const source=ensureRegField(d,more,'sourceDetail','来源渠道详情','<input name="sourceDetail" placeholder="广告名、主页、转介绍人或其他来源备注">');source.classList.add('span-2');

    const lead=form.elements.namedItem('leadAt'),leadLabel=lead?.closest('label');if(leadLabel){
      const note=leadLabel.querySelector('.pv-reg-note');if(note)note.textContent='填写客户真正进粉时间；可以回填过去日期。CRM 建档时间由系统自动记录。';
      if(!leadLabel.querySelector('.pv-lead-shortcuts')){const bar=d.createElement('div');bar.className='pv-lead-shortcuts';[['现在',0],['昨天',1],['3天前',3],['7天前',7]].forEach(([text,days])=>{const b=d.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{const x=new Date();x.setDate(x.getDate()-days);lead.value=dtValue(x);};bar.appendChild(b);});leadLabel.appendChild(bar);}
    }
  }

  function captureNew(form){
    const state=read(),before=new Set((state.customers||[]).map(c=>c.id)),fd=new frame.contentWindow.FormData(form);
    pendingNew={before,data:{contactRole:String(fd.get('contactRole')||'待确认'),language:String(fd.get('language')||'待确认'),destinationCountry:String(fd.get('destinationCountry')||''),demandDetail:String(fd.get('demandDetail')||''),purchasePurpose:String(fd.get('purchasePurpose')||'待确认'),currentObjection:String(fd.get('currentObjection')||'未确认'),sourceDetail:String(fd.get('sourceDetail')||'')}};
    if(form.elements.namedItem('value'))form.elements.namedItem('value').value='0';
    setTimeout(patchNewCustomer,90);
  }
  function patchNewCustomer(){
    if(!pendingNew)return;const state=read(),c=(state.customers||[]).find(x=>!pendingNew.before.has(x.id));if(!c)return;
    Object.assign(c,pendingNew.data);c.value=0;c.recordCreatedAt=c.recordCreatedAt||new Date().toISOString();write(state);pendingNew=null;
  }

  function mask(d){let m=d.getElementById('pvProfileMask');if(m)return m;m=d.createElement('div');m.id='pvProfileMask';m.className='pv-profile-mask';m.innerHTML='<div class="pv-profile-modal"><div class="pv-profile-head"><h3>编辑客户登记信息</h3><button type="button" class="pv-profile-close">×</button></div><div class="pv-profile-body" id="pvProfileBody"></div><div class="pv-profile-actions"><span class="pv-profile-error" id="pvProfileError"></span><button type="button" class="button secondary" id="pvProfileCancel">取消</button><button type="button" class="button primary" id="pvProfileSave">保存登记信息</button></div></div>';d.body.appendChild(m);const close=()=>m.classList.remove('open');m.querySelector('.pv-profile-close').onclick=close;m.querySelector('#pvProfileCancel').onclick=close;m.addEventListener('click',e=>{if(e.target===m)close();});return m;}

  function fmtCreated(v){if(!v)return'系统旧数据 / 未记录';try{return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}}
  function leadVal(c){const v=c.leadAt||'';if(v&&String(v).includes('T'))return String(v).slice(0,16);if(v&&/^\d{4}-\d{2}-\d{2}/.test(v))return String(v).slice(0,10)+'T12:00';return'';}

  function openEditor(d,id){
    const c=customer(id);if(!c)return;styles(d);const m=mask(d),body=d.getElementById('pvProfileBody');
    body.innerHTML=`
      <section class="pv-profile-section"><strong>客户身份</strong><div class="pv-profile-grid">
        <label><span>客户姓名 / WhatsApp备注</span><input id="pvPName" value="${esc(c.name||'')}"></label>
        <label><span>联系方式 / WhatsApp</span><input id="pvPContact" value="${esc(c.contact||'')}"></label>
        <label><span>客户所在国家 / 地区</span><input id="pvPCountry" value="${esc(c.country||'')}"></label>
        <label><span>收货国家 / 地区</span><input id="pvPDestination" value="${esc(c.destinationCountry||'')}"></label>
        <label><span>公司 / 机构</span><input id="pvPCompany" value="${esc(c.company||'')}"></label>
        <label><span>客户类型</span><select id="pvPType">${options(TYPES,c.customerType||'待确认')}</select></label>
        <label><span>联系人身份</span><select id="pvPRole">${options(CONTACT_ROLES,c.contactRole||'待确认')}</select></label>
        <label><span>沟通语言</span><select id="pvPLanguage">${options(LANGUAGES,c.language||'待确认')}</select></label>
        <label><span>客户等级</span><select id="pvPGrade">${options(GRADES,c.grade||'B')}</select></label>
      </div></section>
      <section class="pv-profile-section"><strong>需求信息</strong><div class="pv-profile-grid">
        <label><span>主要产品 / 需求</span><input id="pvPProduct" value="${esc(c.product||'')}"></label>
        <label class="span2"><span>需求规格 / 数量</span><textarea id="pvPDemand" rows="2">${esc(c.demandDetail||'')}</textarea></label>
        <label><span>采购用途</span><select id="pvPPurpose">${options(PURPOSES,c.purchasePurpose||'待确认')}</select></label>
        <label><span>当前主要阻力</span><select id="pvPObjection">${options(OBJECTIONS,c.currentObjection||'未确认')}</select></label>
        <label><span>风险</span><select id="pvPRisk">${options(RISKS,c.risk==='待审核'?'待确认':(c.risk||'待确认'))}</select></label>
      </div></section>
      <section class="pv-profile-section"><strong>来源与时间</strong><div class="pv-profile-grid">
        <label><span>来源</span><input id="pvPSource" value="${esc(c.source||'')}"></label>
        <label class="span2"><span>来源渠道详情</span><input id="pvPSourceDetail" value="${esc(c.sourceDetail||'')}" placeholder="广告名、主页、转介绍人等"></label>
        <label><span>进粉时间</span><input id="pvPLeadAt" type="datetime-local" value="${esc(leadVal(c))}"><small class="pv-profile-note">可回填真实进粉时间。</small></label>
        <label class="span2"><span>CRM 建档时间</span><input class="pv-profile-readonly" value="${esc(fmtCreated(c.recordCreatedAt))}" disabled><small class="pv-profile-note">系统审计时间，不允许人工修改。</small></label>
      </div></section>
      <section class="pv-profile-section"><strong>业务员登记内容</strong><div class="pv-profile-grid">
        <label class="wide"><span>客户最初 / 原始消息</span><textarea id="pvPFirst" rows="3">${esc(c.firstMessage||'')}</textarea></label>
        <label class="wide"><span>客户特征标签（逗号分隔）</span><input id="pvPTraits" value="${esc((c.traits||[]).join(', '))}"></label>
        <label class="wide"><span>内部备注</span><textarea id="pvPNote" rows="3">${esc(c.note||'')}</textarea></label>
      </div></section>`;
    const save=d.getElementById('pvProfileSave');save.onclick=()=>{
      const data=read(),x=(data.customers||[]).find(y=>String(y.id)===String(id)),err=d.getElementById('pvProfileError');if(!x){err.textContent='客户数据不存在。';return;}
      const name=d.getElementById('pvPName').value.trim(),contact=d.getElementById('pvPContact').value.trim();if(!name&&!contact){err.textContent='客户名称和联系方式至少保留一项。';return;}
      Object.assign(x,{name:name||contact||'未命名客户',contact:contact||'—',country:d.getElementById('pvPCountry').value.trim()||'待确认',destinationCountry:d.getElementById('pvPDestination').value.trim(),company:d.getElementById('pvPCompany').value.trim()||'未填写',customerType:d.getElementById('pvPType').value,contactRole:d.getElementById('pvPRole').value,language:d.getElementById('pvPLanguage').value,grade:d.getElementById('pvPGrade').value,product:d.getElementById('pvPProduct').value.trim()||'待确认',demandDetail:d.getElementById('pvPDemand').value.trim(),purchasePurpose:d.getElementById('pvPPurpose').value,currentObjection:d.getElementById('pvPObjection').value,risk:d.getElementById('pvPRisk').value,source:d.getElementById('pvPSource').value.trim()||'Manual',sourceDetail:d.getElementById('pvPSourceDetail').value.trim(),leadAt:d.getElementById('pvPLeadAt').value||x.leadAt||'',firstMessage:d.getElementById('pvPFirst').value.trim(),traits:split(d.getElementById('pvPTraits').value),note:d.getElementById('pvPNote').value.trim(),recordCreatedAt:x.recordCreatedAt||new Date().toISOString()});
      x.leadDate=x.leadAt?String(x.leadAt).slice(0,10):(x.leadDate||'');write(data);m.classList.remove('open');try{frame.contentWindow.location.reload();}catch(_){}
    };
    m.classList.add('open');
  }

  function patchDetail(d){
    const body=d.getElementById('detailModalBody');if(!body||!body.classList.contains('pv-detail-v3'))return;const id=body.dataset.pvDetailId,c=customer(id);if(!c)return;
    const reg=body.querySelector('.pv3-registered');if(reg&&!reg.querySelector('[data-pv-profile-extra]')){
      const wrap=d.createElement('div');wrap.dataset.pvProfileExtra='1';wrap.className='pv3-profile-extra';
      const fields=[['联系人身份',c.contactRole],['沟通语言',c.language],['收货国家',c.destinationCountry],['需求规格 / 数量',c.demandDetail],['采购用途',c.purchasePurpose],['当前主要阻力',c.currentObjection],['来源详情',c.sourceDetail]].filter(x=>x[1]&&x[1]!=='待确认'&&x[1]!=='未确认');
      fields.forEach(([k,v])=>{const el=d.createElement('div');el.className='pv3-field '+(String(v).length>35?'wide':'');el.innerHTML=`<small>${esc(k)}</small><p>${esc(v)}</p>`;reg.appendChild(el);});
    }
    const info=body.querySelector('.pv3-info');if(info&&!info.querySelector('[data-pv-created-row]')){const row=d.createElement('div');row.className='pv3-info-row';row.dataset.pvCreatedRow='1';row.innerHTML=`<span>CRM建档</span><b>${esc(fmtCreated(c.recordCreatedAt))}</b>`;info.appendChild(row);}
  }

  function install(d){
    if(!d)return;styles(d);patchRegistration(d);patchDetail(d);
    if(d.documentElement.dataset.pvProfileV1==='1')return;d.documentElement.dataset.pvProfileV1='1';
    d.addEventListener('submit',e=>{if(e.target?.id==='customerForm')captureNew(e.target);},true);
    d.addEventListener('click',e=>{
      const edit=e.target.closest('[data-v9-edit-customer]');if(edit){e.preventDefault();e.stopImmediatePropagation();openEditor(d,edit.dataset.v9EditCustomer);return;}
      if(e.target.closest('#addCustomerBtn')||e.target.closest('[data-create-mode]'))setTimeout(()=>patchRegistration(d),30);
    },true);
    const detail=d.getElementById('detailModalBody');if(detail)new MutationObserver(()=>queueMicrotask(()=>patchDetail(d))).observe(detail,{childList:true,subtree:true});
  }
  function attach(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(attach,100);setTimeout(attach,500);});setInterval(attach,1500);
})();
