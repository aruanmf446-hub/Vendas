# CRM PLUS · Vendas

CRM comercial com design responsivo, funil Kanban, produtos/serviços, leads, valor potencial, próximos retornos e histórico de interações.

## Dados
Projeto Supabase: `qxhzptgbmkmxhuswshka`. As novas tabelas `crm_products`, `crm_leads` e `crm_activities` são isoladas das tabelas que já existiam no banco. O acesso usa Supabase Auth (email/senha); RLS restringe cada registro ao usuário proprietário.

## Rodar local
1. Execute `npm install`.
2. Copie `.env.example` para `.env.local` e substitua a chave por uma **chave publicável** do seu projeto (não use service_role/secret).
3. Execute `npm run dev` e acesse `http://localhost:5173`.
4. Execute `npm run build` para gerar a versão de produção.

## Deploy Vercel
Framework: Vite. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nos ambientes de produção e prévia. Adicione os domínios de acesso em Supabase > Authentication > URL Configuration para login, confirmação de email e redefinição de senha.

## Funcionalidades
- Visão geral: oportunidades, valor do pipeline e retornos vencidos
- Funil Kanban: arraste cards entre etapas ou altere no painel do lead
- Lista de leads: pesquisa, filtros, edição e dados de contato
- Produtos: cadastro de produtos/serviços, valores e status
- Agenda: retornos pendentes e vencidos
- Histórico: registro de ligações, WhatsApp, email, reuniões e notas
- Isolamento por usuário e autenticação real no Supabase

O botão de WhatsApp abre a conversa no aplicativo; o conteúdo das mensagens não é sincronizado automaticamente.
