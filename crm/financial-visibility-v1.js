(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  let isSuper=false;
  let ready=false;

  async function loadRole(){
    try{
      const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
      const d=await r.json();
      isSuper=Boolean(r.ok&&d.ok&&d.user?.permissionGroup==='超级管理员');
    }catch(_){isSuper=false;}
    ready=true;
  }

  function hideTableColumns(d){
    const terms=['成本','利润','毛利','利润率'];
    d.querySelectorAll('table').forEach(table=>{
      const heads=[...table.querySelectorAll('thead th')];
      const indexes=[];
      heads.forEach((h,i)=>{if(terms.some(t=>h.textContent.includes(t)))indexes.push(i);});
      if(!indexes.length)return;
      table.querySelectorAll('tr').forEach(row=>{
        const cells=[...row.children];
        indexes.forEach(i=>{if(cells[i])cells[i].style.setProperty('display','none','important');});
      });
    });
  }

  function hideFinancialCards(d){
    const terms=['成本','利润','毛利','利润率'];
    d.querySelectorAll('.mini-kpi,.kpi,.stat-card,.metric-card,.summary-card,.report-card').forEach(el=>{
      const text=String(el.textContent||'');
      if(terms.some(t=>text.includes(t)))el.style.setProperty('display','none','important');
    });
    d.querySelectorAll('label').forEach(label=>{
      const text=String(label.textContent||'');
      if(terms.some(t=>text.includes(t)))label.style.setProperty('display','none','important');
    });
  }

  function patch(){
    if(!ready||isSuper)return;
    try{
      const d=frame.contentDocument;if(!d)return;
      hideTableColumns(d);hideFinancialCards(d);
    }catch(_){ }
  }

  loadRole().then(patch);
  frame.addEventListener('load',()=>{setTimeout(patch,100);setTimeout(patch,600);});
  setInterval(patch,1200);
})();
