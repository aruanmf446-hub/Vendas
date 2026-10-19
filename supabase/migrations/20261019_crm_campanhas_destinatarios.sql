alter table public.crm_email_campaigns add column if not exists lead_ids uuid[] not null default '{}'::uuid[];
comment on column public.crm_email_campaigns.lead_ids is 'Leads escolhidos explicitamente pelo operador para esta campanha';
