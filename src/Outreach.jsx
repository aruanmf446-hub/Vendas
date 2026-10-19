import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clipboard, Clock3, Download, ExternalLink, Film, Globe2, Link2, LockKeyhole, MessageCircle, Paperclip, PlayCircle, Save, Send, Share2, Sparkles, Upload, X } from 'lucide-react';
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
  const source = (lead.source || '').trim();
  const foundAt = ({
    google: 'no Google',
    instagram: 'no Instagram',
    facebook: 'no Facebook',
    linkedin: 'no LinkedIn',
    whatsapp: 'no WhatsApp',
    site: 'na internet'
  })[source.toLocaleLowerCase('pt-BR')] || (source && source !== 'Indicação' ? 'por meio de ' + source : 'por indicação');
  const template = (product?.outreach_template || '').trim();
  if (template) return template
    .replace(/\{cliente\}/gi, company)
    .replace(/\{produto\}/gi, offer)
    .replace(/\{origem\}/gi, source || 'Indicação')
    .slice(0, 2700);
  const isDentistSite = /dentista|odontol[oó]g|cl[ií]nica odontol/i.test(offer);
  const research = 'Pesquisei aqui e encontrei a ' + company + ' ' + foundAt;
  const websiteNote = lead.website_not_found
    ? ', porém não identifiquei nenhum site de vocês e gostaria de apresentar uma solução para fortalecer a presença digital de vocês.'
    : ' e gostaria de apresentar uma solução para fortalecer a presença digital de vocês.';
  if (isDentistSite) {
    return [
      'Olá, bom dia! Tudo bem? 😊',
      'Sou da CRM Plus Store, trabalho com desenvolvimento de sites profissionais.',
      research + websiteNote,
      'Desenvolvemos um modelo de site exclusivo para clínicas odontológicas, que personalizamos com a identidade visual, fotos, tratamentos e informações de cada clínica.',
      'Posso enviar uma demonstração rápida para vocês conhecerem? Sem compromisso.'
    ].join('\n\n');
  }
  return [
    'Olá, bom dia! Tudo bem? 😊',
    'Sou da CRM Plus Store, trabalho com desenvolvimento de soluções digitais profissionais.',
    research + (lead.website_not_found ? websiteNote : ' e gostaria de apresentar ' + offer + '.'),
    'Trabalhamos com ' + offer + ', com uma proposta personalizada para a identidade e as necessidades de cada empresa.',
    'Posso enviar uma demonstração rápida para vocês conhecerem? Sem compromisso.'
  ].join('\n\n');
};
// Reutiliza o arquivo escolhido para outros leads do mesmo produto enquanto a aba estiver aberta.
const selectedVideos = new Map();
const isVideoFile = file => !!file && (file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogg)$/i.test(file.name));
const isDirectVideoUrl = url => /\.(mp4|m4v|webm|ogg)(?:[?#]|$)/i.test(url);
const dateISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function Outreach({ lead, product, onClose, onRefresh, onNotify, userId }) {
  const [text, setText] = useState(() => lead.outreach_message || initialDraft(lead, product));
  const [status, setStatus] = useState(lead.outreach_status || 'nao_iniciado');
  const [followUp, setFollowUp] = useState(lead.next_follow_up || '');
  const videoKey = product?.id || 'sem-produto';
  const [localVideo, setLocalVideo] = useState(() => selectedVideos.get(videoKey) || null);
  const [preview, setPreview] = useState('');
  const [videoError, setVideoError] = useState('');
  const [mediaInstruction, setMediaInstruction] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [draftSaved, setDraftSaved] = useState(true);
  const [websiteNotFound, setWebsiteNotFound] = useState(!!lead.website_not_found);
  const number = whatsNumber(lead.phone);
  const validNumber = digitsOnly(lead.phone).length >= 10 && digitsOnly(lead.phone).length <= 13;
  const url = (product?.video_url || '').trim();
  const validVideoUrl = /^https:\/\//i.test(url);
  const videoSource = preview || (validVideoUrl && isDirectVideoUrl(url) ? url : '');
  const canShareVideo = !!localVideo && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [localVideo] });
  const current = STAGES[status] ?? 0;

  // O webhook pode atualizar o status enquanto a abordagem estiver aberta.
  useEffect(() => { setStatus(lead.outreach_status || 'nao_iniciado'); }, [lead.outreach_status]);

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
  const updateWebsiteFinding = async checked => {
    if (saving) return;
    setSaving(true);
    setNotice('');
    try {
      const { error } = await supabase.from('crm_leads')
        .update({ website_not_found: checked, updated_at: new Date().toISOString() })
        .eq('id', lead.id).eq('owner_id', userId);
      if (error) throw error;
      setWebsiteNotFound(checked);
      // Explicitly regenerate: do not silently claim the clinic has no site.
      setText(initialDraft({ ...lead, website_not_found: checked }, product));
      setDraftSaved(false);
      await onRefresh();
      setNotice(checked
        ? 'Pesquisa confirmada. O novo texto inclui que você não identificou site para esta clínica.'
        : 'Texto atualizado sem a afirmação sobre ausência de site.');
    } catch (error) {
      setNotice('Não foi possível salvar a confirmação: ' + error.message);
    } finally {
      setSaving(false);
    }
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
    if (withText && current < 1) { setNotice('Envie e confirme o vídeo primeiro. Depois abra a conversa com a mensagem.'); return; }
    const href = 'https://wa.me/' + number + (withText ? '?text=' + encodeURIComponent(text.trim()) : '');
    window.open(href, '_blank', 'noopener,noreferrer');
    setNotice(withText ? 'A conversa foi aberta com a mensagem preenchida. Confirme o envio no WhatsApp e depois marque a etapa.' : 'A conversa foi aberta. Anexe o vídeo diretamente no WhatsApp e confirme o envio antes de marcar a etapa.');
  };
  const chooseVideo = file => {
    if (!file) return;
    if (!isVideoFile(file)) {
      setVideoError('Escolha um vídeo MP4, MOV ou WebM. Este arquivo não foi reconhecido como vídeo.');
      return;
    }
    selectedVideos.set(videoKey, file);
    setLocalVideo(file);
    setVideoError('');
    setMediaInstruction('Vídeo selecionado. No celular use Compartilhar vídeo; no computador anexe o arquivo pelo WhatsApp Web.');
  };
  const removeVideo = () => {
    selectedVideos.delete(videoKey);
    setLocalVideo(null);
    setVideoError('');
    setMediaInstruction('');
  };
  const downloadVideo = () => {
    if (localVideo) {
      const objectUrl = URL.createObjectURL(localVideo);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = localVideo.name || 'video-de-apresentacao.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setMediaInstruction('O vídeo foi preparado para download. No WhatsApp Web, clique no + (anexar), selecione Fotos e vídeos e escolha o arquivo baixado.');
      return;
    }
    if (validVideoUrl) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setMediaInstruction('Abra o vídeo no link e salve o arquivo MP4 antes de anexá-lo no WhatsApp. O link não envia o arquivo automaticamente.');
    }
  };
  const shareVideo = async () => {
    if (!canShareVideo) {
      setMediaInstruction('Este navegador não oferece compartilhamento direto de arquivos. Baixe o vídeo e anexe manualmente no WhatsApp.');
      return;
    }
    try {
      await navigator.share({ files: [localVideo], title: 'Vídeo de apresentação' });
      setMediaInstruction('O compartilhamento foi aberto. Confirme o envio do arquivo na conversa do WhatsApp antes de marcar esta etapa como enviada.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setMediaInstruction('Não foi possível compartilhar o arquivo por este dispositivo. Use Baixar vídeo e anexe-o manualmente no WhatsApp.');
      }
    }
  };
  const openVideoWhatsApp = () => {
    if (!validNumber) { setMediaInstruction('Confira o número do WhatsApp no cadastro do lead.'); return; }
    const href = 'https://wa.me/' + number;
    window.open(href, '_blank', 'noopener,noreferrer');
    setMediaInstruction('O WhatsApp foi solicitado em uma nova aba. Se não abrir, permita pop-ups. Na conversa, clique em + (anexar) → Fotos e vídeos, escolha o MP4 e confirme o envio. Só depois marque Vídeo enviado.');
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
            <p className="outreach-explain">Selecione e confira o vídeo. No celular, compartilhe o arquivo pelo menu do aparelho; no computador, anexe o MP4 manualmente na conversa do WhatsApp antes da mensagem.</p>
            <div className="outreach-media">
              <div className="outreach-media-icon"><PlayCircle size={27}/></div>
              <div className="outreach-media-detail">
                <strong>{localVideo ? localVideo.name : validVideoUrl ? 'Vídeo vinculado a ' + product.name : 'Nenhum vídeo selecionado'}</strong>
                <span>{localVideo ? 'Arquivo selecionado · ' + (localVideo.size / (1024 * 1024)).toFixed(1) + ' MB · disponível nesta aba' : validVideoUrl ? 'Vídeo do produto · salve o arquivo para anexar no WhatsApp' : 'Selecione um MP4 ou configure um link direto no produto'}</span>
              </div>
              {validVideoUrl && !localVideo && <a className="outreach-icon-button" href={url} target="_blank" rel="noreferrer" title="Abrir vídeo" aria-label="Abrir vídeo"><ExternalLink size={17}/></a>}
            </div>
            {videoSource && <video key={videoSource} controls playsInline preload="metadata" className="outreach-video-preview"
              src={videoSource} aria-label="Prévia do vídeo selecionado"
              onLoadedMetadata={()=>setVideoError('')}
              onError={()=>setVideoError('Não foi possível reproduzir o vídeo neste navegador. Experimente um MP4 com vídeo H.264 e áudio AAC. Você ainda pode baixar e anexar o arquivo.')}/>}
            {videoError && <div className="outreach-video-error" role="alert">{videoError}</div>}
            <div className="outreach-video-help">
              <strong>O WhatsApp não anexa arquivos pelo link de abertura da conversa.</strong>
              <span>Envie o arquivo MP4, não o endereço do CRM. No computador: baixe o vídeo, abra o WhatsApp e anexe em <b>+ → Fotos e vídeos</b>. No celular: use o compartilhamento do aparelho, quando disponível.</span>
            </div>
            <div className="outreach-actions-wrap outreach-video-actions">
              <label className="outreach-secondary outreach-file"><Paperclip size={16}/> {localVideo ? 'Trocar vídeo' : 'Escolher arquivo'} <input type="file" accept="video/*,.mp4,.m4v,.mov,.webm" onChange={e=>{ chooseVideo(e.target.files?.[0]); e.target.value=''; }} /></label>
              {localVideo && <button type="button" className="outreach-secondary" onClick={removeVideo}><X size={15}/> Remover</button>}
              {(localVideo || validVideoUrl) && <button type="button" className="outreach-secondary" onClick={downloadVideo}><Download size={16}/> {localVideo ? 'Baixar vídeo' : 'Abrir / baixar vídeo'}</button>}
              {canShareVideo && <button type="button" className="outreach-share-video" onClick={shareVideo}><Share2 size={16}/> Compartilhar arquivo</button>}
              <button type="button" className="outreach-share-video" onClick={openVideoWhatsApp} disabled={!validNumber}><MessageCircle size={16}/> Abrir WhatsApp</button>
            </div>
            {mediaInstruction && <div className="outreach-video-instruction" role="status">{mediaInstruction}</div>}
            {!localVideo && validVideoUrl && <div className="outreach-video-link-hint">O link do produto só abre o arquivo; não o envia como mídia. {isDirectVideoUrl(url) ? 'Confira a prévia acima.' : 'Para mostrar uma prévia, use uma URL direta para MP4/WebM ou selecione um arquivo local.'}</div>}
            <div className="outreach-confirm"><div><strong>Já enviou o vídeo no WhatsApp?</strong><span>Marque somente depois de confirmar o envio na conversa.</span></div><button type="button" disabled={saving||current>=1} onClick={()=>updateStatus('video_enviado','Vídeo enviado ao cliente pelo WhatsApp (confirmação manual).')} className={'outreach-confirm-button '+(current>=1?'done':'')}>{current>=1?<><CheckCircle2 size={16}/> Confirmado</>:<><Check size={16}/> Marcar vídeo enviado</>}</button></div>
          </section>

          <section className="outreach-step">
            <div className="outreach-step-title"><span className="outreach-step-index">02</span><div><div className="outreach-overline">TEXTO PERSONALIZADO</div><h3>Continue a conversa.</h3></div><MessageCircle size={21}/></div>
            <p className="outreach-explain">A mensagem usa os campos do lead. Ajuste o texto, copie ou abra o WhatsApp com tudo preenchido.</p>
            <label className="outreach-website-checkbox"><input type="checkbox" checked={websiteNotFound} disabled={saving} onChange={e=>updateWebsiteFinding(e.target.checked)}/><span><strong>Não identifiquei site da clínica na pesquisa</strong><small>Marque somente se você conferiu. A mensagem será atualizada com essa informação.</small></span></label>
            <label htmlFor="outreach-message" className="outreach-text-label">MENSAGEM PARA {lead.company || lead.name}</label>
            <textarea id="outreach-message" className="outreach-message" rows={8} maxLength={2700} value={text} onChange={e=>{setText(e.target.value);setDraftSaved(false);}}/>
            <div className="outreach-message-foot"><span>{text.length} / 2700 caracteres {draftSaved?'· Salvo':'· Alterações não salvas'}</span><div className="outreach-actions-wrap">
              <button type="button" className="outreach-secondary" onClick={()=>{setText(initialDraft({ ...lead, website_not_found: websiteNotFound },product));setDraftSaved(false);}}><Sparkles size={16}/> Gerar novamente</button>
              <button type="button" className="outreach-secondary" disabled={saving||!text.trim()||draftSaved} onClick={saveDraft}><Save size={15}/> Salvar texto</button>
            </div></div>
            <div className="outreach-action-pair">
              <button type="button" className="outreach-secondary" onClick={copyText} disabled={!text.trim()}><Clipboard size={16}/> Copiar mensagem</button>
              <button type="button" className="outreach-primary" onClick={()=>openWhatsApp(true)} disabled={!validNumber||!text.trim()||current<1}><MessageCircle size={18}/> Abrir WhatsApp com mensagem <ArrowRight size={18}/></button>
            </div>
            {current<1 && <p className="outreach-lock-note"><LockKeyhole size={14}/> Confirme primeiro o envio do vídeo na etapa 01.</p>}
            <div className="outreach-confirm"><div><strong>Mensagem realmente enviada?</strong><span>A abertura da conversa não significa que a mensagem foi enviada.</span></div><button type="button" disabled={saving||current<1||current>=2} onClick={()=>updateStatus('mensagem_enviada','Mensagem de prospecção enviada ao cliente (confirmação manual):\n' + text)} className={'outreach-confirm-button '+(current>=2?'done':'')}>{current>=2?<><CheckCircle2 size={16}/> Confirmado</>:<><Check size={16}/> Marcar enviada</>}</button></div>
          </section>

          <section className="outreach-step outreach-last">
            <div className="outreach-step-title"><span className="outreach-step-index">03</span><div><div className="outreach-overline">PRÓXIMO PASSO</div><h3>Não deixe esfriar.</h3></div><CalendarDays size={21}/></div>
            <p className="outreach-explain">Após enviar, marque que está aguardando resposta e escolha quando quer fazer o próximo contato.</p>
            <button type="button" disabled={saving||current<2||current>=3} onClick={()=>updateStatus('aguardando_resposta','Aguardando retorno do cliente após abordagem pelo WhatsApp.')} className={'outreach-waiting '+(current>=3?'done':'')}><Clock3 size={18}/>{current>=3?'Acompanhamento em andamento':'Marcar aguardando resposta'} {current>=3&&<Check size={17}/>}</button>
            <div className="outreach-followup"><label htmlFor="outreach-follow-date">DATA DO PRÓXIMO CONTATO</label><div><input id="outreach-follow-date" type="date" min={dateISO()} value={followUp} onChange={e=>setFollowUp(e.target.value)}/><button type="button" onClick={saveFollowUp} disabled={!followUp||saving||followUp===lead.next_follow_up}><CalendarDays size={16}/> Agendar retorno</button></div></div>
            {current>=3 && <button className="outreach-replied" type="button" disabled={saving||status==='respondeu'} onClick={()=>updateStatus('respondeu','Cliente respondeu à abordagem por WhatsApp (confirmação manual).')}><CheckCircle2 size={17}/>{status==='respondeu'?'Resposta registrada':'O cliente respondeu? Registrar resposta'}</button>}
          </section>
          {notice&&<div role="status" className="outreach-notice">{notice}</div>}
          <div className="outreach-disclaimer"><LockKeyhole size={15}/> O envio só é confirmado por você no WhatsApp. O CRM não envia mídia automaticamente, não publica o vídeo e não armazena arquivos locais no Supabase. O arquivo escolhido fica disponível somente enquanto esta aba estiver aberta.</div>
        </div>
      </div>
    </section>
  </div>;
}
