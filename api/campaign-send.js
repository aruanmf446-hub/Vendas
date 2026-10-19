import { createClient } from '@supabase/supabase-js';

const response = (res, status, data) => res.status(status).setHeader('Cache-Control','no-store').json(data);
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value||'').trim());
const replace = (template, lead, product) => {
  const vars = {
    nome:(lead.name||'').trim().split(/\s+/)[0]||'Olá',
    clinica:lead.company||lead.name||'sua clínica',
    empresa:lead.company||lead.name||'sua empresa',
    produto:product?.name||'nosso serviço',
    origem:lead.source||'nosso contato'
  };
  return (template||'').replace(/\{(nome|clinica|empresa|produto|origem)\}/gi,
    (text,key)=>vars[key.toLowerCase()]||text);
};

export default async function handler(req,res) {
  if(req.method!=='POST') return response(res,405,{error:'Método não permitido.'});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  const resendKey=process.env.RESEND_API_KEY;
  if(!url||!key) return response(res,503,{error:'Supabase não configurado no servidor.'});
  if(!resendKey) return response(res,503,{error:'Falta configurar RESEND_API_KEY nas variáveis de ambiente da Vercel (Production).'});
  const token=(req.headers.authorization||'').match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return response(res,401,{error:'Faça login para enviar.'});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user||user.is_anonymous||user.email?.toLowerCase()!=='aruanmf446@gmail.com')
    return response(res,403,{error:'Sessão sem permissão de envio.'});

  const {campaignId,leadId}=req.body||{};
  if(!/^[0-9a-f-]{36}$/i.test(campaignId||'')||!/^[0-9a-f-]{36}$/i.test(leadId||''))
    return response(res,400,{error:'Campanha ou lead inválido.'});
  const [campaignResult,leadResult]=await Promise.all([
    db.from('crm_email_campaigns').select('*').eq('id',campaignId).eq('owner_id',user.id).maybeSingle(),
    db.from('crm_leads').select('*').eq('id',leadId).eq('owner_id',user.id).maybeSingle()
  ]);
  if(campaignResult.error||leadResult.error) return response(res,500,{error:'Não foi possível verificar a campanha e o lead.'});
  const campaign=campaignResult.data, lead=leadResult.data;
  if(!campaign||!lead) return response(res,404,{error:'Campanha ou destinatário não encontrado.'});
  if(campaign.status!=='ready') return response(res,409,{error:'Salve a campanha antes de enviar.'});
  if(!(campaign.lead_ids||[]).includes(lead.id)) return response(res,403,{error:'Lead não selecionado nesta campanha.'});
  if(!lead.email_consent_at||lead.email_opt_out_at||!validEmail(lead.email)||lead.stage==='perdido')
    return response(res,403,{error:'Este lead não tem autorização válida para receber campanhas.'});
  if(!campaign.subject.trim()||!campaign.body.trim()) return response(res,422,{error:'Assunto e mensagem obrigatórios.'});

  const since=new Date(Date.now()-86400000).toISOString();
  const {count,error:countError}=await db.from('crm_email_deliveries').select('id',{count:'exact',head:true})
    .eq('owner_id',user.id).in('status',['pending','sent']).gte('created_at',since);
  if(countError) return response(res,500,{error:'Não foi possível verificar a cota diária.'});
  if((count||0)>=30) return response(res,429,{error:'Limite interno de 30 envios em 24 horas. Aguarde para continuar.'});

  const {data:existing,error:existingError}=await db.from('crm_email_deliveries').select('id,status')
    .eq('campaign_id',campaign.id).eq('lead_id',lead.id).maybeSingle();
  if(existingError) return response(res,500,{error:'Erro ao consultar o histórico de envio.'});
  let deliveryId;
  if(existing) {
    if(existing.status!=='failed') return response(res,409,{error:'Este lead já foi enviado ou está em processamento nesta campanha.'});
    const {data:claimed,error:claimError}=await db.from('crm_email_deliveries')
      .update({status:'pending',error_message:null,created_at:new Date().toISOString()})
      .eq('id',existing.id).eq('status','failed').select('id').maybeSingle();
    if(claimError||!claimed) return response(res,409,{error:'Envio já está sendo reprocessado.'});
    deliveryId=claimed.id;
  } else {
    const {data:claimed,error:claimError}=await db.from('crm_email_deliveries').insert({
      owner_id:user.id,campaign_id:campaign.id,lead_id:lead.id,
      recipient_email:lead.email.trim(),status:'pending'
    }).select('id').single();
    if(claimError) return response(res,409,{error:'Destinatário já registrado nesta campanha.'});
    deliveryId=claimed.id;
  }
  try {
    let product=null;
    if(lead.product_id){
      const found=await db.from('crm_products').select('name').eq('id',lead.product_id).eq('owner_id',user.id).maybeSingle();
      product=found.data;
    }
    const subject=replace(campaign.subject,lead,product).slice(0,240);
    const body=replace(campaign.body,lead,product).slice(0,12000)+
      '\n\nPara deixar de receber comunicações comerciais, responda SAIR a este e-mail.';
    const reply=process.env.EMAIL_REPLY_TO||'contato@crmplus.store';
    const from=process.env.EMAIL_FROM||'CRM Plus Store <contato@crmplus.store>';
    const provider=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+resendKey,
        'Content-Type':'application/json',
        'Idempotency-Key':'crm-vendas-'+campaign.id+'-'+lead.id
      },
      body:JSON.stringify({from,to:[lead.email.trim()],reply_to:reply,subject,text:body}),
      signal:AbortSignal.timeout(15000)
    });
    const result=await provider.json().catch(()=>({}));
    if(!provider.ok||!result.id) throw new Error(result.message||'Provedor recusou o envio.');
    const {error:updateError}=await db.from('crm_email_deliveries').update({
      status:'sent',provider_message_id:result.id,sent_at:new Date().toISOString()
    }).eq('id',deliveryId);
    if(updateError) throw new Error('Resend aceitou o envio, mas houve erro ao gravar histórico: '+updateError.message);
    await db.from('crm_activities').insert({
      owner_id:user.id,lead_id:lead.id,kind:'email',
      content:('E-mail de campanha "'+campaign.name+'" aceito pelo Resend. Assunto: '+subject).slice(0,2900)
    });
    return response(res,200,{ok:true,id:result.id,status:'accepted'});
  } catch(error) {
    await db.from('crm_email_deliveries').update({status:'failed',error_message:String(error.message||error).slice(0,800)}).eq('id',deliveryId).eq('status','pending');
    return response(res,502,{error:error.message||'Erro ao enviar e-mail.'});
  }
}
