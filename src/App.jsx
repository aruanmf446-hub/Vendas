import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays,
  Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, ContactRound, DollarSign,
  ExternalLink, FileText, Filter, Handshake, LayoutDashboard, LockKeyhole, LogOut, Mail,
  Menu, MessageCircle, MoreHorizontal, Package, Pencil, Phone, Plus, Search, Send,
  Sparkles, Target, TrendingUp, UserRound, UsersRound, X
} from 'lucide-react';
import { configured, supabase } from './supabase';
import Outreach from './Outreach.jsx';
import LeadsTable from './LeadsTable.jsx';
import EmailComposer from './EmailComposer.jsx';
import AdminCentral from './AdminCentral.jsx';
import './outreach.css';

const STAGES = [
  { id: 'novo', name: 'Novo lead', color: '#5874d6', accent: 'blue' },
  { id: 'contato', name: 'Em contato', color: '#ac7a46', accent: 'amber' },
  { id: 'proposta', name: 'Proposta', color: '#8367bb', accent: 'purple' },
  { id: 'negociacao', name: 'Negociação', color: '#bd7e3f', accent: 'orange' },
  { id: 'ganho', name: 'Fechado', color: '#338c70', accent: 'green' },
  { id: 'perdido', name: 'Perdido', color: '#a4a5aa', accent: 'gray' }
];
const STAGE_NAMES = Object.fromEntries(STAGES.map(s => [s.id, s.name]));
const menu = [
  { id: 'overview', label: 'Visão geral', Icon: LayoutDashboard },
  { id: 'funnel', label: 'Funil de vendas', Icon: Target },
  { id: 'leads', label: 'Meus leads', Icon: UsersRound },
  { id: 'calendar', label: 'Acompanhamentos', Icon: CalendarDays },
  { id: 'products', label: 'Produtos e serviços', Icon: Package },
  { id: 'admin', label: 'Administração', Icon: BriefcaseBusiness }
];
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);
const shortDate = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'Sem data';
const longDate = value => value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : '';
const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const whatsapp = phone => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? 'https://wa.me/' + (digits.startsWith('55') ? digits : '55' + digits) : null;
};
const nextIsLate = lead => lead.next_follow_up && lead.next_follow_up < today() && !['ganho', 'perdido'].includes(lead.stage);
const isOpen = lead => !['ganho', 'perdido'].includes(lead.stage);
const emptyLead = { name: '', company: '', email: '', phone: '', product_id: '', expected_value: '', source: 'Indicação', stage: 'novo', priority: 'media', next_follow_up: '', notes: '' };
const emptyProduct = { name: '', category: 'Serviço', price: '', description: '', video_url: '', outreach_template: '', active: true };

function Brand({ dark = false }) {
  return <div className={'brand' + (dark ? ' brand-dark' : '')}>
    <span className="brand-mark"><TrendingUp size={21} strokeWidth={2.5} /></span>
    <span className="brand-copy"><strong>crm<span>plus</span></strong><small>VENDAS</small></span>
  </div>;
}
function StagePill({ stage }) {
  const s = STAGES.find(x => x.id === stage) || STAGES[0];
  return <span className={'stage-pill ' + s.accent}><span className="pill-dot" />{s.name}</span>;
}
function NoContent({ Icon = UsersRound, title, description, onClick, action }) {
  return <div className="empty"><div className="empty-icon"><Icon size={23} strokeWidth={1.7} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="btn btn-primary" onClick={onClick}><Plus size={16}/>{action}</button>}</div>;
}
function FormField({ label, children, required }) {
  return <label className="field"><span>{label}{required && <b> *</b>}</span>{children}</label>;
}

const ONLY_EMAIL = 'aruanmf446@gmail.com';
const permitted = user => !!user && user.email?.trim().toLowerCase() === ONLY_EMAIL && !user.is_anonymous;

