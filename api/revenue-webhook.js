import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const signatures = {
  'ponto-do-pedido': 'ADM_PDP_WEBHOOK_SECRET',
  'quem-sou-eu': 'ADM_QSE_WEBHOOK_SECRET',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Integração não configurada' });
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 32768) return res.status(413).json({ error: 'Evento excede o limite' });
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks);
    const project = String(req.headers['x-adm-project'] || '');
    const secret = process.env[signatures[project]];
    const timestamp = String(req.headers['x-adm-timestamp'] || '');
    const provided = String(req.headers['x-adm-signature'] || '');
    const issuedAt = Number(timestamp);
    if (!secret || !Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt * 1000) > 300000 || !/^sha256=[a-f0-9]{64}$/.test(provided)) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }
    const expected = createHmac('sha256', secret).update(timestamp + '.').update(raw).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided.slice(7), 'hex'))) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }
    const payload = JSON.parse(raw.toString('utf8'));
    if (payload.status !== 'paid' || typeof payload.event_id !== 'string' || !/^[a-zA-Z0-9._:-]{4,150}$/.test(payload.event_id) ||
        !Number.isSafeInteger(payload.amount_cents) || payload.amount_cents < 1 ||
        typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 200 ||
        (payload.currency && payload.currency !== 'BRL')) {
      return res.status(422).json({ error: 'Evento de pagamento inválido' });
    }
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from('adm_revenue').insert({
      project_id: project,
      amount: payload.amount_cents / 100,
      description: payload.description.trim(),
      source_event_id: payload.event_id,
      source: 'webhook'
    });
    if (error) {
      if (error.code === '23505') return res.status(200).json({ ok: true, duplicate: true });
      return res.status(500).json({ error: 'Falha ao registrar recebimento' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: 'Solicitação inválida' });
  }
}
