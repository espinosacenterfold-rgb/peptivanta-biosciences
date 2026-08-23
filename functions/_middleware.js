import { getCurrentUser, json } from './_lib/auth.js';

const PUBLIC_API = new Set([
  '/api/auth/status',
  '/api/auth/bootstrap',
  '/api/auth/recover',
  '/api/auth/login',
  '/api/auth/logout'
]);

export async function onRequest(context){
  const url = new URL(context.request.url);
  const path = url.pathname;

  // v7.html is the internal CRM view and reads the browser's scoped CRM cache.
  // Never allow it to be opened without an authenticated session.
  if(path === '/v7.html'){
    try{
      const user = await getCurrentUser(context);
      if(user) return context.next();
      return new Response('Authentication required', { status:401, headers:{'cache-control':'no-store'} });
    }catch(e){
      return new Response('Backend unavailable', { status:503, headers:{'cache-control':'no-store'} });
    }
  }

  if(!path.startsWith('/api/')) return context.next();
  if(PUBLIC_API.has(path)) return context.next();
  try{
    const user = await getCurrentUser(context);
    if(user) return context.next();
    return json({ok:false,error:'unauthorized'},401);
  }catch(e){
    return json({ok:false,error:'backend_unavailable',message:e?.message||String(e)},503);
  }
}
