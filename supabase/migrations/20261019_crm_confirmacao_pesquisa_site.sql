-- Registrar resultado da pesquisa antes de personalizar a abordagem.
-- false é o padrão: o CRM não afirma que uma empresa não tem site sem confirmação.
alter table public.crm_leads
  add column if not exists website_not_found boolean not null default false;
comment on column public.crm_leads.website_not_found is
  'Vendedor confirmou que não identificou um site durante a pesquisa; habilita essa frase na mensagem comercial.';
