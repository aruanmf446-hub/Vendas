// Webhook oficial da Meta, SOMENTE recepção de mensagens.
// Nunca faz envio. Ative apenas via Embedded Signup com coexistência do WhatsApp Business App.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

const cleanNumber = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 11 ? '55' + digits : digits;
};

const verifySignature = (rawBody, received, secret) => {
  if (!received || !secret || !/^sha256=[0-9a-f]{64}$/i.test(received)) return false;
  const computed = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(computed, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

const messageText = (message) => {
  switch (message?.type) {
    case 'text': return message.text?.body || '';
    case 'button': return message.button?.text || '[Botão recebido]';
    case 'interactive': return message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title || '[Resposta interativa]';
    case 'image': return message.image?.caption || '[Imagem recebida]';
    case 'video': return message.video?.caption || '[Vídeo recebido]';
    case 'document': return '[Documento recebido: ' + String(message.document?.filename || 'arquivo').slice(0, 150) + ']';
    case 'audio': return '[Áudio recebido]';
    case 'sticker': return '[Figurinha recebida]';
    case 'location': return '[Localização recebida]';
    case 'contacts': return '[Contato recebido]';
    default: return '[Mensagem recebida: ' + String(message?.type || 'desconhecida').slice(0, 35) + ']';
  }
};

export function GET(request) {
  const token = process.env.WHATSAPP_META_VERIFY_TOKEN;
  if (!token) return reply({ error: 'Configuração pendente' }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get('hub.mode') !== 'subscribe' ||
      url.searchParams.get('hub.verify_token') !== token) {
    return reply({ error: 'Verificação recusada' }, 403);
  }
  const challenge = url.searchParams.get('hub.challenge');
  if (!challenge || challenge.length > 500) return reply({ error: 'Challenge inválido' }, 400);
  return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const appSecret = process.env.WHATSAPP_META_APP_SECRET;
  const numberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  const ownerId = process.env.WHATSAPP_CRM_OWNER_ID;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appSecret || !numberId || !ownerId || !supabaseUrl || !supabaseKey) {
    return reply({ error: 'Configuração pendente' }, 503);
  }
  if (Number(request.headers.get('content-length') || 0) > 262144) return reply({ error: 'Payload muito grande' }, 413);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 262144) return reply({ error: 'Payload muito grande' }, 413);
  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return reply({ error: 'Assinatura inválida' }, 403);
  }
  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return reply({ error: 'Payload inválido' }, 400); }
  if (payload?.object !== 'whatsapp_business_account') return reply({ ok: true });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  let processed = 0;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages' || String(change.value?.metadata?.phone_number_id || '') !== String(numberId)) continue;
      // Eventos "statuses", "history" e "smb_message_echoes" não representam respostas recebidas.
      for (const message of change.value?.messages || []) {
        if (!message.id || !message.from) continue;
        const from = cleanNumber(message.from);
        if (!/^[0-9]{11,15}$/.test(from)) continue;
        const when = Number(message.timestamp);
        const sentAt = Number.isSafeInteger(when) && when > 1577836800 && when < 4102444800
          ? new Date(when * 1000).toISOString() : new Date().toISOString();
        const { data, error } = await supabase.rpc('crm_whatsapp_record_inbound', {
          p_owner_id: ownerId,
          p_message_id: String(message.id).slice(0, 255),
          p_from_number: from,
          p_message_type: String(message.type || 'unknown').slice(0, 32),
          p_body: messageText(message).slice(0, 3000),
          p_sent_at: sentAt
        });
        if (error) {
          console.error('Falha ao sincronizar resposta do WhatsApp:', error.code || 'database_error');
          // Retorna 503 para que a Meta possa tentar novamente.
          return reply({ error: 'Erro temporário' }, 503);
        }
        if (data === true) processed++;
      }
    }
  }
  return reply({ ok: true, processed });
}
