# CRM PLUS | Vendas

Aplicação de gestão comercial: produtos, funil de oportunidades, atividades e acompanhamento de leads com Supabase.

## Configuração

Copie `.env.example` para `.env.local` e configure URL e chave publicável do projeto Supabase. Instale com `npm install` e execute `npm run dev`.

As tabelas são `crm_products`, `crm_leads` e `crm_activities`, isoladas das tabelas preexistentes. Usuários devem entrar com Supabase Auth; RLS limita dados por proprietário.
