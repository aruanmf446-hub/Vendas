-- CRM Plus Vendas: recepção passiva de mensagens da API oficial do WhatsApp.
-- Não faz envio de mensagens, não altera autenticação e preserva leads existentes.
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS last_whatsapp_reply_at timestamptz;

CREATE TABLE IF NOT EXISTS public.crm_whatsapp_messages (
  message_id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  from_number text NOT NULL,
  message_type text NOT NULL,
  body text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_whatsapp_messages_id_length CHECK (char_length(message_id) BETWEEN 1 AND 255),
  CONSTRAINT crm_whatsapp_messages_body_length CHECK (char_length(body) <= 3000)
);

CREATE INDEX IF NOT EXISTS crm_whatsapp_messages_lead_time
  ON public.crm_whatsapp_messages (lead_id, sent_at DESC);

ALTER TABLE public.crm_whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Mensagens são escritas SOMENTE pelo servidor, após verificar a assinatura da Meta.
REVOKE ALL ON public.crm_whatsapp_messages FROM anon, authenticated;
GRANT SELECT ON public.crm_whatsapp_messages TO authenticated;

DROP POLICY IF EXISTS crm_whatsapp_messages_select_own ON public.crm_whatsapp_messages;
CREATE POLICY crm_whatsapp_messages_select_own ON public.crm_whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND lower(coalesce((SELECT auth.jwt()->>'email'), '')) = 'aruanmf446@gmail.com'
    AND coalesce((SELECT auth.jwt()->>'is_anonymous'), 'false') = 'false'
  );
