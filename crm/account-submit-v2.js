(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;

  async function api(url,opts={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};try{d=await r.json()}catch{}
    return{r,d};
  }

  function ensurePasswordField(d){
    const form=d.getElementById('accountForm');if(!form)return null;
    let p=form.elements.namedItem('password');if(p)return p;
    const grid=form.querySelector('.form-grid');if(!grid)return null;
    const label=d.createElement('label');label.id='pvAccountPasswordField';
    label.innerHTML='<span>自定义登录密码 *</span><input name="password" type="password" minlength="4" required autocomplete="new-password" placeholder="至少 4 位"><small class="password-note">创建后员工使用“登录账号 + 此密码”登录。</small>';
    const status=form.elements.namedItem('status')?.closest('label');
    if(status)grid.insertBefore(label,status);else grid.appendChild(label);
    return label.querySelector('input');
  }

  function install(){
    try{
      const d=frame.contentDocument;if(!d)return;
      ensurePasswordField(d);
      if(d.documentElement.dataset.accountSubmitV2==='1')return;
      d.documentElement.dataset.accountSubmitV2='1';
      d.addEventListener('submit',async e=>{
        const form=e.target;
        if(!form||form.id!=='accountForm')return;
        e.preventDefault();e.stopImmediatePropagation();
        const p=ensurePasswordField(d);if(!p){alert('密码字段加载失败，请刷新页面后重试。');return;}
        const fd=new frame.contentWindow.FormData(form),x=Object.fromEntries(fd),role=String(x.permissionGroup||'普通销售');
        let team=String(x.team||'—'),managedTeams=[];
        if(role==='超级管理员')team='—';
        else if(role==='一级管理员'){
          team='—';managedTeams=[...d.querySelectorAll('#pvManagedTeams input[name="managedTeam"]:checked')].map(i=>i.value).filter(Boolean);
          if(!managedTeams.length){alert('主管至少需要选择一个管理销售组。');return;}
        }else if(!team||team==='—'){alert('销售和组长必须选择所属销售小组。');return;}
        const password=String(x.password||'');if(password.length<4){alert('密码至少 4 位。');return;}
        const whatsappAccounts=[...d.querySelectorAll('#pvCreateWhatsappBlock input[name="createWhatsapp"]:checked')].map(i=>i.value).filter(Boolean);
        if(!whatsappAccounts.length&&x.whatsapp&&x.whatsapp!=='—')whatsappAccounts.push(x.whatsapp);
        const payload={username:x.login,displayName:x.displayName,permissionGroup:role,team,managedTeams,whatsappAccounts,password,status:x.status,mustChangePassword:false};
        const submit=form.querySelector('button[type="submit"],button:not([type])'),old=submit?.textContent||'创建账号';
        if(submit){submit.disabled=true;submit.textContent='创建中…';}
        try{
          const res=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});
          if(!res.r.ok||!res.d.ok){
            const map={username_exists:'登录账号已存在',managed_teams_required:'主管至少需要选择一个管理销售组',team_required:'必须选择所属销售小组',password_too_short:'密码至少 4 位',forbidden_target_scope:'当前账号不能创建该组织范围的账号',super_admin_required:'只有超级管理员可以创建超级管理员',whatsapp_not_found:'选择的 WhatsApp 不存在',whatsapp_forbidden:'无权绑定该 WhatsApp'};
            throw new Error(map[res.d.error]||res.d.message||res.d.error||`HTTP ${res.r.status}`);
          }
          alert(`账号创建成功。\n\n登录账号：${res.d.username||x.login}\n请使用“登录账号”而不是业务备注名登录。\n密码就是刚才设置的密码。`);
          window.location.reload();
        }catch(err){alert('创建账号失败：'+(err?.message||err));if(submit){submit.disabled=false;submit.textContent=old;}}
      },true);
    }catch(_){ }
  }

  frame.addEventListener('load',()=>{setTimeout(install,80);setTimeout(install,500);});
  setInterval(install,1000);
})();
