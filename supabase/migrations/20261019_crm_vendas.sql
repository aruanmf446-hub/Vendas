-- Estruturas exclusivas do CRM PLUS Vendas. Não alterar tabelas de outros aplicativos.
create table if not exists public.crm_products (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 140),
 category text not null default 'Serviço',
 price numeric(12,2) not null default 0 check (price >= 0),
 description text not null default '',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.crm_leads (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 140),
 company text not null default '',
 email text not null default '',
 phone text not null default '',
 product_id uuid references public.crm_products(id) on delete set null,
 expected_value numeric(12,2) not null default 0 check (expected_value >= 0),
 source text not null default 'Indicação',
 stage text not null default 'novo' check (stage in ('novo','contato','proposta','negociacao','ganho','perdido')),
 priority text not null default 'media' check (priority in ('baixa','media','alta')),
 next_follow_up date,
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.crm_activities (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 lead_id uuid not null references public.crm_leads(id) on delete cascade,
 kind text not null default 'nota' check (kind in ('nota','ligacao','whatsapp','email','reuniao','etapa','retorno')),
 content text not null check (char_length(trim(content)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index if not exists crm_products_owner_idx on public.crm_products(owner_id);
create index if not exists crm_leads_owner_stage_idx on public.crm_leads(owner_id, stage);
create index if not exists crm_leads_owner_follow_up_idx on public.crm_leads(owner_id, next_follow_up);
create index if not exists crm_activities_owner_lead_idx on public.crm_activities(owner_id,lead_id,created_at desc);
alter table public.crm_products enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
create policy "crm_products_own" on public.crm_products for all to authenticated
 using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id);
create policy "crm_leads_own" on public.crm_leads for all to authenticated
 using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id and (product_id is null or exists (
   select 1 from public.crm_products p where p.id = product_id and p.owner_id = (select auth.uid())
 )));
create policy "crm_activities_own" on public.crm_activities for all to authenticated
 using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id and exists (
   select 1 from public.crm_leads l where l.id = lead_id and l.owner_id = (select auth.uid())
 ));
revoke all on public.crm_products, public.crm_leads, public.crm_activities from anon;
grant select, insert, update, delete on public.crm_products, public.crm_leads, public.crm_activities to authenticated;
comment on table public.crm_products is 'Produtos e serviços comerciais do CRM Vendas';
comment on table public.crm_leads is 'Leads e oportunidades do CRM Vendas';
comment on table public.crm_activities is 'Histórico de contatos e evolução dos leads no CRM Vendas';
