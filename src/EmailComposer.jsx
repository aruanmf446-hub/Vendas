import React, { useEffect, useState } from 'react';
import { Check, Clipboard, ExternalLink, Mail, ShieldAlert, X } from 'lucide-react';
import { supabase } from './supabase';
import './email-composer.css';

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());
const makeDraft = (lead, product) => {
  const clinic = (lead.company||lead.name||'sua clínica').trim();
  const productName = product?.name || 'site profissional';
  const confirmedNoWebsite = lead.website_not_found === true;
  return {
    subject: 'Uma ideia para '+clinic,
    body: 'Olá, equipe da '+clinic+'! Tudo bem?\n\n'+
      'Sou da CRM Plus Store, especializada em sites e soluções digitais profissionais.\n\n'+
      (confirmedNoWebsite ? 'Pesquisei a presença digital da clínica e não identifiquei um site próprio. ' : '')+
      'Gostaria de apresentar uma proposta de '+productName.toLowerCase()+' personalizada para a clínica, com seus serviços, informações de contato e identidade visual.\n\n'+
      'Já preparei uma demonstração do nosso trabalho. Posso encaminhar?\n\n'+
      'Atenciosamente,\nCRM Plus Store\nhttps://crmplus.store'
  };
};

export default function EmailComposer({ lead, product, userId, onClose, onRefresh, onNotify }) {
  const storageKey = 'crmplus-email-individual-'+userId+'-'+lead.id;
  const [draft, setDraft] = useState(() => {
    const original = makeDraft(lead, product);
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey)||'null');
      return saved && typeof saved.subject==='string' && typeof saved.body==='string'
        ? { subject:saved.subject, body:saved.body } : original;
    } catch { return original; }
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const email = (lead.email||'').trim();
  const blocked = !!lead.email_opt_out_at;
  const usable = validEmail(email) && !blocked;
  const complete = draft.subject.trim().length>=2 && draft.body.trim().length>=10;
  const ready = usable && complete;
  // Link HTTPS direto para o composer do Gmail: nao depende de cliente mailto instalado.
  const gmailUrl = ready ? 'https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(email)+'&su='+encodeURIComponent(draft.subject.trim())+'&body='+encodeURIComponent(draft.body.trim()) : '';

  useEffect(() => {
    const keydown = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose]);
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(draft)); } catch {}
  }, [draft.subject, draft.body, storageKey]);

  const update = (key, value) => {
    setDraft(old => ({...old, [key]:value}));
    setFeedback('');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText('Para: '+email+'\nAssunto: '+draft.subject+'\n\n'+draft.body);
      setFeedback('Mensagem copiada. Nenhum e-mail foi enviado pelo CRM.');
    } catch { setFeedback('A cópia não está disponível neste navegador.'); }
  };
  const openGmail = () => {
    if (!ready) return;
    setFeedback('Link do Gmail aberto em nova aba. Confira a conta conectada, revise e clique em Enviar no Gmail. Depois registre aqui no CRM.');
  };
  const confirm = async () => {
    if (!ready || saving) return;
    if (!window.confirm('Confirma que você já enviou o e-mail para '+email+' pelo Hostinger, Gmail ou outro serviço? Isso registra uma confirmação manual, não uma entrega verificada.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('crm_activities').insert({
        owner_id:userId,
        lead_id:lead.id,
        kind:'email',
        content:('Envio individual confirmado manualmente pelo operador para '+email+'. Assunto: '+draft.subject.trim()+'. O CRM não verificou a entrega.').slice(0,2900)
      });
      if (error) throw error;
      await onRefresh(true);
      onNotify?.('E-mail marcado como enviado e registrado no histórico do lead.');
      onClose();
    } catch (error) {
      setFeedback('Não foi possível registrar: '+(error.message||'Erro desconhecido.'));
    } finally { setSaving(false); }
  };
  const reset = () => {
    if (!window.confirm('Restaurar o texto padrão para este lead?')) return;
    setDraft(makeDraft(lead,product));
    setFeedback('Modelo restaurado.');
  };

  return <div className="email-compose-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="email-compose-dialog" role="dialog" aria-modal="true" aria-label={'Enviar e-mail para '+(lead.company||lead.name)}>
      <header className="email-compose-header">
        <div className="email-compose-header-title"><span><Mail size={19}/></span><div><small>CRM PLUS VENDAS / CONTATO INDIVIDUAL</small><h2>Enviar e-mail</h2></div></div>
        <button type="button" onClick={onClose} className="email-compose-close" aria-label="Fechar"><X size={19}/></button>
      </header>
      <div className="email-compose-scroll">
        <div className="email-compose-recipient">
          <span className="email-compose-avatar">{(lead.company||lead.name||'?').trim().slice(0,2).toUpperCase()}</span>
          <div><small>DESTINATÁRIO</small><strong>{lead.company||lead.name}</strong><span>{email||'Nenhum endereço de e-mail cadastrado'}</span></div>
        </div>
        {blocked && <div className="email-compose-warning"><ShieldAlert size={18}/> Este contato solicitou não receber comunicações. O envio está desabilitado.</div>}
        {!validEmail(email) && <div className="email-compose-warning"><ShieldAlert size={18}/> Cadastre um endereço válido no lead antes de preparar a mensagem.</div>}
        <div className="email-compose-editor">
          <label><span>Assunto</span><input type="text" maxLength={240} value={draft.subject} onChange={event=>update('subject',event.target.value)} placeholder="Assunto do e-mail"/></label>
          <label><span>Mensagem personalizada</span><textarea rows={12} maxLength={6000} value={draft.body} onChange={event=>update('body',event.target.value)} placeholder="Escreva a mensagem para a clínica..."/></label>
          <div className="email-compose-editor-foot"><span>Rascunho salvo neste navegador · {draft.body.length}/6000 caracteres</span><button type="button" onClick={reset}>Restaurar modelo</button></div>
        </div>
        <div className="email-compose-instruction"><Mail size={17}/><p>Se já enviou pelo <strong>Hostinger</strong> ou outro serviço, clique em <strong>Já enviei · registrar</strong> para sinalizar no CRM. <strong>Abrir no Gmail</strong> abre uma nova aba do Gmail com destinatário, assunto e texto preenchidos. Escolha sua conta, revise e clique em <strong>Enviar</strong> no Gmail. Nada é disparado automaticamente pelo CRM. Caso uma extensão bloqueie a nova aba, use o link <strong>Abrir na mesma aba</strong> abaixo.</p></div>
        {feedback && <div className="email-compose-feedback" role="status">{feedback}</div>}
      </div>
      <footer className="email-compose-footer">
        <button className="email-compose-secondary" type="button" onClick={copy} disabled={!validEmail(email)||!complete}><Clipboard size={16}/> Copiar texto</button>
        <button className="email-compose-secondary email-compose-confirm" type="button" onClick={confirm} disabled={saving||!ready} title="Registre o e-mail que você já enviou pelo Hostinger, Gmail ou outro serviço"><Check size={16}/>{saving?'Registrando...':'Já enviei · registrar'}</button>
        {ready && !saving
          ? <a className="email-compose-primary" href={gmailUrl} target="_blank" rel="noopener noreferrer" onClick={openGmail}><Mail size={17}/> Abrir no Gmail <ExternalLink size={15}/></a>
          : <button className="email-compose-primary" type="button" disabled><Mail size={17}/> Abrir no Gmail <ExternalLink size={15}/></button>}
        {ready && <a className="email-compose-same-tab" href={gmailUrl} onClick={openGmail} title="Abrir o Gmail na aba atual se a nova aba nao abrir">Abrir na mesma aba</a>}
      </footer>
    </section>
  </div>;
}
