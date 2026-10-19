import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, Clipboard, Clock3, Eye, FilePlus2, Inbox, LockKeyhole, Mail, PauseCircle, Plus, Save, Search, Send, Settings2, ShieldCheck, Sparkles, UsersRound, X } from 'lucide-react';
import { supabase } from './supabase';
import './campaigns.css';

const newCampaign = { name:'Apresentação de site para clínicas', subject:'Uma ideia para {clinica}', body:'Olá, equipe da {clinica}! Tudo bem?\n\nSou da CRM Plus Store. Desenvolvemos sites profissionais personalizados para clínicas e empresas.\n\nGostaria de apresentar uma demonstração do nosso trabalho para vocês. Posso encaminhar?\n\nAtenciosamente,\nCRM Plus Store\nhttps://crmplus.store', status:'draft' };
const emailValid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email||'').trim());
const eligible = lead => emailValid(lead.email) && !!lead.email_consent_at && !lead.email_opt_out_at && !['perdido'].includes(lead.stage);
const firstName = lead => (lead.name||'').trim().split(/\s+/)[0] || 'Olá';
const mapText = (text, lead, products) => {
  const product = products.find(p=>p.id===lead?.product_id);
  const dict = {
    nome: firstName(lead||{}),
    clinica: lead?.company || lead?.name || 'sua clínica',
    empresa: lead?.company || lead?.name || 'sua empresa',
    produto: product?.name || 'nosso serviço',
    origem: lead?.source || 'nosso contato'
  };
  return (text||'').replace(/\{(nome|clinica|empresa|produto|origem)\}/gi, (matched,key)=>dict[key.toLowerCase()]||matched);
};
const fmtDate = v => v ? new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—';

