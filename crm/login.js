const $=s=>document.querySelector(s);
function err(t){const e=$('#error');e.textContent=t;e.style.display='block'}
function clearErr(){$('#error').style.display='none'}

async function req(url,opts={},timeout=5000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:c.signal,...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});
    let d={};
    try{d=await r.json()}catch{}
    return{r,d};
  }finally{clearTimeout(t)}
}

async function init(){
  try{
    const{r,d}=await req('/api/auth/status',{},3000);
    if(r.ok&&d.ok){
      $('#status').textContent='数据库已连接';
      if(d.setupRequired)$('#notice').style.display='block';
      return;
    }
    $('#status').textContent='数据库状态异常：'+(d.message||d.error||r.status);
  }catch(e){
    $('#status').textContent=e.name==='AbortError'?'数据库状态检查超时，但仍可尝试登录':'状态检查失败：'+e.message;
  }
}

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  clearErr();
  const f=Object.fromEntries(new FormData(e.currentTarget));
  const b=$('#loginBtn');
  b.disabled=true;
  b.textContent='正在登录…';
  try{
    const{r,d}=await req('/api/auth/login',{method:'POST',body:JSON.stringify(f)},10000);
    if(!r.ok||!d.ok){
      err(d.error==='invalid_credentials'?'账号或密码错误':'登录失败：'+(d.message||d.error||r.status));
      return;
    }
    location.replace('./');
  }catch(ex){
    err('登录请求失败：'+(ex.name==='AbortError'?'请求超时':ex.message));
  }finally{
    b.disabled=false;
    b.textContent='登录';
  }
};

init();
