(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  let queued=false;

  function hideFirstMessageIntake(d){
    const form=d.getElementById('customerForm');
    const input=form?.elements?.namedItem('firstMessage');
    if(!input)return;
    input.value='';
    const label=input.closest('label');
    if(label){label.style.display='none';label.dataset.pvFirstMessageHidden='1';}
  }

  function hideFirstMessageEditor(d){
    const input=d.getElementById('pvPFirst');
    if(!input)return;
    const label=input.closest('label');
    if(label){label.style.display='none';label.dataset.pvFirstMessageHidden='1';}
  }

  function removeFirstMessageDisplays(d){
    d.querySelectorAll('#customerWorkspace .pv2-register-cell,#detailModalBody .pv3-field').forEach(block=>{
      const label=(block.querySelector('small')?.textContent||'').trim();
      if(/客户最初|原始消息|首条\s*\/\s*最近消息|首条消息/.test(label))block.style.display='none';
    });

    d.querySelectorAll('#customerWorkspace .pv2-section,#detailModalBody .pv3-card').forEach(section=>{
      const visible=[...section.querySelectorAll('.pv2-register-cell,.pv3-field')].filter(x=>getComputedStyle(x).display!=='none');
      const title=section.querySelector('h3')?.textContent?.trim()||'';
      if((title==='登记内容'||title==='业务员登记信息')&&visible.length===0)section.style.display='none';
    });
  }

  function tidyText(d){
    const more=d.querySelector('#customerForm .pv-reg-more>summary span:last-child');
    if(more&&more.textContent.includes('备注'))more.textContent='公司 / 类型 / 等级 / 标签 / 备注';
  }

  function apply(){
    try{
      const d=frame.contentDocument;if(!d)return;
      hideFirstMessageIntake(d);
      hideFirstMessageEditor(d);
      removeFirstMessageDisplays(d);
      tidyText(d);
    }catch(_){}
  }

  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply();},35);}
  function attach(){
    const d=frame.contentDocument;if(!d)return;apply();
    if(!d.documentElement.dataset.pvFirstMessageCleanup){
      d.documentElement.dataset.pvFirstMessageCleanup='1';
      new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});
    }
  }

  frame.addEventListener('load',()=>{setTimeout(attach,140);setTimeout(attach,700);});
  setInterval(()=>{try{apply();}catch(_){}},1400);
})();