export default function Campaigns({ leads, products, user, onRefresh, selectedLeadId }) {
  const [all, setAll] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [form, setForm] = useState(newCampaign);
  const [targets, setTargets] = useState([]);
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({done:0,total:0});
  const [permissionId, setPermissionId] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [manualPreparedLeadId, setManualPreparedLeadId] = useState(null);
  const [manualSaving, setManualSaving] = useState(false);

  const reload = async () => {
    const [c,d] = await Promise.all([
      supabase.from('crm_email_campaigns').select('*').order('updated_at',{ascending:false}),
      supabase.from('crm_email_deliveries').select('*').order('created_at',{ascending:false}).limit(600)
    ]);
    if (c.error || d.error) {
      setNotice('Não foi possível carregar as campanhas. Confira a migração do Supabase. ' + (c.error||d.error).message);
      return;
    }
    setAll(c.data||[]);
    setDeliveries(d.data||[]);
  };
  useEffect(()=>{ if(user?.id) reload(); },[user?.id]);

  useEffect(()=>{
    if (selectedLeadId) {
      setTargets(old=>old.includes(selectedLeadId)?old:[...old,selectedLeadId]);
      setPreviewId(selectedLeadId);
    }
  },[selectedLeadId]);
  const usable = useMemo(()=>leads.filter(l=>l.email && emailValid(l.email)),[leads]);
  const shown = useMemo(()=>usable.filter(l=>(l.name+' '+(l.company||'')+' '+l.email).toLowerCase().includes(search.toLowerCase())),[usable,search]);
  const selected = targets.map(id=>leads.find(l=>l.id===id)).filter(Boolean);
  const ready = selected.filter(eligible);
  const previewLead = leads.find(l=>l.id===previewId) || selected[0] || usable[0];
  const deliveredIds = new Set(deliveries.filter(d=>d.campaign_id===currentId && ['pending','sent'].includes(d.status)).map(d=>d.lead_id));
  const toSend = ready.filter(l=>!deliveredIds.has(l.id));
  const delivered = deliveries.filter(d=>d.campaign_id===currentId);

  const update = (key,val)=>setForm(f=>({...f,[key]:val}));
  const open = item => {
    setCurrentId(item.id);
    setForm({name:item.name,subject:item.subject,body:item.body,status:item.status});
    setTargets(item.lead_ids||[]);
    setPreviewId((item.lead_ids||[])[0]||'');
    setNotice('');
  };
  const create = () => {setCurrentId(null);setForm({...newCampaign});setTargets([]);setPreviewId('');setNotice('Nova campanha pronta para edição.');};
  const persist = async status => {
    if (!form.name.trim() || form.subject.trim().length<2 || form.body.trim().length<10) {
      setNotice('Preencha o nome, assunto e a mensagem antes de salvar.');
      return null;
    }
    const payload = {
      owner_id:user.id, name:form.name.trim(), subject:form.subject.trim(),
      body:form.body.trim(), status:status||form.status||'draft', lead_ids:targets,
      updated_at:new Date().toISOString()
    };
    const request = currentId
      ? supabase.from('crm_email_campaigns').update(payload).eq('id',currentId).eq('owner_id',user.id).select().single()
      : supabase.from('crm_email_campaigns').insert(payload).select().single();
    const {data,error} = await request;
    if (error) throw error;
    setCurrentId(data.id);
    setForm({name:data.name,subject:data.subject,body:data.body,status:data.status});
    await reload();
    return data.id;
  };
  const save = async () => {
    if (pending || sending) return;
    setPending(true);setNotice('');
    try {if(await persist()) setNotice('Campanha e destinatários salvos no Supabase.');}
    catch(error){setNotice('Falha ao salvar: '+error.message);}
    finally{setPending(false);}
  };
  const consent = async lead => {
    if (!confirmed || evidence.trim().length<12) {
      setNotice('Registre como e quando este destinatário autorizou receber campanhas (mínimo de 12 caracteres).');
      return;
    }
    setPending(true);
    try {
      const {error} = await supabase.from('crm_leads').update({
        email_consent_at:new Date().toISOString(), email_consent_source:evidence.trim(), email_opt_out_at:null
      }).eq('id',lead.id).eq('owner_id',user.id);
      if (error) throw error;
      setPermissionId(null);setEvidence('');setConfirmed(false);
      await onRefresh();
      setNotice('Autorização registrada para '+lead.name+'.');
    } catch(error){setNotice('Falha ao registrar: '+error.message);}
    finally{setPending(false);}
  };
  const revoke = async lead => {
    if (!window.confirm('Impedir novos envios de campanha para '+lead.name+'?')) return;
    setPending(true);
    try {
      const {error}=await supabase.from('crm_leads').update({email_opt_out_at:new Date().toISOString()}).eq('id',lead.id).eq('owner_id',user.id);
      if(error) throw error;
      await onRefresh();
      setNotice('Lead excluído de futuros envios.');
    } catch(error){setNotice('Erro: '+error.message);}
    finally{setPending(false);}
  };
  const copy = async () => {
    const value = 'Assunto: '+mapText(form.subject,previewLead,products)+'\n\n'+mapText(form.body,previewLead,products);
    try {await navigator.clipboard.writeText(value);setNotice('Mensagem personalizada copiada. Nenhum e-mail foi disparado.');}
    catch{setNotice('Não foi possível copiar pelo navegador.');}
  };
  // O primeiro contato é preparado no aplicativo de e-mail do operador.
  // Nenhuma mensagem é enviada pelo Resend neste fluxo; não requer opt-in de marketing.
  const openMailApp = (lead = previewLead) => {
    if (!lead?.email || !emailValid(lead.email)) {setNotice('Escolha um lead com e-mail válido.');return;}
    if (lead.email_opt_out_at) {setNotice('Este contato solicitou não receber comunicações.');return;}
    if (form.subject.trim().length < 2 || form.body.trim().length < 10) {
      setNotice('Preencha o assunto e a mensagem antes de preparar o e-mail.');
      return;
    }
    const subject=mapText(form.subject,lead,products);
    const body=mapText(form.body,lead,products);
    setPreviewId(lead.id);
    setManualPreparedLeadId(lead.id);
    window.location.href='mailto:'+encodeURIComponent(lead.email.trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    setNotice('Rascunho aberto no aplicativo de e-mail. Confira e envie por lá; o CRM não enviou a mensagem.');
  };
  const confirmManualSent = async () => {
    const lead=leads.find(l=>l.id===manualPreparedLeadId);
    if (!lead || manualSaving) return;
    if (!window.confirm('Confirma que você enviou o e-mail para '+lead.email+' no aplicativo de e-mail? Abrir o rascunho não significa enviar.')) return;
    setManualSaving(true);
    try {
      const subject=mapText(form.subject,lead,products);
      const {error}=await supabase.from('crm_activities').insert({
        owner_id:user.id,lead_id:lead.id,kind:'email',
        content:('Envio individual confirmado manualmente pelo operador para '+lead.email+'. Assunto: '+subject+'. Não verificado automaticamente pelo CRM.').slice(0,2900)
      });
      if(error) throw error;
      setManualPreparedLeadId(null);
      await onRefresh();
      setNotice('Confirmação manual registrada no histórico de '+(lead.company||lead.name)+'.');
    }catch(error){setNotice('Não foi possível registrar o histórico: '+error.message);}
    finally{setManualSaving(false);}
  };
  const send = async () => {
    if (sending || pending) return;
    if (!toSend.length) {setNotice('Selecione ao menos um lead autorizado, ainda não incluído neste envio.');return;}
    if (toSend.length > 20) {setNotice('Selecione no máximo 20 destinatários por lote.');return;}
    if (!window.confirm('Enviar '+toSend.length+' e-mail(s) via Resend? Apenas contatos com autorização registrada.')) return;
    setSending(true);setNotice('Validando e iniciando envios...');setProgress({done:0,total:toSend.length});
    let ok=0,failed=0;
    try {
      const campaignId = await persist('ready');
      if(!campaignId) {setSending(false);return;}
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token) throw new Error('Sessão expirada. Entre novamente no CRM.');
      for(const lead of toSend) {
        try {
          const res=await fetch('/api/campaign-send',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
            body:JSON.stringify({campaignId,leadId:lead.id})
          });
          const json=await res.json().catch(()=>({}));
          if(!res.ok) throw new Error(json.error||'Erro HTTP '+res.status);
          ok++;
        } catch(error) {failed++;setNotice('Falha em '+lead.name+': '+error.message);}
        setProgress(prev=>({...prev,done:prev.done+1}));
        if (failed>0 && ok===0) break;
      }
      await reload();
      await onRefresh();
      setNotice('Envio concluído: '+ok+' aceito(s) pelo Resend, '+failed+' falha(s). Aceite não garante chegada à caixa de entrada.');
    } catch(error){setNotice('Campanha não enviada: '+error.message);}
    finally{setSending(false);}
  };
  return <div className="campaigns-page">
    <section className="page-intro campaigns-intro">
      <div><span className="eyebrow muted">CRM PLUS / RELACIONAMENTO</span><h1>Campanhas de <em>e-mail.</em></h1><p>Personalize cada mensagem, selecione os contatos e acompanhe a entrega no CRM.</p></div>
      <button className="btn btn-primary" type="button" onClick={create}><Plus size={17}/> Nova campanha</button>
    </section>
    <div className="campaigns-banner"><ShieldCheck size={20}/><div><strong>Dois caminhos de envio.</strong><span>Primeiro contato: prepare um e-mail individual para qualquer lead com e-mail válido, sem cadastrar autorização de campanha. Envio automático pelo Resend: exclusivo para contatos autorizados.</span></div></div>
    <div className="campaigns-metrics">
      <div><Mail size={18}/><strong>{all.length}</strong><span>campanhas salvas</span></div>
      <div><UsersRound size={18}/><strong>{usable.length}</strong><span>leads com e-mail</span></div>
      <div><ShieldCheck size={18}/><strong>{usable.filter(eligible).length}</strong><span>habilitados para campanhas</span></div>
      <div><CheckCircle2 size={18}/><strong>{deliveries.filter(d=>d.status==='sent').length}</strong><span>aceitos pelo Resend</span></div>
    </div>
    <section className="campaigns-first-contact" aria-label="Primeiro contato individual">
      <div className="campaigns-first-copy">
        <span className="campaigns-first-eyebrow">PRIMEIRO CONTATO / INDIVIDUAL</span>
        <h2>Comece a conversa, uma clínica por vez.</h2>
        <p>Sem exigir autorização cadastrada para preparar o primeiro e-mail. Escolha a clínica, personalize o texto e confirme o envio no aplicativo de e-mail. Nenhuma mensagem é enviada automaticamente pelo CRM neste modo.</p>
      </div>
      <div className="campaigns-first-actions">
        <label>Destinatário
          <select value={previewLead?.id||''} onChange={e=>{setPreviewId(e.target.value);setManualPreparedLeadId(null);}}>
            {usable.filter(l=>!l.email_opt_out_at).map(l=><option key={l.id} value={l.id}>{l.company||l.name} — {l.email}</option>)}
          </select>
        </label>
        <button type="button" className="campaigns-manual-send" disabled={!previewLead||!!previewLead.email_opt_out_at||sending} onClick={()=>openMailApp()}>
          <Mail size={18}/> Enviar individualmente <ArrowRight size={17}/>
        </button>
        <button type="button" className="campaigns-manual-confirm" disabled={!manualPreparedLeadId||manualSaving} onClick={confirmManualSent}>
          <CheckCircle2 size={16}/> {manualSaving?'Registrando...':'Já enviei: registrar no CRM'}
        </button>
        <small>Ao abrir o rascunho, o envio ainda depende da sua confirmação no aplicativo de e-mail.</small>
      </div>
    </section>
    <div className="campaigns-grid">
      <aside className="campaigns-history">
        <div className="campaigns-section-title"><div><span>01 / BIBLIOTECA</span><h2>Suas campanhas</h2></div><button type="button" className="campaigns-icon" onClick={create} aria-label="Nova campanha"><FilePlus2 size={18}/></button></div>
        {all.length?all.map(item=><button type="button" key={item.id} onClick={()=>open(item)} className={'campaigns-history-item'+(currentId===item.id?' chosen':'')}>
          <span className="campaigns-history-icon"><Mail size={18}/></span><span className="campaigns-history-copy"><strong>{item.name}</strong><small>{fmtDate(item.updated_at)} · {item.status==='ready'?'Pronta':item.status==='paused'?'Pausada':'Rascunho'}</small></span><ArrowRight size={15}/></button>):
          <div className="campaigns-empty">Comece pela sua primeira campanha. Os modelos ficam salvos para reutilização.</div>}
        <div className="campaigns-history-foot"><LockKeyhole size={15}/> Rascunhos e histórico privados da conta</div>
      </aside>
      <section className="campaigns-composer">
        <div className="campaigns-section-title"><div><span>02 / ESTÚDIO</span><h2>Editar mensagem</h2></div><div className="campaigns-draft-state"><span/> {currentId?'Salva anteriormente':'Nova campanha'}</div></div>
        <div className="campaigns-field-grid">
          <label><span>Nome interno da campanha</span><input maxLength={120} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Ex.: Sites odontológicos"/></label>
          <label><span>Assunto do e-mail</span><input maxLength={240} value={form.subject} onChange={e=>update('subject',e.target.value)} placeholder="Ex.: Conheça nossa proposta para {clinica}"/></label>
        </div>
        <label className="campaigns-label"><span>Texto personalizado</span><textarea rows={11} maxLength={12000} value={form.body} onChange={e=>update('body',e.target.value)} placeholder="Escreva sua mensagem aqui..."/></label>
        <div className="campaigns-variables"><span>Variáveis automáticas</span>{['{nome}','{clinica}','{empresa}','{produto}','{origem}'].map(v=><button type="button" key={v} onClick={()=>update('body',form.body+v)}>{v}</button>)}</div>
        <div className="campaigns-actions">
          <button className="btn btn-outline" type="button" onClick={copy}><Clipboard size={16}/> Copiar prévia</button>
          <button className="btn btn-outline" type="button" onClick={()=>openMailApp()} disabled={!previewLead||!!previewLead.email_opt_out_at}><Mail size={16}/> Preparar e-mail individual</button>
          <button className="btn btn-primary" type="button" onClick={save} disabled={pending||sending}><Save size={16}/>{pending?'Salvando...':'Salvar campanha'}</button>
        </div>
      </section>
    </div>
    <div className="campaigns-audience">
      <div className="campaigns-section-title"><div><span>03 / DESTINATÁRIOS</span><h2>Selecionar e revisar leads</h2></div><span className="campaigns-count">{targets.length} selecionado(s)</span></div>
      <div className="campaigns-audience-tools">
        <label><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar clínica ou e-mail"/></label>
        <button type="button" onClick={()=>setTargets(usable.filter(l=>!l.email_opt_out_at).map(l=>l.id))}><UsersRound size={16}/> Selecionar para revisar</button>
        <button type="button" onClick={()=>setTargets(usable.filter(eligible).map(l=>l.id))}><ShieldCheck size={16}/> Autorizados para Resend</button>
        <button type="button" onClick={()=>setTargets([])}><X size={15}/> Limpar seleção</button>
      </div>
      <div className="campaigns-lead-list">{shown.length ? shown.map(lead=>{
        const allowed=eligible(lead), selected=targets.includes(lead.id);
        return <div className={'campaigns-lead-row'+(selected?' selected':'')} key={lead.id}>
          <label className="campaigns-lead-name"><input type="checkbox" checked={selected} onChange={e=>setTargets(old=>e.target.checked?[...new Set([...old,lead.id])]:old.filter(id=>id!==lead.id))}/>
            <span><strong>{lead.company||lead.name}</strong><small>{lead.email}</small></span></label>
          <span className={'campaigns-permission '+(allowed?'yes':lead.email_opt_out_at?'off':'no')}>{allowed?'Autorizado':lead.email_opt_out_at?'Descadastrado':'Sem autorização'}</span>
          <div className="campaigns-lead-buttons">
            <button type="button" onClick={()=>setPreviewId(lead.id)} title="Prévia personalizada"><Eye size={16}/></button>
            <button type="button" onClick={()=>openMailApp(lead)} title="Preparar primeiro e-mail individual" aria-label={'Preparar primeiro e-mail para '+lead.name} disabled={!!lead.email_opt_out_at}><Mail size={16}/></button>
            {allowed?<button type="button" onClick={()=>revoke(lead)} title="Revogar permissão" disabled={pending}><PauseCircle size={16}/></button>:
              !lead.email_opt_out_at&&<button type="button" onClick={()=>{setPermissionId(lead.id);setConfirmed(false);setEvidence('');}} title="Registrar autorização real"><ShieldCheck size={16}/></button>}
          </div>
        </div>;
      }):<div className="campaigns-empty">Nenhum lead com e-mail válido corresponde à pesquisa.</div>}</div>
      {permissionId&&<div className="campaigns-permission-editor"><div><strong>Registrar autorização de {leads.find(l=>l.id===permissionId)?.name}</strong><button type="button" onClick={()=>setPermissionId(null)} aria-label="Fechar"><X size={17}/></button></div>
        <p>Registre apenas uma autorização que realmente recebeu. Não use esta opção para liberar leads extraídos de pesquisas.</p>
        <textarea rows={2} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Ex.: Cliente autorizou receber ofertas por e-mail no WhatsApp em 19/10/2026."/>
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que este contato autorizou receber campanhas comerciais.</label>
        <button type="button" className="btn btn-primary" disabled={pending||!confirmed||evidence.trim().length<12} onClick={()=>consent(leads.find(l=>l.id===permissionId))}><Check size={16}/> Registrar permissão</button>
      </div>}
    </div>
    <div className="campaigns-bottom-grid">
      <section className="campaigns-preview">
        <div className="campaigns-section-title"><div><span>04 / CONFERÊNCIA</span><h2>Prévia do destinatário</h2></div><Eye size={19}/></div>
        {previewLead ? <><label className="campaigns-preview-select">Visualizar para <select value={previewLead.id} onChange={e=>setPreviewId(e.target.value)}>{usable.map(l=><option key={l.id} value={l.id}>{l.company||l.name}</option>)}</select></label>
          <div className="campaigns-mail-preview"><div><span>De</span><strong>CRM Plus Store &lt;contato@crmplus.store&gt;</strong></div><div><span>Para</span><strong>{previewLead.email}</strong></div><div><span>Assunto</span><strong>{mapText(form.subject,previewLead,products)}</strong></div><p>{mapText(form.body,previewLead,products)}</p><small>Para deixar de receber nossas comunicações, responda SAIR a este e-mail.</small></div>
        </>:<p className="campaigns-empty">Cadastre um lead com e-mail para visualizar o modelo personalizado.</p>}
      </section>
      <section className="campaigns-dispatch">
        <div className="campaigns-section-title"><div><span>05 / CAMPANHA AUTOMÁTICA</span><h2>Enviar pelo Resend</h2></div><Send size={19}/></div>
        <div className="campaigns-dispatch-number">{toSend.length}<span>aptos para envio agora</span></div>
        <div className="campaigns-dispatch-details"><div><ShieldCheck size={17}/> {ready.length} com autorização registrada</div><div><CircleAlert size={17}/> {selected.length-ready.length} sem elegibilidade para envio</div><div><Clock3 size={17}/> {deliveredIds.size} já enviados ou em processamento</div></div>
        <button type="button" className="campaigns-send-button" disabled={sending||pending||!toSend.length||toSend.length>20} onClick={send}><Send size={18}/>{sending?'Enviando '+progress.done+' de '+progress.total:'Enviar campanha'}<ArrowRight size={18}/></button>
        <p>Envio individual pelo Resend, somente com autorização registrada. Máximo de 20 contatos por lote. Requer <code>RESEND_API_KEY</code> configurada na Vercel.</p>
        {delivered.length>0&&<div className="campaigns-recent"><h3>Histórico desta campanha</h3>{delivered.slice(0,12).map(d=><div key={d.id}><span>{d.recipient_email}</span><strong className={d.status}>{d.status==='sent'?'Aceito':d.status==='pending'?'Pendente':'Falha'}</strong></div>)}</div>}
      </section>
    </div>
    {notice&&<div className="campaigns-notice" role="status"><Inbox size={17}/><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  </div>;
}