function Access({ onUser }) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState(false);

  const handleEmailLink = async e => {
    e.preventDefault();
    if (!supabase || pending) return;
    setPending(true);
    setFeedback('');
    setSent(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: ONLY_EMAIL,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
      setFeedback('Um link de acesso foi solicitado. Confira sua caixa de entrada e o spam.');
    } catch (error) {
      setFeedback(error?.message || 'Não foi possível enviar o email. Tente novamente.');
    } finally {
      setPending(false);
    }
  };

  return <main className="access-page sales-access">
    <section className="sales-stage" aria-label="CRM Plus Vendas">
      <div className="sales-stage-top">
        <Brand dark />
        <span className="sales-stage-index">COMERCIAL / EDIÇÃO 01</span>
      </div>
      <div className="sales-stage-body">
        <div className="sales-kicker"><i aria-hidden="true" /> RELACIONAMENTO QUE GERA NEGÓCIOS</div>
        <h1><span>Não deixe</span><span>uma boa venda</span><em>esfriar.</em></h1>
        <p className="sales-stage-lede">Um produto de interesse. Uma conversa bem conduzida. Um retorno na hora certa. Seu comercial fica mais forte quando cada oportunidade tem um próximo passo.</p>
      </div>
      <div className="sales-flow" aria-label="Jornada comercial ilustrativa">
        <div className="sales-flow-top"><span>DO PRIMEIRO OLÁ AO FECHAMENTO</span><span>O CAMINHO DA VENDA ↗</span></div>
        <div className="sales-flow-steps">
          <div className="sales-flow-step"><span className="sales-flow-step-number">01 / CAPTAR</span><strong>Lead recebido</strong><small>Contato e interesse registrados</small></div>
          <div className="sales-flow-step"><span className="sales-flow-step-number">02 / CONDUZIR</span><strong>Próximo retorno</strong><small>Acompanhamento sem perder o fio</small></div>
          <div className="sales-flow-step"><span className="sales-flow-step-number">03 / AVANÇAR</span><strong>Negócio em movimento</strong><small>Do interesse à negociação</small></div>
        </div>
      </div>
      <div className="sales-stage-foot"><span>SEU FUNIL TEM HISTÓRIA. A GENTE AJUDA A CONTINUAR.</span><b>CRM PLUS · 2026</b></div>
    </section>
    <section className="sales-entry" aria-label="Acesso ao painel de vendas">
      <header className="sales-entry-top"><span>CRM PLUS / VENDAS</span><span className="sales-private"><LockKeyhole size={13}/> ÁREA PRIVADA</span></header>
      <div className="sales-entry-main">
        <div className="sales-number">ACESSO RESERVADO / 001</div>
        <h2>Seu comercial, <em>em movimento.</em></h2>
        <p className="sales-entry-intro">Volte para os seus leads, produtos e acompanhamentos. Tudo o que importa para continuar a próxima conversa.</p>
        <form onSubmit={handleEmailLink} className="sales-access-form">
          <div className="sales-account">
            <span className="sales-account-icon"><LockKeyhole size={18}/></span>
            <div className="sales-account-text"><small>ACESSO EXCLUSIVO</small><strong>Conta do administrador</strong></div>
            <span className="sales-account-tag"><Check size={13}/> PRIVADO</span>
          </div>
          <label className="sales-field">
            <span>Email autorizado</span>
            <span className="sales-email"><Mail size={18}/><input type="email" aria-label="Email autorizado" value={ONLY_EMAIL} readOnly autoComplete="email" /><LockKeyhole size={15}/></span>
          </label>
          {feedback && <div className={'sales-notice'+(sent?' success':'')} role="status">{sent?<CheckCheck size={18}/>:<CircleHelp size={18}/>}<span>{feedback}</span></div>}
          {!configured
            ? <div className="sales-notice" role="status"><CircleHelp size={18}/><span>A integração Supabase precisa estar configurada na Vercel para liberar o acesso.</span></div>
            : <button type="submit" className="sales-submit" disabled={pending}>
                <span>{pending ? 'Enviando acesso seguro...' : sent ? 'Reenviar meu link de acesso' : 'Receber meu link de acesso'}</span><ArrowRight size={19}/>
              </button>}
        </form>
        <div className="sales-guidance"><Mail size={18}/><span>Sem senha para decorar. Você recebe um link de entrada diretamente no email autorizado.</span></div>
        <div className="sales-trust"><LockKeyhole size={13}/> Acesso autenticado com Supabase Auth</div>
      </div>
      <footer className="sales-entry-foot"><span>© 2026 CRM PLUS VENDAS</span><a href="https://crmplus.store" target="_blank" rel="noreferrer">crmplus.store <ArrowUpRight size={11} style={{verticalAlign:'middle'}}/></a></footer>
    </section>
  </main>;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [active, setActive] = useState('overview');
  const [products, setProducts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('todos');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [outreachId, setOutreachId] = useState(null);
  const [emailLeadId, setEmailLeadId] = useState(null);
  const [activityKind, setActivityKind] = useState('nota');
  const [activityText, setActivityText] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Vendedor';
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthReady(true); }).catch(()=>setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'PASSWORD_RECOVERY') setAuthMode('recovery');
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (user && !permitted(user)) {
      setUser(null);
      setToast('Este CRM é reservado ao email autorizado.');
      supabase?.auth.signOut();
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!permitted(user)) { setProducts([]); setLeads([]); setActivities([]); return; }
    refresh();
  }, [user?.id]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/,'') === '/campanhas') window.history.replaceState({}, '', '/');
  }, []);
  // Atualiza as respostas recebidas sem atualizar toda a página ou alterar o estado do WhatsApp.
  useEffect(() => {
    if (!permitted(user)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh(true);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  async function refresh(quiet = false) {
    if (!supabase) return;
    if (!quiet) setLoading(true);
    const [pr, ld, ac] = await Promise.all([
      supabase.from('crm_products').select('*').order('name'),
      supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('crm_activities').select('*').order('created_at', { ascending: false })
    ]);
    if (pr.error || ld.error || ac.error) { if (!quiet) setToast('Erro ao carregar: ' + (pr.error || ld.error || ac.error).message); }
    else { setProducts(pr.data || []); setLeads(ld.data || []); setActivities(ac.data || []); }
    if (!quiet) setLoading(false);
  }
  const productById = id => products.find(p=>p.id===id);
  const emailSentIds = useMemo(() => new Set(activities.filter(a => a.kind === 'email' && a.content?.startsWith('Envio individual confirmado manualmente pelo operador')).map(a => a.lead_id)), [activities]);
  const selected = leads.find(l=>l.id===selectedId);
  const emailLead = leads.find(l=>l.id===emailLeadId);
  const outreachLead = leads.find(l=>l.id===outreachId);
  const won = leads.filter(l=>l.stage==='ganho');
  const openLeads = leads.filter(isOpen);
  const overdue = openLeads.filter(nextIsLate);
  const pipelineValue = openLeads.reduce((s,l)=>s+Number(l.expected_value||0),0);
  const wonValue = won.reduce((s,l)=>s+Number(l.expected_value||0),0);
  const upcoming = useMemo(()=>openLeads.filter(l=>l.next_follow_up).sort((a,b)=>a.next_follow_up.localeCompare(b.next_follow_up)),[leads]);
  const openLeadEditor = lead => {
    setEditing(lead || null);
    setForm(lead ? { ...lead, product_id:lead.product_id||'', next_follow_up:lead.next_follow_up||'', expected_value:String(lead.expected_value ?? '') } : { ...emptyLead });
    setModal('lead');
  };
  const openProductEditor = product => {
    setEditing(product || null);
    setForm(product ? { ...product, price:String(product.price ?? '') } : { ...emptyProduct });
    setModal('product');
  };
  const field = (key, value) => setForm(old=>({...old,[key]:value}));
  const saveLead = async e => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    const payload = {
      name:form.name.trim(),company:(form.company||'').trim(),email:(form.email||'').trim(),phone:(form.phone||'').trim(),
      product_id:form.product_id||null,expected_value:Number(form.expected_value)||0,source:form.source||'Indicação',
      stage:form.stage||'novo',priority:form.priority||'media',next_follow_up:form.next_follow_up||null,
      notes:form.notes||'',updated_at:new Date().toISOString()
    };
    const result = editing ? await supabase.from('crm_leads').update(payload).eq('id',editing.id) :
      await supabase.from('crm_leads').insert({...payload,owner_id:user.id}).select().single();
    if (result.error) setToast('Não foi possível salvar: '+result.error.message);
    else {
      if (editing && editing.stage !== payload.stage) await recordActivity(editing.id,'etapa','Etapa alterada para '+STAGE_NAMES[payload.stage]+'.');
      if (!editing && result.data?.id) await recordActivity(result.data.id,'etapa','Lead cadastrado no funil.');
      setModal(null);setToast(editing?'Lead atualizado com sucesso.':'Novo lead cadastrado.');
      await refresh();
    }
    setSaving(false);
  };
  const saveProduct = async e => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    const payload = {name:form.name.trim(),category:form.category.trim()||'Serviço',price:Number(form.price)||0,description:form.description||'',video_url:(form.video_url||'').trim(),outreach_template:(form.outreach_template||'').trim(),active:form.active!==false,updated_at:new Date().toISOString()};
    const result=editing?await supabase.from('crm_products').update(payload).eq('id',editing.id):
      await supabase.from('crm_products').insert({...payload,owner_id:user.id});
    if (result.error) setToast('Não foi possível salvar: '+result.error.message);
    else {setModal(null);setToast(editing?'Produto atualizado.':'Produto cadastrado.');await refresh();}
    setSaving(false);
  };
  const toggleProduct = async product => {
    const {error}=await supabase.from('crm_products').update({active:!product.active,updated_at:new Date().toISOString()}).eq('id',product.id);
    if(error)setToast(error.message);else await refresh();
  };
  const recordActivity=async (leadId,kind,content)=>{
    const {error}=await supabase.from('crm_activities').insert({owner_id:user.id,lead_id:leadId,kind,content});
    if(error)setToast('Não foi possível registrar a atividade: '+error.message);
    return !error;
  };
  const moveStage=async (lead,stage)=>{
    if(!lead||lead.stage===stage||saving)return;
    setSaving(true);
    const {error}=await supabase.from('crm_leads').update({stage,updated_at:new Date().toISOString()}).eq('id',lead.id);
    if(error)setToast(error.message);
    else {
      await recordActivity(lead.id,'etapa','Oportunidade movida de '+STAGE_NAMES[lead.stage]+' para '+STAGE_NAMES[stage]+'.');
      await refresh();setToast('Etapa atualizada.');
    }
    setSaving(false);
  };
  const saveActivity=async e=>{
    e.preventDefault();
    if(!selected||!activityText.trim()||saving)return;
    setSaving(true);
    const ok=await recordActivity(selected.id,activityKind,activityText.trim());
    if(ok){setActivityText('');setActivityKind('nota');await refresh();setToast('Atividade registrada.');}
    setSaving(false);
  };
  const showContact = lead => { setSelectedId(lead.id);setActivityText('');setActivityKind('nota'); };
  const openEmail = lead => {setSelectedId(null);setEmailLeadId(lead.id);setMobileMenu(false);};
  const signOut=async()=>{const {error}=await supabase.auth.signOut();if(error)setToast(error.message);else{setUser(null);setSelectedId(null);setOutreachId(null);setEmailLeadId(null);} };
  const navTo = id => {setActive(id);setMobileMenu(false);setSearch('');setStageFilter('todos');if(window.location.pathname!=='/')window.history.replaceState({},'', '/');};
  const stageCount = id=>leads.filter(l=>l.stage===id).length;
  const screenName = menu.find(m=>m.id===active)?.label||'Visão geral';

  if (!authReady) return <div className="loading-page"><Brand/><div className="loading-ring"/></div>;
  if (!permitted(user)) return <Access onUser={setUser}/>;

  return <div className="shell">
    <aside className={'sidebar' +(mobileMenu?' is-open':'')}>
      <div className="side-top"><Brand dark/><button className="icon-btn mobile-close" onClick={()=>setMobileMenu(false)} aria-label="Fechar menu"><X size={19}/></button></div>
      <div className="side-section"><span className="side-caption">WORKSPACE</span><div className="workspace-mark"><span className="workspace-icon">C</span><span><strong>Comercial</strong><small>Meu espaço de vendas</small></span><ChevronDown size={16}/></div></div>
      <div className="side-section nav-section"><span className="side-caption">MENU PRINCIPAL</span><nav className="side-nav">{menu.map(({id,label,Icon})=><button key={id} onClick={()=>navTo(id)} className={'side-link '+(active===id?'active':'')}><Icon size={19} strokeWidth={1.85}/><span>{label}</span>{id==='calendar'&&overdue.length>0&&<small className="side-alert">{overdue.length}</small>}</button>)}</nav></div>
      <div className="side-promo"><div className="promo-spark"><Sparkles size={20}/></div><strong>Venda com clareza.</strong><p>Um bom acompanhamento transforma oportunidades em negócios.</p><div className="promo-decoration"/></div>
      <div className="side-profile"><span className="profile-avatar">{initials(displayName)}</span><div className="profile-info"><strong title={user.email}>{displayName}</strong><small title={user.email}>{user.email}</small></div><button className="icon-btn" onClick={signOut} title="Sair da conta" aria-label="Sair da conta"><LogOut size={18}/></button></div>
    </aside>
    {mobileMenu&&<button className="mobile-scrim" onClick={()=>setMobileMenu(false)} aria-label="Fechar menu"/>}
    <div className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={()=>setMobileMenu(true)} aria-label="Abrir menu"><Menu size={22}/></button><span className="crumb">Workspace</span><ChevronRight size={15} className="crumb-icon"/><strong>{screenName}</strong></div><div className="topbar-right"><span className="today-label"><CalendarDays size={15}/>{new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span><button className="top-avatar" title={user.email}>{initials(displayName)}</button></div></header>
      <main className="main-content">
        {active==='admin' && <AdminCentral user={user} />}
        {active==='overview'&&<>
          <section className="welcome"><div className="welcome-main"><div className="eyebrow"><span className="eyebrow-dot"/>SEU PAINEL COMERCIAL</div><h1>Vendas melhores começam com <em>boas conexões.</em></h1><p>Tenha uma visão clara de cada oportunidade e saiba exatamente qual é o próximo passo.</p><button className="btn btn-dark" onClick={()=>openLeadEditor(null)}>Adicionar novo lead <ArrowUpRight size={17}/></button></div><div className="welcome-art" aria-hidden="true"><span className="orbit orbit-1"/><span className="orbit orbit-2"/><span className="orbit orbit-3"/><div className="art-node art-node-a"><Target size={19}/></div><div className="art-node art-node-b"><CheckCheck size={18}/></div><div className="art-node art-node-c"><Handshake size={20}/></div><div className="art-center"><TrendingUp size={34}/></div></div></section>
          <div className="section-heading stat-heading"><div><span className="eyebrow muted">NÚMEROS QUE IMPORTAM</span><h2>Panorama de vendas</h2></div><span className="section-sub">Atualizado com seus dados</span></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Leads no funil</span><span className="stat-icon blue-soft"><UsersRound size={18}/></span></div><strong>{openLeads.length}</strong><p><span className="mini-dot blue-bg"/> oportunidades em aberto</p></div>
            <div className="stat-card"><div className="stat-top"><span>Valor em negociação</span><span className="stat-icon purple-soft"><TrendingUp size={18}/></span></div><strong className="currency">{brl(pipelineValue)}</strong><p>Potencial do funil ativo</p></div>
            <div className="stat-card"><div className="stat-top"><span>Vendas fechadas</span><span className="stat-icon green-soft"><CheckCheck size={18}/></span></div><strong className="currency">{brl(wonValue)}</strong><p>{won.length} {won.length===1?'negócio concluído':'negócios concluídos'}</p></div>
            <div className="stat-card"><div className="stat-top"><span>Retornos atrasados</span><span className="stat-icon coral-soft"><Clock3 size={18}/></span></div><strong>{overdue.length}</strong><p className={overdue.length?'attention':''}>{overdue.length?'Precisam de atenção':'Tudo em dia por aqui'}</p></div>
          </div>
          <div className="overview-grid">
            <section className="panel funnel-summary"><div className="panel-head"><div><span className="eyebrow muted">VISÃO DO FUNIL</span><h3>Onde estão seus negócios?</h3></div><button className="subtle-link" onClick={()=>navTo('funnel')}>Ver funil <ArrowUpRight size={15}/></button></div>
              <div className="stage-bars">{STAGES.slice(0,5).map(s=><button className="stage-bar-row" key={s.id} onClick={()=>{navTo('leads');setStageFilter(s.id)}}><span className="stage-bar-name"><i style={{background:s.color}}/>{s.name}</span><span className="stage-track"><span style={{width:(leads.length?Math.max(3,stageCount(s.id)/leads.length*100):0)+'%',background:s.color}}/></span><b>{stageCount(s.id)}</b></button>)}</div>
              <div className="funnel-footer"><span>{leads.length} oportunidades cadastradas</span><span>{leads.length?Math.round(won.length/leads.length*100):0}% de conversão geral</span></div>
            </section>
            <section className="panel next-panel"><div className="panel-head"><div><span className="eyebrow muted">NÃO DEIXE PASSAR</span><h3>Próximos retornos</h3></div><button className="subtle-link" onClick={()=>navTo('calendar')}>Ver agenda <ArrowUpRight size={15}/></button></div>{upcoming.length? <div className="follow-list">{upcoming.slice(0,4).map(l=><button className="follow-item" key={l.id} onClick={()=>showContact(l)}><div className={'date-block '+(nextIsLate(l)?'date-late':'')}><strong>{l.next_follow_up.slice(-2)}</strong><span>{shortDate(l.next_follow_up).split(' ')[1]}</span></div><div className="follow-copy"><strong>{l.name}</strong><small>{productById(l.product_id)?.name||l.company||'Acompanhamento comercial'}</small></div>{nextIsLate(l)?<span className="late-label">Atrasado</span>:<ChevronRight size={16}/>}</button>)}</div> :<div className="compact-empty"><CalendarDays size={26}/><p>Nenhum acompanhamento agendado.</p><button onClick={()=>openLeadEditor(null)}>Adicionar lead <ArrowRight size={14}/></button></div>}</section>
          </div>
          <section className="panel latest-panel"><div className="panel-head"><div><span className="eyebrow muted">MOVIMENTAÇÃO RECENTE</span><h3>Últimas oportunidades</h3></div><button className="subtle-link" onClick={()=>navTo('leads')}>Todos os leads <ArrowUpRight size={15}/></button></div>{leads.length?<div className="simple-list">{leads.slice(0,5).map(l=><button className="latest-row" key={l.id} onClick={()=>showContact(l)}><span className="client-avatar">{initials(l.name)}</span><span className="latest-person"><strong>{l.name}</strong><small>{l.company||productById(l.product_id)?.name||'Contato comercial'}</small></span><span className="latest-price">{brl(l.expected_value)}</span><StagePill stage={l.stage}/><ChevronRight size={17}/></button>)}</div>:<NoContent Icon={ContactRound} title="Tudo começa com um contato" description="Cadastre seu primeiro lead para começar a acompanhar suas oportunidades." action="Cadastrar lead" onClick={()=>openLeadEditor(null)}/>}</section>
        </>}
        {active==='funnel'&&<>
          <section className="page-intro"><div><span className="eyebrow muted">PIPELINE COMERCIAL</span><h1>Seu funil de vendas<span className="heading-dot">.</span></h1><p>Visualize o caminho das oportunidades, da primeira conversa até o fechamento.</p></div><button className="btn btn-primary" onClick={()=>openLeadEditor(null)}><Plus size={17}/> Novo lead</button></section>
          <div className="funnel-topline"><span><span className="green-dot"/> {openLeads.length} oportunidades ativas</span><span>Potencial: <b>{brl(pipelineValue)}</b></span><span className="drag-hint">Arraste um lead para alterar a etapa</span></div>
          <div className="kanban">{STAGES.map(s=><section key={s.id} className="kanban-column" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');moveStage(leads.find(l=>l.id===id),s.id);}}>
            <div className="kanban-column-head"><div><span className="column-dot" style={{background:s.color}}/>{s.name} <small>{stageCount(s.id)}</small></div><b>{brl(leads.filter(l=>l.stage===s.id).reduce((v,l)=>v+Number(l.expected_value||0),0))}</b></div>
            <div className="kanban-cards">{leads.filter(l=>l.stage===s.id).map(l=><article key={l.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',l.id)} className="deal-card" onClick={()=>showContact(l)} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&showContact(l)} role="button" aria-label={'Abrir lead '+l.name}>
              <div className="deal-card-top"><span className={'priority-flag '+l.priority}>{l.priority==='alta'?'Alta prioridade':l.priority==='baixa'?'Baixa prioridade':'Prioridade média'}</span><MoreHorizontal size={16}/></div><h4>{l.name}</h4><p>{l.company||'Contato comercial'}</p><div className="deal-product"><Package size={13}/>{productById(l.product_id)?.name||'Sem produto definido'}</div><strong className="deal-value">{brl(l.expected_value)}</strong><div className="deal-footer"><span className={'deal-date '+(nextIsLate(l)?'late':'')}><CalendarDays size={13}/>{l.next_follow_up?shortDate(l.next_follow_up):'Sem retorno'}</span><span className="client-avatar tiny">{initials(l.name)}</span></div>
            </article>)}{!stageCount(s.id)&&<div className="column-empty">Solte um lead aqui</div>}</div>
            {s.id==='novo'&&<button className="kanban-add" onClick={()=>openLeadEditor(null)}><Plus size={16}/> Novo lead</button>}
          </section>)}</div>
        </>}
        {active==='leads'&&<>
          <section className="page-intro"><div><span className="eyebrow muted">RELACIONAMENTO É TUDO</span><h1>Meus leads<span className="heading-dot">.</span></h1><p>Pesquise, ordene pelo cabeçalho ou abra o filtro ao lado de cada coluna.</p></div><button className="btn btn-primary" onClick={()=>openLeadEditor(null)}><Plus size={17}/> Adicionar lead</button></section>
          <LeadsTable leads={leads} products={products} search={search} onSearch={setSearch}
            stageFilter={stageFilter} onStageFilter={setStageFilter} onSelect={showContact} onEmail={openEmail} emailSentIds={emailSentIds}/>
        </>}
        {active==='calendar'&&<>
          <section className="page-intro"><div><span className="eyebrow muted">RELACIONAMENTOS EM DIA</span><h1>Próximos contatos<span className="heading-dot">.</span></h1><p>Não deixe uma boa conversa esfriar. Planeje seu próximo movimento.</p></div><button className="btn btn-primary" onClick={()=>openLeadEditor(null)}><Plus size={17}/> Novo lead</button></section>
          <div className="agenda-summary"><div><Clock3 size={20}/><span><strong>{overdue.length}</strong><small>retornos atrasados</small></span></div><div><CalendarDays size={20}/><span><strong>{upcoming.filter(l=>l.next_follow_up>=today()).length}</strong><small>retornos agendados</small></span></div><div><CheckCheck size={20}/><span><strong>{won.length}</strong><small>vendas concluídas</small></span></div></div>
          <section className="panel agenda-panel"><div className="panel-head"><div><span className="eyebrow muted">SUA AGENDA</span><h3>Acompanhamentos pendentes</h3></div></div>{upcoming.length?<div className="agenda-list">{upcoming.map(l=><button className="agenda-row" key={l.id} onClick={()=>showContact(l)}><div className={'date-block large '+(nextIsLate(l)?'date-late':'')}><strong>{l.next_follow_up.slice(-2)}</strong><span>{shortDate(l.next_follow_up).split(' ')[1]}</span></div><div className="agenda-person"><strong>{l.name}</strong><p>{l.company||'Cliente'} <span>·</span> {productById(l.product_id)?.name||'Produto não informado'}</p></div><StagePill stage={l.stage}/>{nextIsLate(l)&&<span className="late-label">Atrasado</span>}<ArrowUpRight size={18}/></button>)}</div>:<NoContent Icon={CalendarDays} title="Sua agenda está livre" description="Defina a data do próximo acompanhamento ao cadastrar ou editar um lead." action="Cadastrar lead" onClick={()=>openLeadEditor(null)}/>}</section>
        </>}
        {active==='products'&&<>
          <section className="page-intro"><div><span className="eyebrow muted">SEU CATÁLOGO COMERCIAL</span><h1>Produtos & serviços<span className="heading-dot">.</span></h1><p>Organize o que você vende e vincule cada lead ao que ele procura.</p></div><button className="btn btn-primary" onClick={()=>openProductEditor(null)}><Plus size={17}/> Novo produto</button></section>
          <div className="product-info"><Package size={19}/><div><strong>{products.filter(p=>p.active).length} itens ativos no seu catálogo</strong><span>Itens inativos continuam vinculados aos leads já cadastrados.</span></div></div>
          {products.length?<div className="products-grid">{products.map(p=><article className={'product-card '+(!p.active?'inactive':'')} key={p.id}><div className="product-card-head"><span className="product-icon"><Package size={21}/></span><span className={'product-badge '+(p.active?'':'off')}>{p.active?'Ativo':'Inativo'}</span></div><div className="product-category">{p.category}{p.video_url&&<span className="product-video-ready"> · Vídeo vinculado</span>}</div><h3>{p.name}</h3><p>{p.description||'Disponível para suas novas oportunidades de venda.'}</p><div className="product-bottom"><strong>{brl(p.price)}</strong><div><button className="icon-btn edit-product" aria-label={'Editar '+p.name} onClick={()=>openProductEditor(p)}><Pencil size={17}/></button><button className="subtle-switch" onClick={()=>toggleProduct(p)}>{p.active?'Desativar':'Ativar'}</button></div></div></article>)}</div>:<section className="panel"><NoContent Icon={Package} title="Seu catálogo começa aqui" description="Cadastre os produtos e serviços que sua empresa comercializa, com seus valores de referência." action="Cadastrar produto" onClick={()=>openProductEditor(null)}/></section>}
        </>}
        <footer className="footer"><span>CRM PLUS · Vendas</span><span>© 2026 · Desenvolvido por <a href="https://crmplus.store" target="_blank" rel="noreferrer">crmplus.store</a></span></footer>
      </main>
    </div>
    {loading&&<div className="refresh-pill"><span className="loading-ring small"/> Atualizando dados</div>}
    {toast&&<div className="toast" role="status"><Activity size={17}/>{toast}<button onClick={()=>setToast('')} aria-label="Dispensar aviso"><X size={15}/></button></div>}
    {selected&&<div className="drawer-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null)}}><aside className="lead-drawer"><div className="drawer-head"><span className="eyebrow muted">DETALHES DA OPORTUNIDADE</span><button className="icon-btn close-btn" aria-label="Fechar detalhes" onClick={()=>setSelectedId(null)}><X size={20}/></button></div>
      <div className="drawer-title"><span className="client-avatar big">{initials(selected.name)}</span><div><h2>{selected.name}</h2><p>{selected.company||'Contato comercial'}</p></div></div>
      <div className="drawer-stage"><StagePill stage={selected.stage}/><span>{brl(selected.expected_value)}</span></div>{selected.last_whatsapp_reply_at && <div className="drawer-outreach-status"><MessageCircle size={13}/> Última resposta recebida: {longDate(selected.last_whatsapp_reply_at)}</div>}{emailSentIds.has(selected.id) && <div className="drawer-email-sent"><Mail size={13}/> E-mail enviado · confirmado manualmente</div>}{selected.outreach_status && selected.outreach_status !== 'nao_iniciado' && <div className="drawer-outreach-status"><MessageCircle size={13}/> Prospecção: {{video_enviado:'Vídeo enviado',mensagem_enviada:'Mensagem enviada',aguardando_resposta:'Aguardando resposta',respondeu:'Cliente respondeu'}[selected.outreach_status] || 'Em andamento'}</div>}
      <div className="drawer-actions"><button className="btn btn-outline" onClick={()=>openLeadEditor(selected)}><Pencil size={16}/> Editar lead</button><button type="button" className="btn btn-whatsapp" onClick={()=>setOutreachId(selected.id)}><MessageCircle size={17}/> Abordagem Comercial <ArrowRight size={14}/></button><button type="button" className="btn btn-outline" onClick={()=>openEmail(selected)} disabled={!selected.email||!!selected.email_opt_out_at}><Mail size={16}/> Enviar e-mail</button></div>
      <div className="drawer-scroll"><div className="detail-section"><div className="detail-caption">INFORMAÇÕES DO LEAD</div><div className="detail-grid"><div><small>Produto de interesse</small><strong>{productById(selected.product_id)?.name||'Não definido'}</strong></div><div><small>Origem</small><strong>{selected.source}</strong></div><div><small>Próximo retorno</small><strong className={nextIsLate(selected)?'attention':''}>{selected.next_follow_up?shortDate(selected.next_follow_up):'Não agendado'}</strong></div><div><small>Prioridade</small><strong className="capitalize">{selected.priority}</strong></div><div><small>Telefone</small><strong>{selected.phone||'Não informado'}</strong></div><div><small>Email</small><strong className="break-text">{selected.email||'Não informado'}</strong></div></div>{selected.notes&&<div className="lead-notes"><FileText size={15}/><p>{selected.notes}</p></div>}</div>
      <div className="detail-section"><div className="detail-caption">ATUALIZAR ETAPA</div><div className="stage-selector"><select value={selected.stage} disabled={saving} onChange={e=>moveStage(selected,e.target.value)} aria-label="Alterar etapa do lead">{STAGES.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><ChevronDown size={17}/></div></div>
      <div className="detail-section timeline-section"><div className="detail-caption">HISTÓRICO DE CONTATOS <span>{activities.filter(a=>a.lead_id===selected.id).length}</span></div><div className="timeline">{activities.filter(a=>a.lead_id===selected.id).map(a=><div className="timeline-item" key={a.id}><div className="timeline-marker"><Activity size={13}/></div><div><div className="timeline-meta"><strong>{{nota:'Nota',ligacao:'Ligação',whatsapp:'WhatsApp',email:'E-mail',reuniao:'Reunião',etapa:'Mudança de etapa',retorno:'Retorno'}[a.kind]||'Atividade'}</strong><small>{longDate(a.created_at)}</small></div><p>{a.content}</p></div></div>)}{!activities.some(a=>a.lead_id===selected.id)&&<p className="no-timeline">Nenhuma atividade registrada.</p>}</div></div>
      <form className="activity-form" onSubmit={saveActivity}><div className="detail-caption">REGISTRAR INTERAÇÃO</div><select value={activityKind} onChange={e=>setActivityKind(e.target.value)} aria-label="Tipo de interação"><option value="nota">Anotação</option><option value="ligacao">Ligação</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="reuniao">Reunião</option><option value="retorno">Retorno realizado</option></select><textarea value={activityText} onChange={e=>setActivityText(e.target.value)} placeholder="O que foi conversado? Qual o próximo passo?" rows={3} maxLength={3000} required/><button className="btn btn-primary" type="submit" disabled={saving||!activityText.trim()}><Send size={15}/> Salvar no histórico</button></form>
      </div>
    </aside></div>}
    {outreachLead && <Outreach key={outreachLead.id} lead={outreachLead} product={productById(outreachLead.product_id)} userId={user.id} onClose={()=>setOutreachId(null)} onRefresh={refresh} />}
    {emailLead && <EmailComposer key={emailLead.id} lead={emailLead} product={productById(emailLead.product_id)} userId={user.id} onClose={()=>setEmailLeadId(null)} onRefresh={refresh} onNotify={setToast} />}
    {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="editor-modal" role="dialog" aria-modal="true" aria-label={modal==='lead'?'Cadastro de lead':'Cadastro de produto'}><div className="modal-head"><div><span className="eyebrow muted">{modal==='lead'?'GESTÃO DE OPORTUNIDADES':'CATÁLOGO COMERCIAL'}</span><h2>{editing?'Editar ':'Novo '}{modal==='lead'?'lead':'produto ou serviço'}</h2><p>{modal==='lead'?'Registre as informações e mantenha o acompanhamento em dia.':'Defina o que sua empresa oferece.'}</p></div><button aria-label="Fechar formulário" className="icon-btn close-btn" onClick={()=>setModal(null)}><X size={21}/></button></div>
      {modal==='lead'?<form onSubmit={saveLead} className="editor-form"><div className="form-grid"><FormField label="Nome do lead" required><input required minLength={2} maxLength={140} value={form.name||''} onChange={e=>field('name',e.target.value)} placeholder="Nome completo"/></FormField><FormField label="Empresa / negócio"><input value={form.company||''} onChange={e=>field('company',e.target.value)} placeholder="Empresa (opcional)"/></FormField><FormField label="Telefone / WhatsApp"><input type="tel" value={form.phone||''} onChange={e=>field('phone',e.target.value)} placeholder="(91) 99999-9999"/></FormField><FormField label="E-mail"><input type="email" value={form.email||''} onChange={e=>field('email',e.target.value)} placeholder="contato@empresa.com"/></FormField><FormField label="Produto de interesse"><select value={form.product_id||''} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setForm(old=>({...old,product_id:e.target.value,expected_value:p&&(!old.expected_value||old.expected_value==='0')?String(p.price):old.expected_value}));}}><option value="">Selecione um produto</option>{products.filter(p=>p.active||p.id===form.product_id).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></FormField><FormField label="Valor estimado (R$)"><input type="number" min="0" step="0.01" value={form.expected_value??''} onChange={e=>field('expected_value',e.target.value)} placeholder="0,00"/></FormField><FormField label="Etapa"><select value={form.stage||'novo'} onChange={e=>field('stage',e.target.value)}>{STAGES.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></FormField><FormField label="Prioridade"><select value={form.priority||'media'} onChange={e=>field('priority',e.target.value)}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></FormField><FormField label="Origem do lead"><select value={form.source||'Indicação'} onChange={e=>field('source',e.target.value)}>{['Indicação','WhatsApp','Instagram','Site','Google','Ligação','Prospecção ativa','Evento','Outro'].map(s=><option key={s}>{s}</option>)}</select></FormField><FormField label="Próximo acompanhamento"><input type="date" value={form.next_follow_up||''} onChange={e=>field('next_follow_up',e.target.value)}/></FormField><div className="full"><FormField label="Observações"><textarea rows={3} value={form.notes||''} onChange={e=>field('notes',e.target.value)} placeholder="Necessidades, contexto da negociação, dúvidas do cliente..."/></FormField></div></div><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={()=>setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={saving} type="submit"><Check size={16}/>{saving?'Salvando...':editing?'Salvar alterações':'Cadastrar lead'}</button></div></form>:
        <form onSubmit={saveProduct} className="editor-form"><div className="form-grid"><div className="full"><FormField label="Nome do produto ou serviço" required><input required minLength={2} maxLength={140} value={form.name||''} onChange={e=>field('name',e.target.value)} placeholder="Ex.: Site institucional, Plano Plus, Consultoria..."/></FormField></div><FormField label="Categoria"><select value={form.category||'Serviço'} onChange={e=>field('category',e.target.value)}><option>Serviço</option><option>Produto</option><option>Assinatura</option><option>Projeto</option><option>Outro</option></select></FormField><FormField label="Valor de referência (R$)"><input type="number" min="0" step="0.01" value={form.price??''} onChange={e=>field('price',e.target.value)} placeholder="0,00"/></FormField><div className="full"><FormField label="Descrição"><textarea rows={4} value={form.description||''} onChange={e=>field('description',e.target.value)} placeholder="O que está incluído? Diferenciais, escopo..."/></FormField></div><div className="full"><FormField label="Vídeo de apresentação (URL opcional)"><input type="url" maxLength={1000} pattern="https://.*" value={form.video_url||''} onChange={e=>field('video_url',e.target.value)} placeholder="https://seusite.com/video.mp4"/></FormField><span className="product-video-hint">O vídeo ficará associado a este produto. Anexe-o manualmente no WhatsApp.</span></div><div className="full"><FormField label="Modelo de mensagem (opcional)"><textarea rows={4} maxLength={2700} value={form.outreach_template||''} onChange={e=>field('outreach_template',e.target.value)} placeholder="Olá! Conheci {cliente} pelo {origem} e gostaria de apresentar {produto}..."/></FormField><span className="product-video-hint">Use <code>{'{cliente}'}</code>, <code>{'{produto}'}</code> e <code>{'{origem}'}</code>. Deixe em branco para usar a mensagem padrão do CRM.</span></div><div className="full"><label className="checkbox-label"><input type="checkbox" checked={form.active!==false} onChange={e=>field('active',e.target.checked)}/>Produto ativo para novas oportunidades</label></div></div><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={()=>setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={saving} type="submit"><Check size={16}/>{saving?'Salvando...':editing?'Salvar alterações':'Cadastrar produto'}</button></div></form>}
    </div></div>}
  </div>;
}
