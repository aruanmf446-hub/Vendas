import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check, ChevronRight, Filter, Search, X } from 'lucide-react';
import './leads-table.css';

const EMPTY = '__empty__';
const COLUMNS = [
  { key: 'contact', title: 'CONTATO', label: 'Contato' },
  { key: 'product', title: 'PRODUTO / SERVIÇO', label: 'Produto / serviço' },
  { key: 'stage', title: 'ETAPA', label: 'Etapa' },
  { key: 'value', title: 'VALOR', label: 'Valor' },
  { key: 'return', title: 'PRÓXIMO RETORNO', label: 'Próximo retorno' }
];
const STAGES = [
  { id: 'novo', label: 'Novo lead', color: 'blue' },
  { id: 'contato', label: 'Em contato', color: 'amber' },
  { id: 'proposta', label: 'Proposta', color: 'purple' },
  { id: 'negociacao', label: 'Negociação', color: 'orange' },
  { id: 'ganho', label: 'Fechado', color: 'green' },
  { id: 'perdido', label: 'Perdido', color: 'gray' }
];
const STAGE_NAMES = Object.fromEntries(STAGES.map(s => [s.id, s.label]));
const VALUE_GROUPS = [
  { value: 'zero', label: 'Sem valor definido' },
  { value: 'low', label: 'Até R$ 1.000' },
  { value: 'mid', label: 'R$ 1.000,01 a R$ 5.000' },
  { value: 'high', label: 'Acima de R$ 5.000' }
];
const DATE_GROUPS = [
  { value: 'none', label: 'Sem data' },
  { value: 'late', label: 'Atrasados' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'later', label: 'Depois de 7 dias' }
];
const freshFilter = () => ({ search: '', selected: [], min: '', max: '', from: '', to: '' });
const freshFilters = () => Object.fromEntries(COLUMNS.map(c => [c.key, freshFilter()]));
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const valueCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value) || 0);
const localDate = date => {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const plusSeven = today => {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return localDate(d);
};
const dateCaption = date => date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'A definir';
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const isActive = f => Boolean(f.search || f.selected.length || f.min !== '' || f.max !== '' || f.from || f.to);
const getProduct = (lead, map) => map.get(lead.product_id)?.name || 'Sem produto';
const getChoice = (lead, key, map) => {
  if (key === 'contact') return (lead.name || 'Sem nome').trim();
  if (key === 'product') return getProduct(lead, map);
  if (key === 'stage') return lead.stage || 'novo';
  return '';
};
const choiceLabel = (key, value) => key === 'stage' ? (STAGE_NAMES[value] || value) : value;
const valueGroup = value => {
  const n = Number(value) || 0;
  if (n <= 0) return 'zero';
  if (n <= 1000) return 'low';
  if (n <= 5000) return 'mid';
  return 'high';
};
const dateGroup = (date, today, week) => {
  if (!date) return 'none';
  if (date < today) return 'late';
  if (date === today) return 'today';
  if (date <= week) return 'week';
  return 'later';
};

function ColumnFilter({ column, rect, draft, setDraft, options, onApply, onClear, onClose }) {
  const root = useRef(null);
  const key = column.key;
  const isValue = key === 'value';
  const isDate = key === 'return';
  const presets = isValue ? VALUE_GROUPS : isDate ? DATE_GROUPS : options;
  const [optionSearch, setOptionSearch] = useState('');
  const visible = isValue || isDate ? presets : presets.filter(o => norm(o.label).includes(norm(optionSearch)));
  const popWidth = Math.min(328, window.innerWidth - 20);
  const placeBottom = rect.bottom + 425 > window.innerHeight && rect.top > 440;
  const left = Math.max(10, Math.min(rect.left, window.innerWidth - popWidth - 10));
  const top = placeBottom ? Math.max(12, rect.top - 12) : Math.max(12, rect.bottom + 8);
  useEffect(() => {
    const onEscape = e => { if (e.key === 'Escape') onClose(); };
    const onOutside = e => { if (root.current && !root.current.contains(e.target) && !e.target.closest('[data-filter-trigger]')) onClose(); };
    window.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onOutside);
    return () => { window.removeEventListener('keydown', onEscape); document.removeEventListener('pointerdown', onOutside); };
  }, [onClose]);
  const update = (name, val) => setDraft(previous => ({ ...previous, [name]: val }));
  const toggleChoice = value => setDraft(previous => ({
    ...previous, selected: previous.selected.includes(value)
      ? previous.selected.filter(x => x !== value) : [...previous.selected, value]
  }));
  const allVisibleSelected = visible.length > 0 && visible.every(v => draft.selected.includes(v.value));
  const toggleVisible = () => setDraft(previous => {
    const selected = new Set(previous.selected);
    if (allVisibleSelected) visible.forEach(x => selected.delete(x.value));
    else visible.forEach(x => selected.add(x.value));
    return { ...previous, selected: Array.from(selected) };
  });

  return createPortal(
    <div className={'col-filter-panel' + (placeBottom ? ' open-above' : '')} role="dialog"
      aria-label={'Filtrar ' + column.label} ref={root}
      style={{ left, top, width: popWidth, transform: placeBottom ? 'translateY(-100%)' : 'none' }}>
      <div className="cf-title"><span><Filter size={15}/> Filtrar {column.label}</span><button type="button" onClick={onClose} aria-label="Fechar filtro"><X size={17}/></button></div>
      <form onSubmit={e => { e.preventDefault(); onApply(); }}>
        {(!isValue && !isDate) && <>
          <label className="cf-field-label" htmlFor="cf-search">Pesquisar nesta coluna</label>
          <div className="cf-search"><Search size={16}/>
            <input id="cf-search" autoFocus value={draft.search} placeholder={key === 'contact' ? 'Nome, empresa, email, telefone...' : key === 'product' ? 'Pesquisar produto...' : 'Pesquisar etapa...'} onChange={e => { update('search', e.target.value); setOptionSearch(e.target.value); }}/>
            {draft.search && <button type="button" aria-label="Apagar pesquisa" onClick={() => { update('search', ''); setOptionSearch(''); }}><X size={14}/></button>}
          </div>
        </>}
        {isValue && <div className="cf-range">
          <label>Valor mínimo (R$)<input type="number" min="0" step="0.01" placeholder="0,00" value={draft.min} onChange={e => update('min', e.target.value)}/></label>
          <label>Valor máximo (R$)<input type="number" min="0" step="0.01" placeholder="Sem limite" value={draft.max} onChange={e => update('max', e.target.value)}/></label>
        </div>}
        {isDate && <div className="cf-range">
          <label>De<input type="date" value={draft.from} onChange={e => update('from', e.target.value)}/></label>
          <label>Até<input type="date" value={draft.to} onChange={e => update('to', e.target.value)}/></label>
        </div>}
        <div className="cf-options-heading"><span>{isDate ? 'Períodos rápidos' : isValue ? 'Faixas de valor' : 'Selecionar opções'}</span>{!isDate && !isValue && visible.length > 0 && <button type="button" onClick={toggleVisible}>{allVisibleSelected ? 'Desmarcar opções' : 'Selecionar visíveis'}</button>}</div>
        <div className="cf-options">
          {visible.length ? visible.map(option => <label className="cf-option" key={option.value}>
            <input type="checkbox" checked={draft.selected.includes(option.value)} onChange={() => toggleChoice(option.value)}/>
            <span>{option.label}</span>{draft.selected.includes(option.value) && <Check size={14}/>}
          </label>) : <p className="cf-no-options">Nenhuma opção encontrada.</p>}
        </div>
        <div className="cf-footer"><button type="button" className="cf-clear" onClick={onClear}>Limpar filtro</button><button type="submit" className="cf-confirm">Confirmar <Check size={14}/></button></div>
      </form>
    </div>, document.body
  );
}

