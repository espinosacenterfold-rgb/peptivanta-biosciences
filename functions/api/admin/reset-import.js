import { requireUser, json, nowIso, audit } from '../../_lib/auth.js';

function cleanState(){
  return {
    teams:[
      {id:'T-NA1',name:'北美组',manager:'Administrator',level:'一级销售组',status:'正常'},
      {id:'T-MX1',name:'墨西哥组',manager:'Administrator',level:'二级销售组',status:'正常'},
      {id:'T-AU1',name:'澳大利亚组',manager:'Administrator',level:'二级销售组',status:'正常'}
    ],
    permissions:[],
    whatsapp:[],
    accounts:[],
    customers:[],
    orders:[]
  };
}

export async function onRequestPost(context){
  try{
    const auth=await requireUser(context);
    if(auth.response)return auth.response;
    if(auth.user.permission_group!=='超级管理员')return json({ok:false,error:'forbidden'},403);

    const body=await context.request.json().catch(()=>({}));
    if(body?.confirm!=='UNDO_IMPORTED_CRM_DATA')return json({ok:false,error:'confirmation_required'},400);

    const row=await context.env.DB.prepare('SELECT revision FROM app_state WHERE id=1').first();
    const nextRevision=Number(row?.revision||0)+1;
    const now=nowIso();
    const state=cleanState();

    if(row){
      await context.env.DB.prepare('UPDATE app_state SET data=?,revision=?,updated_at=? WHERE id=1')
        .bind(JSON.stringify(state),nextRevision,now).run();
    }else{
      await context.env.DB.prepare('INSERT INTO app_state(id,data,revision,updated_at) VALUES(1,?,?,?)')
        .bind(JSON.stringify(state),1,now).run();
    }

    await audit(context.env.DB,auth.user,'undo_import_reset','crm','global',{customers:0,orders:0,whatsapp:0});
    return json({ok:true,state,revision:row?nextRevision:1,updatedAt:now});
  }catch(e){
    return json({ok:false,error:'reset_import_failed',message:e?.message||String(e)},500);
  }
}
