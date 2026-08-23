(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;

  const GROUPS=[
    ['采购特征',['批量采购','长期采购','试单/小批量','复购潜力','急单']],
    ['重点关注',['价格敏感','MOQ关注','COA关注','HPLC/MS关注','物流敏感','付款方式关注']],
    ['客户背景',['科研用途','经销/转售','机构采购','品牌/OEM','定制需求','样品评估']]
  ];

  const split=v=>[...new Set(String(v||'').split(/[,，;；]/).map(x=>x.trim()).filter(Boolean))];

  function installStyles(d){
    if(d.getElementById('pvCustomerTagStyles'))return;
    const st=d.createElement('style');
    st.id='pvCustomerTagStyles';
    st.textContent=`
      .pv-tag-presets{margin:7px 0 8px;padding:9px 10px;border:1px solid #e1e6ed;background:#fafbfc;border-radius:6px}
      .pv-tag-group{display:grid;grid-template-columns:68px 1fr;gap:7px;align-items:start;margin:5px 0}
      .pv-tag-group:first-child{margin-top:0}.pv-tag-group:last-child{margin-bottom:0}
      .pv-tag-group-title{font-size:11px;color:#667085;font-weight:700;line-height:26px}
      .pv-tag-options{display:flex;flex-wrap:wrap;gap:5px}
      .pv-tag-option{height:26px;padding:0 9px;border:1px solid #d5dbe3;background:#fff;color:#475467;border-radius:13px;font-size:11px;cursor:pointer;white-space:nowrap}
      .pv-tag-option:hover{border-color:#9db5dd;background:#f7f9fd}
      .pv-tag-option.active{border-color:#4e79c8;background:#edf3ff;color:#234f9a;font-weight:600}
      .pv-tag-custom-note{display:block;margin-top:4px;color:#98a2b3;font-size:10.5px;line-height:1.4}
      @media(max-width:680px){.pv-tag-group{grid-template-columns:1fr}.pv-tag-group-title{line-height:18px}}
    `;
    d.head.appendChild(st);
  }

  function sync(box,input){
    if(!box||!input)return;
    const selected=new Set(split(input.value));
    box.querySelectorAll('[data-pv-trait]').forEach(b=>b.classList.toggle('active',selected.has(b.dataset.pvTrait)));
  }

  function toggle(input,value){
    const arr=split(input.value),i=arr.indexOf(value);
    if(i>=0)arr.splice(i,1);else arr.push(value);
    input.value=arr.join(', ');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function install(d){
    const form=d.getElementById('customerForm'),input=form?.elements?.namedItem('traits');
    if(!form||!input)return;
    installStyles(d);
    const label=input.closest('label');if(!label)return;
    const title=label.querySelector(':scope > span');if(title)title.textContent='客户特征标签';
    input.placeholder='可继续手动补充标签，用逗号分隔';

    let box=label.querySelector('#pvCustomerTagPresets');
    if(!box){
      box=d.createElement('div');box.id='pvCustomerTagPresets';box.className='pv-tag-presets';
      box.innerHTML=GROUPS.map(([name,tags])=>`<div class="pv-tag-group"><div class="pv-tag-group-title">${name}</div><div class="pv-tag-options">${tags.map(t=>`<button type="button" class="pv-tag-option" data-pv-trait="${t}">${t}</button>`).join('')}</div></div>`).join('');
      input.parentNode.insertBefore(box,input);
      const note=d.createElement('small');note.className='pv-tag-custom-note';note.textContent='可多选；销售阶段、已成交、待付款、未回复等状态由系统自动生成，不需要手工打标签。';
      input.insertAdjacentElement('afterend',note);
      box.addEventListener('click',e=>{const b=e.target.closest('[data-pv-trait]');if(!b)return;toggle(input,b.dataset.pvTrait);sync(box,input);});
      input.addEventListener('input',()=>sync(box,input));
      form.addEventListener('reset',()=>setTimeout(()=>sync(box,input),0));
    }
    sync(box,input);
  }

  function patch(){try{install(frame.contentDocument);}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(patch,100);setTimeout(patch,500);});
  setInterval(patch,1000);
})();
