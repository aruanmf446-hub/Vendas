-- Registra a resposta, atualiza o funil e cria histórico em uma transação atômica.
-- A API somente pode chamar esta rotina com a chave de serviço no servidor.
CREATE OR REPLACE FUNCTION public.crm_whatsapp_record_inbound(
  p_owner_id uuid,
  p_message_id text,
  p_from_number text,
  p_message_type text,
  p_body text,
  p_sent_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_lead_ids uuid[];
  v_lead_id uuid;
  v_inserted_id text;
BEGIN
  IF p_owner_id IS NULL OR p_message_id IS NULL OR p_from_number !~ '^[0-9]{11,15}$'
     OR char_length(p_message_id) NOT BETWEEN 1 AND 255 THEN
    RETURN false;
  END IF;
  SELECT array_agg(id) INTO v_lead_ids
  FROM public.crm_leads
  WHERE owner_id = p_owner_id
    AND phone <> ''
    AND (
      regexp_replace(phone, '[^0-9]', '', 'g') = p_from_number
      OR (left(p_from_number, 2) = '55'
          AND regexp_replace(phone, '[^0-9]', '', 'g') = substring(p_from_number from 3))
    );
  -- Nunca associar uma conversa a um lead ambíguo.
  IF coalesce(array_length(v_lead_ids, 1), 0) <> 1 THEN
    RETURN false;
  END IF;
  v_lead_id := v_lead_ids[1];

  INSERT INTO public.crm_whatsapp_messages
    (message_id, owner_id, lead_id, from_number, message_type, body, sent_at)
  VALUES
    (p_message_id, p_owner_id, v_lead_id, p_from_number,
     left(coalesce(p_message_type, 'unknown'), 32),
     left(coalesce(p_body, ''), 3000), coalesce(p_sent_at, now()))
  ON CONFLICT (message_id) DO NOTHING
  RETURNING message_id INTO v_inserted_id;
  IF v_inserted_id IS NULL THEN
    RETURN false; -- entrega repetida: não duplicar histórico ou status
  END IF;

  UPDATE public.crm_leads
  SET stage = CASE WHEN stage = 'novo' THEN 'contato' ELSE stage END,
      outreach_status = 'respondeu',
      last_whatsapp_reply_at = greatest(coalesce(last_whatsapp_reply_at, '-infinity'::timestamptz), coalesce(p_sent_at, now())),
      updated_at = now()
  WHERE id = v_lead_id AND owner_id = p_owner_id;

  INSERT INTO public.crm_activities (owner_id, lead_id, kind, content)
  VALUES (p_owner_id, v_lead_id, 'whatsapp',
    left('Resposta recebida automaticamente pelo WhatsApp: ' ||
      coalesce(nullif(p_body, ''), '[' || coalesce(p_message_type, 'mensagem') || ' recebido]'), 2900));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_whatsapp_record_inbound(uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_whatsapp_record_inbound(uuid, text, text, text, text, timestamptz) TO service_role;
