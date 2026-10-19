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

## Abordagem Comercial por WhatsApp

Dentro de um lead, clique em **Abordagem Comercial**.

1. **Vídeo:** o CRM lê o vídeo configurado no produto. Também é possível escolher um vídeo do computador somente para pré-visualizar nesta sessão. Clique em *Abrir WhatsApp para anexar*, anexe e envie o vídeo no WhatsApp; depois marque **Vídeo enviado**.
2. **Mensagem:** o CRM monta automaticamente uma mensagem usando nome/empresa, produto e origem (Google, Instagram etc.). Para alterar o modelo por produto, edite **Produtos e serviços → Modelo de mensagem** e use as variáveis `{cliente}`, `{produto}`, `{origem}`. Revise, salve, copie ou abra o WhatsApp com o texto preenchido; após enviar na conversa, marque **Mensagem enviada**.
3. **Acompanhamento:** marque **Aguardando resposta** e agende o próximo retorno. Os eventos são registrados em `crm_activities` e as etapas em `crm_leads.outreach_status`.

**Não há envio automático ou integração de mensagens com a API do WhatsApp Business.** O clique só abre o WhatsApp, e o vendedor envia e confirma cada etapa. Arquivos selecionados localmente não são enviados para o Supabase. Para associar um vídeo permanentemente a um produto, configure uma URL HTTPS válida em **Produtos e serviços → Vídeo de apresentação**; essa URL deve apontar para conteúdo que você controla e pode compartilhar.

A migração `supabase/migrations/20261019_crm_abordagem_comercial.sql` adiciona os campos de vídeo, modelo e acompanhamento, sem alterar as políticas RLS ou os outros aplicativos.
