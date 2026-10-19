import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clipboard, Clock3, ExternalLink, Film, Globe2, Link2, LockKeyhole, MessageCircle, Paperclip, PlayCircle, Save, Send, Sparkles, Upload, X } from 'lucide-react';
import { supabase } from './supabase';

const STAGES = {
  nao_iniciado: 0,
  video_enviado: 1,
  mensagem_enviada: 2,
  aguardando_resposta: 3,
  respondeu: 4
};
const labels = {
  nao_iniciado: 'Não iniciado',
  video_enviado: 'Vídeo enviado',
  mensagem_enviada: 'Mensagem enviada',
  aguardando_resposta: 'Aguardando resposta',
  respondeu: 'Cliente respondeu'
};
const digitsOnly = value => String(value || '').replace(/\D/g, '');
const whatsNumber = value => {
  const number = digitsOnly(value);
  if (!number) return '';
  return number.startsWith('55') && number.length >= 12 ? number : '55' + number;
};
const initialDraft = (lead, product) => {
  const company = (lead.company || lead.name || 'sua empresa').trim();
  const offer = product?.name || 'uma solução digital';
  const source = lead.source || 'uma pesquisa comercial';
  const lookUp = /^(google|instagram|facebook|linkedin|site|whatsapp)$/i.test(source)
    ? 'pelo ' + source
    : 'por meio de ' + source;
  const template = (product?.outreach_template || '').trim();
  if (template) return template.replace(/\{cliente\}/gi, company).replace(/\{produto\}/gi, offer).replace(/\{origem\}/gi, source).slice(0, 2700);
  return [
    'Olá, bom dia! Tudo bem?',
    'Sou da CRM Plus Store e trabalho com desenvolvimento de soluções digitais profissionais.',
    'Encontrei ' + company + ' ' + lookUp + ' e gostaria de apresentar nosso trabalho com ' + offer + '.',
    product?.video_url
      ? 'Compartilhei um vídeo de apresentação para vocês conhecerem a proposta.'
      : 'Temos uma apresentação que mostra como essa solução pode ajudar a presença digital da sua empresa.',
    'Podemos conversar rapidamente para eu entender o que faria mais sentido para vocês? Sem compromisso.'
  ].join('\n\n');
};
const dateISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function Outreach({ lead, product, onClose, onRefresh, onNotify, userId }) {
  const [text, setText] = useState(() => lead.outreach_message || initialDraft(lead, product));
  const [status, setStatus] = useState(lead.outreach_status || 'nao_iniciado');
  const [followUp, setFollowUp] = useState(lead.next_follow_up || '');
  const [localVideo, setLocalVideo] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [draftSaved, setDraftSaved] = useState(true);
  const [isEdited, setIsEdited] = useState(!!lead.outreach_message);
  const number = whatsNumber(lead.phone);
  const validNumber = digitsOnly(lead.phone).length >= 10 && digitsOnly(lead.phone).length <= 13;
  const url = (product?.video_url || '').trim();
  const validVideoUrl = /^https:\/\//i.test(url);
  const hasVideo = !!localVideo || validVideoUrl;
  const current = STAGES[status] ?? 0;

  useEffect(() => {
    if (!localVideo) { setPreview(''); return; }
    const objectUrl = URL.createObjectURL(localVideo);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [localVideo]);
  useEffect(() => {
    const handleKeyDown = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const alert = value => { setNotice(value); if (onNotify) onNotify(value); };
  const record = async (kind, content) => {
    const { error } = await supabase.from('crm_activities').insert({
      owner_id: userId, lead_id: lead.id, kind, content: content.slice(0, 2900)
    });
    if (error) alert('A etapa foi atualizada, mas o histórico não foi registrado: ' + error.message);
  };
  const updateStatus = async (next, activity) => {
    if (saving) return;
    setSaving(true); setNotice('');
    try {
      const { error } = await supabase.from('crm_leads')
        .update({ outreach_status: next, updated_at: new Date().toISOString() })
        .eq('id', lead.id).eq('owner_id', userId);
      if (error) throw error;
      setStatus(next);
      await record('whatsapp', activity);
      await onRefresh();
      alert('Etapa registrada no CRM.');
    } catch (error) { alert('Não foi possível registrar a etapa: ' + error.message); }
    finally { setSaving(false); }
  };
  const saveDraft = async () => {
    if (saving) return;
    setSaving(true); setNotice('');
    try {
      const { error } = await supabase.from('crm_leads')
        .update({ outreach_message: text, updated_at: new Date().toISOString() })
        .eq('id', lead.id).eq('owner_id', userId);
      if (error) throw error;
      setDraftSaved(true);
      await onRefresh();
      alert('Mensagem personalizada salva para este lead.');
    } catch (error) { alert('Não foi possível salvar a mensagem: ' + error.message); }
    finally { setSaving(false); }
  };
  const saveFollowUp = async () => {
    if (saving || !followUp) return;
    setSaving(true); setNotice('');
    try {
      const { error } = await supabase.from('crm_leads')
        .update({ next_follow_up: followUp, updated_at: new Date().toISOString() })
        .eq('id', lead.id).eq('owner_id', userId);
      if (error) throw error;
      await record('retorno', 'Próximo acompanhamento agendado para ' + new Date(followUp + 'T12:00:00').toLocaleDateString('pt-BR') + '.');
      await onRefresh();
      alert('Retorno agendado na sua agenda comercial.');
    } catch (error) { alert('Não foi possível agendar o retorno: ' + error.message); }
    finally { setSaving(false); }
  };
  const openWhatsApp = withText => {
    if (!validNumber) { setNotice('Confira o WhatsApp deste lead no cadastro antes de abrir a conversa.'); return; }
    if (withText && !text.trim()) { setNotice('Escreva a mensagem antes de abrir o WhatsApp.'); return; }
    const href = 'https://wa.me/' + number + (withText ? '?text=' + encodeURIComponent(text.trim()) : '');
    window.open(href, '_blank', 'noopener,noreferrer');
    setNotice(withText ? 'A conversa foi aberta com a mensagem preenchida. Confirme o envio no WhatsApp e depois marque a etapa.' : 'A conversa foi aberta. Anexe o vídeo diretamente no WhatsApp e confirme o envio antes de marcar a etapa.');
  };
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Mensagem copiada. Cole no WhatsApp quando desejar.');
    } catch {
      setNotice('A cópia automática não foi permitida pelo navegador. Selecione o texto da mensagem para copiar.');
    }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setNotice('Link do vídeo copiado.'); }
    catch { setNotice('Selecione e copie o link do vídeo manualmente.'); }
  };

  return <div className="outreach-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="outreach-dialog" role="dialog" aria-modal="true" aria-label="Preparar abordagem comercial">
      <header className="outreach-header">
        <button type="button" className="outreach-back" onClick={onClose}><ArrowLeft size={18}/> Voltar ao lead</button>
        <button type="button" className="outreach-close" onClick={onClose} aria-label="Fechar"><X size={19}/></button>
      </header>
      <div className="outreach-scroll">
        <div className="outreach-hero">
          <div className="outreach-kicker"><span/> PLAYBOOK COMERCIAL / WHATSAPP</div>
          <div className="outreach-hero-grid">
            <div><h2>Uma boa venda começa com uma <em>boa abordagem.</em></h2><p>Prepare seu vídeo, personalize a conversa e acompanhe cada próximo passo.</p></div>
            <div className="outreach-hero-icon" aria-hidden="true"><MessageCircle size={38}/><ArrowRight size={18}/></div>
          </div>
          <div className="outreach-mini-flow"><span className={current>=1?'completed':''}>01 Vídeo</span><i/><span className={current>=2?'completed':''}>02 Mensagem</span><i/><span className={current>=3?'completed':''}>03 Retorno</span></div>
        </div>
        <div className="outreach-body">
          <div className="outreach-lead"><div className="outreach-lead-avatar">{(lead.name||'L').trim().slice(0,2).toUpperCase()}</div><div><span>OPORTUNIDADE SELECIONADA</span><strong>{lead.name}</strong><small>{lead.company || 'Contato comercial'}</small></div><span className="outreach-status">{labels[status] || labels.nao_iniciado}</span></div>

          <div className="outreach-cells">
            <div><span>01 · PRODUTO</span><strong>{product?.name || 'Produto não informado'}</strong></div>
            <div><span>02 · ENCONTRADO EM</span><strong>{lead.source || 'Não informado'}</strong></div>
            <div><span>03 · WHATSAPP</span><strong>{lead.phone || 'Número não informado'}</strong></div>
          </div>

          <section className="outreach-step">
            <div className="outreach-step-title"><span className="outreach-step-index">01</span><div><div className="outreach-overline">PRIMEIRO CONTATO</div><h3>Apresente o vídeo.</h3></div><Film size={21}/></div>
            <p className="outreach-explain">Selecione o vídeo do produto ou um arquivo do seu computador. O vídeo é anexado e enviado manualmente no WhatsApp, antes da mensagem.</p>
            <div className="outreach-media">
              <div className="outreach-media-icon"><PlayCircle size={27}/></div>
              <div className="outreach-media-detail">
                <strong>{localVideo ? localVideo.name : validVideoUrl ? 'Vídeo vinculado a ' + product.name : 'Nenhum vídeo selecionado'}</strong>
                <span>{localVideo ? 'Arquivo temporário neste navegador' : validVideoUrl ? 'Biblioteca de vídeos do produto' : 'Configure a URL no cadastro do produto ou escolha um arquivo'}</span>
              </div>
              {validVideoUrl && !localVideo && <a className="outreach-icon-button" href={url} target="_blank" rel="noreferrer" title="Abrir vídeo" aria-label="Abrir vídeo"><ExternalLink size={17}/></a>}
            </div>
            {preview && <video controls preload="metadata" className="outreach-video-preview" src={preview} aria-label="Prévia do vídeo selecionado"/>}
            <div className="outreach-actions-wrap">
              <label className="outreach-secondary outreach-file"><Paperclip size={16}/> Escolher vídeo local <input type="file" accept="video/*" onChange={e=>setLocalVideo(e.target.files?.[0] || null)} /></label>
              {validVideoUrl && <button type="button" className="outreach-secondary" onClick={copyLink}><Link2 size={16}/> Copiar link do vídeo</button>}
              <button type="button" className="outreach-secondary" onClick={()=>openWhatsApp(false)} disabled={!validNumber}><MessageCircle size={16}/> Abrir WhatsApp para anexar</button>
            </div>
            <div className="outreach-confirm"><div><strong>Já enviou o vídeo no WhatsApp?</strong><span>Marque somente depois de confirmar o envio na conversa.</span></div><button type="button" disabled={saving||current>=1} onClick={()=>updateStatus('video_enviado','Vídeo enviado ao cliente pelo WhatsApp (confirmação manual).')} className={'outreach-confirm-button '+(current>=1?'done':'')}>{current>=1?<><CheckCircle2 size={16}/> Confirmado</>:<><Check size={16}/> Marcar vídeo enviado</>}</button></div>
          </section>

          <section className="outreach-step">
            <div className="outreach-step-title"><span className="outreach-step-index">02</span><div><div className="outreach-overline">TEXTO PERSONALIZADO</div><h3>Continue a conversa.</h3></div><MessageCircle size={21}/></div>
            <p className="outreach-explain">A mensagem usa os campos do lead. Ajuste o texto, copie ou abra o WhatsApp com tudo preenchido.</p>
            <label htmlFor="outreach-message" className="outreach-text-label">MENSAGEM PARA {lead.company || lead.name}</label>
            <textarea id="outreach-message" className="outreach-message" rows={8} maxLength={2700} value={text} onChange={e=>{setText(e.target.value);setDraftSaved(false);setIsEdited(true);}}/>
            <div className="outreach-message-foot"><span>{text.length} / 2700 caracteres {draftSaved?'· Salvo':'· Alterações não salvas'}</span><div className="outreach-actions-wrap">
              <button type="button" className="outreach-secondary" onClick={()=>{setText(initialDraft(lead,product));setDraftSaved(false);setIsEdited(false);}}><Sparkles size={16}/> Gerar novamente</button>
              <button type="button" className="outreach-secondary" disabled={saving||!text.trim()||draftSaved} onClick={saveDraft}><Save size={15}/> Salvar texto</button>
            </div></div>
            <div className="outreach-action-pair">
              <button type="button" className="outreach-secondary" onClick={copyText} disabled={!text.trim()}><Clipboard size={16}/> Copiar mensagem</button>
              <button type="button" className="outreach-primary" onClick={()=>openWhatsApp(true)} disabled={!validNumber||!text.trim()}><MessageCircle size={18}/> Abrir WhatsApp com mensagem <ArrowRight size={18}/></button>
            </div>
            <div className="outreach-confirm"><div><strong>Mensagem realmente enviada?</strong><span>A abertura da conversa não significa que a mensagem foi enviada.</span></div><button type="button" disabled={saving||current>=2} onClick={()=>updateStatus('mensagem_enviada','Mensagem de prospecção enviada ao cliente (confirmação manual):\n' + text)} className={'outreach-confirm-button '+(current>=2?'done':'')}>{current>=2?<><CheckCircle2 size={16}/> Confirmado</>:<><Check size={16}/> Marcar enviada</>}</button></div>
          </section>

          <section className="outreach-step outreach-last">
            <div className="outreach-step-title"><span className="outreach-step-index">03</span><div><div className="outreach-overline">PRÓXIMO PASSO</div><h3>Não deixe esfriar.</h3></div><CalendarDays size={21}/></div>
            <p className="outreach-explain">Após enviar, marque que está aguardando resposta e escolha quando quer fazer o próximo contato.</p>
            <button type="button" disabled={saving||current<2||current>=3} onClick={()=>updateStatus('aguardando_resposta','Aguardando retorno do cliente após abordagem pelo WhatsApp.')} className={'outreach-waiting '+(current>=3?'done':'')}><Clock3 size={18}/>{current>=3?'Acompanhamento em andamento':'Marcar aguardando resposta'} {current>=3&&<Check size={17}/>}</button>
            <div className="outreach-followup"><label htmlFor="outreach-follow-date">DATA DO PRÓXIMO CONTATO</label><div><input id="outreach-follow-date" type="date" min={dateISO()} value={followUp} onChange={e=>setFollowUp(e.target.value)}/><button type="button" onClick={saveFollowUp} disabled={!followUp||saving||followUp===lead.next_follow_up}><CalendarDays size={16}/> Agendar retorno</button></div></div>
            {current>=3 && <button className="outreach-replied" type="button" disabled={saving||status==='respondeu'} onClick={()=>updateStatus('respondeu','Cliente respondeu à abordagem por WhatsApp (confirmação manual).')}><CheckCircle2 size={17}/>{status==='respondeu'?'Resposta registrada':'O cliente respondeu? Registrar resposta'}</button>}
          </section>
          {notice&&<div role="status" className="outreach-notice">{notice}</div>}
          <div className="outreach-disclaimer"><LockKeyhole size={15}/> Preparação sem API paga. Arquivos locais não são enviados nem armazenados pelo CRM. Você confirma manualmente cada envio no WhatsApp.</div>
        </div>
      </div>
    </section>
  </div>;
}
