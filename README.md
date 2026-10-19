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

O botão de WhatsApp continua abrindo a conversa no aplicativo. A sincronização das **respostas recebidas** somente é ativada depois da autorização oficial de coexistência pela Meta e da configuração do webhook.

## Abordagem Comercial por WhatsApp

Dentro de um lead, clique em **Abordagem Comercial**.

1. **Vídeo:** o CRM lê o vídeo configurado no produto. Também é possível escolher um vídeo do computador somente para pré-visualizar nesta sessão. Clique em *Abrir WhatsApp para anexar*, anexe e envie o vídeo no WhatsApp; depois marque **Vídeo enviado**.
2. **Mensagem:** o CRM monta automaticamente uma mensagem usando nome/empresa, produto e origem (Google, Instagram etc.). Para alterar o modelo por produto, edite **Produtos e serviços → Modelo de mensagem** e use as variáveis `{cliente}`, `{produto}`, `{origem}`. Revise, salve, copie ou abra o WhatsApp com o texto preenchido; após enviar na conversa, marque **Mensagem enviada**.
3. **Acompanhamento:** marque **Aguardando resposta** e agende o próximo retorno. Os eventos são registrados em `crm_activities` e as etapas em `crm_leads.outreach_status`.

**Não há envio automático pela API.** O clique abre o WhatsApp, e o vendedor envia e confirma cada etapa manualmente. Arquivos selecionados localmente não são enviados para o Supabase. Para associar um vídeo permanentemente a um produto, configure uma URL HTTPS válida em **Produtos e serviços → Vídeo de apresentação**; essa URL deve apontar para conteúdo que você controla e pode compartilhar.

A migração `supabase/migrations/20261019_crm_abordagem_comercial.sql` adiciona os campos de vídeo, modelo e acompanhamento, sem alterar as políticas RLS ou os outros aplicativos.

## Integração opcional: apenas receber respostas do WhatsApp Business

A implementação está preparada, mas **não está ativada até o número ser autorizado na Meta**. Não desconecta ou migra o número por conta própria.

- Endpoint HTTPS: `https://crmplus-vendas.vercel.app/api/whatsapp-webhook` (verificação GET; notificações POST).
- É obrigatório usar o fluxo de **coexistência** do WhatsApp Business App via **Embedded Signup** da Meta, ou parceiro oficial habilitado. **Não use** o registro comum da Cloud API, pois o objetivo é manter o mesmo número no aplicativo.
- Depois de autorizado, associe a WhatsApp Business Account e inscreva o app no campo `messages`; os webhooks `smb_message_echoes` e `history` são opcionais e não são necessários para detectar novas mensagens de pacientes/leads.
- Salve exclusivamente em **Vercel → projeto crmplus-vendas → Settings → Environment Variables (Production)**:
  - `WHATSAPP_META_VERIFY_TOKEN` — segredo aleatório criado por você, que será copiado no painel do webhook da Meta.
  - `WHATSAPP_META_APP_SECRET` — App Secret obtido na configuração segura do app da Meta, usado para validar `X-Hub-Signature-256`.
  - `WHATSAPP_META_PHONE_NUMBER_ID` — identificador do número na Cloud API/Meta.
  - `WHATSAPP_CRM_OWNER_ID` — UUID do proprietário dos leads no Supabase.
  - `SUPABASE_SERVICE_ROLE_KEY` — chave secreta somente do servidor para o Supabase do CRM.
  - `SUPABASE_URL` — URL do projeto Supabase (opcional caso `VITE_SUPABASE_URL` já esteja definida).
- Nunca coloque essas chaves em `VITE_*`, em GitHub ou nas mensagens do chat. Após criar/alterar as variáveis na Vercel, faça um redeploy.
- Primeiro teste a verificação do webhook no painel da Meta, em seguida envie uma mensagem **de outro número** para um lead cujo telefone esteja cadastrado.
- Mensagens recebidas são vinculadas somente a leads existentes que tenham **um telefone único correspondente**; remetentes desconhecidos ou duplicados são ignorados. O CRM registra texto e a indicação do tipo de mídia, sem baixar anexos, imagens ou áudios.
- Uma resposta atualiza `outreach_status = respondeu` e registra a mensagem no histórico. Apenas leads na etapa `novo` passam para `contato`; etapas posteriores e negócios fechados não são substituídos.
- O webhook só aceita POST com assinatura HMAC-SHA256 válida da Meta e com o identificador do número autorizado. Eventos repetidos não duplicam mensagens.
- O painel verifica novas respostas a cada 45 segundos quando a aba está aberta. Nada é enviado pela API; mensagens digitadas e enviadas pelo próprio aplicativo continuam no fluxo original.
- Para **desativar**, remova as variáveis secretas da Vercel e a inscrição do webhook na Meta. Os históricos já registrados são preservados.

Migrações: `supabase/migrations/20261019_crm_whatsapp_inbox.sql` e `supabase/migrations/20261019_crm_whatsapp_inbound_rpc.sql`. Tabelas existentes e políticas de leads foram preservadas; somente a nova tabela tem permissão de leitura para o proprietário.