export default function LeadsTable({ leads, products, search, onSearch, stageFilter, onStageFilter, onSelect }) {
  const [applied, setApplied] = useState(freshFilters);
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [opened, setOpened] = useState(null);
  const [draft, setDraft] = useState(freshFilter);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const today = localDate(new Date());
  const nextWeek = plusSeven(today);
  const options = useMemo(() => ({
    contact: Array.from(new Set(leads.map(l => getChoice(l, 'contact', productMap)))).sort((a,b) => a.localeCompare(b, 'pt-BR')).map(value => ({ value, label: value })),
    product: Array.from(new Set(leads.map(l => getChoice(l, 'product', productMap)))).sort((a,b) => a.localeCompare(b, 'pt-BR')).map(value => ({ value, label: value })),
    stage: STAGES.filter(s => leads.some(l => l.stage === s.id)).map(s => ({ value: s.id, label: s.label }))
  }), [leads, productMap]);

  useEffect(() => {
    if (!opened) return;
    const handleResize = () => setOpened(null);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [opened]);

  const filtered = useMemo(() => {
    const quick = norm(search);
    const matched = leads.filter(l => {
      if (stageFilter !== 'todos' && l.stage !== stageFilter) return false;
      const product = getProduct(l, productMap);
      if (quick && !norm([l.name, l.company, l.email, l.phone, product, STAGE_NAMES[l.stage]].join(' ')).includes(quick)) return false;
      return COLUMNS.every(c => {
        const f = applied[c.key];
        if (!isActive(f)) return true;
        if (c.key === 'contact') {
          const terms = [l.name, l.company, l.email, l.phone].join(' ');
          return (!f.search || norm(terms).includes(norm(f.search))) && (!f.selected.length || f.selected.includes(getChoice(l, c.key, productMap)));
        }
        if (c.key === 'product' || c.key === 'stage') {
          const value = getChoice(l, c.key, productMap);
          return (!f.search || norm(choiceLabel(c.key, value)).includes(norm(f.search))) && (!f.selected.length || f.selected.includes(value));
        }
        if (c.key === 'value') {
          const value = Number(l.expected_value) || 0;
          return (f.min === '' || value >= Number(f.min)) && (f.max === '' || value <= Number(f.max)) && (!f.selected.length || f.selected.includes(valueGroup(value)));
        }
        const date = l.next_follow_up || '';
        return (!f.from || !!date && date >= f.from) && (!f.to || !!date && date <= f.to) && (!f.selected.length || f.selected.includes(dateGroup(date, today, nextWeek)));
      });
    });
    if (!sort.key) return matched;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...matched].sort((a,b) => {
      const key = sort.key;
      if (key === 'return') {
        if (!a.next_follow_up) return b.next_follow_up ? 1 : 0;
        if (!b.next_follow_up) return -1;
        return a.next_follow_up.localeCompare(b.next_follow_up) * factor;
      }
      if (key === 'value') return ((Number(a.expected_value) || 0) - (Number(b.expected_value) || 0)) * factor;
      if (key === 'stage') return (STAGES.findIndex(s => s.id === a.stage) - STAGES.findIndex(s => s.id === b.stage)) * factor;
      return getChoice(a, key, productMap).localeCompare(getChoice(b, key, productMap), 'pt-BR', { sensitivity: 'base', numeric: true }) * factor;
    });
  }, [leads, productMap, search, stageFilter, applied, sort, today, nextWeek]);

  const appliedCount = COLUMNS.filter(c => isActive(applied[c.key])).length + (stageFilter !== 'todos' ? 1 : 0);
  const clearAll = () => { setApplied(freshFilters()); onStageFilter('todos'); onSearch(''); setSort({key:'',direction:'asc'}); setOpened(null); };
  const openFilter = (key,e) => {
    if (opened?.key === key) { setOpened(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDraft({ ...applied[key], selected: [...applied[key].selected] });
    setOpened({key, rect});
  };
  const applyFilter = () => { if (!opened) return; setApplied(old => ({...old,[opened.key]:draft})); if (opened.key === 'stage') onStageFilter('todos'); setOpened(null); };
  const clearColumn = () => { if (!opened) return; setApplied(old => ({...old,[opened.key]:freshFilter()})); if (opened.key === 'stage') onStageFilter('todos'); setOpened(null); };
  const setSortFor = key => { setSort(old => ({key, direction:old.key===key && old.direction==='asc'?'desc':'asc'})); setOpened(null); };

  return <>
    <div className="toolbar lead-filter-toolbar">
      <div className="search-box"><Search size={18}/><input aria-label="Pesquisar todos os leads" placeholder="Buscar por nome, empresa, produto..." value={search} onChange={e=>onSearch(e.target.value)}/>{search && <button type="button" aria-label="Limpar pesquisa geral" onClick={()=>onSearch('')}><X size={15}/></button>}</div>
      {stageFilter !== 'todos' && <button className="lead-filter-chip" type="button" onClick={()=>onStageFilter('todos')}>Etapa: {STAGE_NAMES[stageFilter] || stageFilter}<X size={14}/></button>}
      {appliedCount > 0 && <button className="lead-clear-all" type="button" onClick={clearAll}><X size={15}/> Limpar filtros ({appliedCount})</button>}
      <span className="results-count">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span>
    </div>
    <section className="panel list-panel lead-filter-table">
      <div className="table-wrap">
        <table className="leads-table">
          <thead><tr>
            {COLUMNS.map(c => <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <div className="lead-header-actions">
                <button type="button" className={'lead-sort-button' +(sort.key === c.key?' is-sorted':'')} title={'Ordenar por '+c.label} aria-label={'Ordenar por '+c.label} onClick={()=>setSortFor(c.key)}>
                  {c.title}{sort.key===c.key ? (sort.direction==='asc'?<ArrowUp size={14}/>:<ArrowDown size={14}/>) : <ArrowUpDown size={13}/>}
                </button>
                <button type="button" data-filter-trigger className={'lead-filter-trigger'+(isActive(applied[c.key])?' is-filtered':'')} aria-label={'Filtrar '+c.label} aria-haspopup="dialog" aria-expanded={opened?.key===c.key} onClick={e=>openFilter(c.key,e)}><Filter size={15}/>{isActive(applied[c.key])&&<i/>}</button>
              </div>
            </th>)}
            <th scope="col"><span className="sr-only">Abrir contato</span></th>
          </tr></thead>
          <tbody>{filtered.map(l=><tr key={l.id} onClick={()=>onSelect(l)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onSelect(l);}} aria-label={'Abrir '+l.name}>
            <td><div className="table-person"><span className="client-avatar">{initials(l.name)}</span><span><strong>{l.name}</strong><small>{l.company || l.email || 'Sem empresa'}</small></span></div></td>
            <td className="muted-cell">{getProduct(l,productMap)==='Sem produto'?'Não definido':getProduct(l,productMap)}</td>
            <td><span className={'stage-pill '+(STAGES.find(s=>s.id===l.stage)?.color||'gray')}><span className="pill-dot"/>{STAGE_NAMES[l.stage]||'Novo lead'}</span></td>
            <td className="value-cell">{valueCurrency(l.expected_value)}</td>
            <td><span className={'return-date'+(l.next_follow_up && l.next_follow_up < today && !['ganho','perdido'].includes(l.stage)?' late':'')}><CalendarDays size={14}/>{dateCaption(l.next_follow_up)}</span></td>
            <td><ChevronRight size={17}/></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length && <div className="empty"><div className="empty-icon"><Search size={23}/></div><h3>{leads.length?'Nenhum lead com esses filtros':'Sua lista de leads está vazia'}</h3><p>{leads.length?'Remova um filtro ou altere sua pesquisa para encontrar outros contatos.':'Cadastre um lead para acompanhar suas oportunidades comerciais.'}</p>{leads.length>0&&<button className="btn btn-outline" type="button" onClick={clearAll}>Limpar filtros</button>}</div>}
    </section>
    {opened && <ColumnFilter key={opened.key} column={COLUMNS.find(c=>c.key===opened.key)} rect={opened.rect} draft={draft} setDraft={setDraft} options={options[opened.key]||[]} onApply={applyFilter} onClear={clearColumn} onClose={()=>setOpened(null)}/>}
  </>;
}
