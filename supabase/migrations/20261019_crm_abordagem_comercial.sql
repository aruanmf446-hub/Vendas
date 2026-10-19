-- Abordagem Comercial: aplicar apenas uma vez no projeto Supabase do CRM Vendas.
-- Todos os registros existentes são preservados; não utiliza Supabase Storage.
alter table public.crm_products
  add column if not exists video_url text not null default '',
  add column if not exists outreach_template text not null default '';
alter table public.crm_leads
  add column if not exists outreach_status text not null default 'nao_iniciado',
  add column if not exists outreach_message text not null default '';
alter table public.crm_leads
  drop constraint if exists crm_leads_outreach_status_check;
alter table public.crm_leads
  add constraint crm_leads_outreach_status_check
  check (outreach_status in ('nao_iniciado','video_enviado','mensagem_enviada','aguardando_resposta','respondeu'));
-- RLS original das tabelas CRM permanece ativa sem alteração.
