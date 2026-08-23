import { getCurrentUser, json } from './_lib/auth.js';

const PUBLIC = new Set(['/login.html','/guide.html','/api/auth/status','/api/auth/bootstrap','/api/auth/login','/api/auth/logout']);
export async function onRequest(context){
  const url=new URL(context.request.url), path=url.pathname;
  if(PUBLIC.has(path)||path.startsWith('/cdn-cgi/'))return context.next();
  try{
    const user=await getCurrentUser(context);
    if(user)return context.next();
    if(path.startsWith('/api/'))return json({ok:false,error:'unauthorized'},401);
    return Response.redirect(new URL('/login.html?return='+encodeURIComponent(path),url.origin),302);
  }catch(e){
    if(path.startsWith('/api/'))return json({ok:false,error:'backend_unavailable',message:e?.message||String(e)},503);
    return Response.redirect(new URL('/login.html',url.origin),302);
  }
}
