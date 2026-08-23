import { getCurrentUser, json } from './_lib/auth.js';

// Static CRM pages/assets are allowed to load normally. Sensitive data is never
// embedded in those files; authentication is enforced on the API boundary.
// This avoids HTML -> login -> HTML redirect loops in Cloudflare Pages while
// still preventing unauthenticated access to CRM data and mutations.
const PUBLIC_API = new Set([
  '/api/auth/status',
  '/api/auth/bootstrap',
  '/api/auth/login',
  '/api/auth/logout'
]);

export async function onRequest(context){
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Never redirect static documents/assets at middleware level.
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
