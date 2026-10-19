-- CRM PLUS Vendas: campanhas personalizadas, consentimento documentado e historico de envios.
-- Nao envia emails automaticamente. E-mails promocionais exigem opt-in registrado.
alter table public.crm_leads add column if not exists email_consent_at timestamptz;
alter table public.crm_leads add column if not exists email_consent_source text;
alter table public.crm_leads add column if not exists email_opt_out_at timestamptz;

create table if not exists public.crm_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(trim(name)) between 2 and 120),
  subject text not null check(char_length(trim(subject)) between 2 and 240),
  body text not null check(char_length(trim(body)) between 10 and 12000),
  status text not null default 'draft' check(status in ('draft','ready','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_email_campaigns_owner_idx on public.crm_email_campaigns(owner_id, updated_at desc);

create table if not exists public.crm_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.crm_email_campaigns(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(campaign_id, lead_id)
);
create index if not exists crm_email_deliveries_owner_idx on public.crm_email_deliveries(owner_id, created_at desc);
alter table public.crm_email_campaigns enable row level security;
alter table public.crm_email_deliveries enable row level security;
create policy crm_email_campaigns_own on public.crm_email_campaigns
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy crm_email_deliveries_own on public.crm_email_deliveries
  for all to authenticated using ((select auth.uid()) = owner_id
    and exists (select 1 from public.crm_email_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.crm_email_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.crm_leads l where l.id = lead_id and l.owner_id = (select auth.uid())));
revoke all on public.crm_email_campaigns, public.crm_email_deliveries from anon;
grant select, insert, update, delete on public.crm_email_campaigns, public.crm_email_deliveries to authenticated;
comment on column public.crm_leads.email_consent_at is 'Momento em que o titular autorizou campanhas; nulo = nao autorizado';
comment on column public.crm_leads.email_consent_source is 'Evidencia / canal da autorizacao registrada pelo operador';
comment on column public.crm_leads.email_opt_out_at is 'Nao enviar campanhas depois de revogacao';
