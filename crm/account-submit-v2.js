(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;

  async function api(url,opts={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};try{d=await r.json()}catch{}
    return{r,d};
  }

  function install(){
    try{
      const d=frame.contentDocument;if(!d||d.documentElement.dataset.accountSubmitV2==='1')return;
      d.documentElement.dataset.accountSubmitV2='1';
      d.addEventListener('submit',async e=>{
        const form=e.target;
        if(!form||form.id!=='accountForm')return;
        e.preventDefault();
        e.stopImmediatePropagation();

        const fd=new frame.contentWindow.FormData(form);
        const x=Object.fromEntries(fd);
        const role=String(x.permissionGroup||'普通销售');
        let team=String(x.team||'—');
        let managedTeams=[];

        if(role==='超级管理员'){
          team='—';
        }else if(role==='一级管理员'){
          team='—';
          managedTeams=[...d.querySelectorAll('#pvManagedTeams input[name="managedTeam"]:checked')].map(i=>i.value).filter(Boolean);
          if(!managedTeams.length){alert('主管至少需要选择一个管理销售组。');return;}
        }else if(!team||team==='—'){
          alert('销售和组长必须选择所属销售小组。');return;
        }

        const password=String(x.password||'');
        if(password.length<4){alert('密码至少 4 位。');return;}

        const payload={
          username:x.login,
          displayName:x.displayName,
          permissionGroup:role,
          team,
          managedTeams,
          password,
          status:x.status,
          mustChangePassword:false
        };

        const submit=form.querySelector('button[type="submit"],button:not([type])');
        const old=submit?.textContent||'创建账号';
        if(submit){submit.disabled=true;submit.textContent='创建中…';}
        try{
          const res=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});
          if(!res.r.ok||!res.d.ok){
            const map={username_exists:'登录账号已存在',managed_teams_required:'主管至少需要选择一个管理销售组',team_required:'必须选择所属销售小组',password_too_short:'密码至少 4 位',forbidden_target_scope:'当前账号不能创建该组织范围的账号',super_admin_required:'只有超级管理员可以创建超级管理员'};
            throw new Error(map[res.d.error]||res.d.message||res.d.error||`HTTP ${res.r.status}`);
          }
          window.location.reload();
        }catch(err){
          alert('创建账号失败：'+(err?.message||err));
          if(submit){submit.disabled=false;submit.textContent=old;}
        }
      },true);
    }catch(_){ }
  }

  frame.addEventListener('load',()=>{setTimeout(install,80);setTimeout(install,500);});
  setInterval(install,1000);
})();
