import React,{useEffect,useState} from 'react';
import {supabase} from './supabase';
const catalog=[{id:'ponto-do-pedido',name:'Ponto do Pedido',url:'https://pontodopedido.vercel.app',repo:'https://github.com/aruanmf446-hub/ponto_do_pedido'},{id:'quem-sou-eu',name:'Quem Sou Eu',url:'https://quemsoueu.cards',repo:'https://github.com/aruanmf446-hub/quemsoueu'}];
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
export default function AdminCentral({user}){
 const [project,setProject]=useState(catalog[0].id),[tab,setTab]=useState('Manutenção'),[data,setData]=useState({}),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [title,setTitle]=useState(''),[message,setMessage]=useState(''),[amount,setAmount]=useState(''),[description,setDescription]=useState('');
 const tables=['adm_projects','adm_announcements','adm_events','adm_revenue'];
 const rows=table=>data[table]||[];
 const selected=catalog.find(p=>p.id===project),current=rows('adm_projects').find(p=>p.id===project);
 async function load(){
  const result=await Promise.all(tables.map(t=>supabase.from(t).select('*').order(t==='adm_projects'?'created_at':t==='adm_revenue'?'received_on':'created_at',{ascending:false}).limit(500)));
  const fail=result.find(x=>x.error);if(fail){setError(fail.error.message);return;}
  setData(Object.fromEntries(tables.map((t,i)=>[t,result[i].data||[]])));
 }
 useEffect(()=>{load();},[user.id]);
 async function action(work){setBusy(true);setError('');setNote('');try{await work();await load();}catch(e){setError(e.message)}finally{setBusy(false)}}
 const checked=r=>{if(r.error)throw r.error};
 async function audit(kind,description){checked(await supabase.from('adm_events').insert({owner_id:user.id,project_id:project,kind,description}))}
 function setStatus(status){action(async()=>{
  checked(await supabase.from('adm_projects').upsert({...selected,owner_id:user.id,status,repo_url:selected.repo,production_url:selected.url,updated_at:new Date().toISOString()},{onConflict:'owner_id,id'}));
  await audit('status','Estado administrativo: '+status);
  setNote('Estado salvo. Não bloqueia o site externo até que a API de controle seja conectada.');
 })}
 function saveAnnouncement(e){e.preventDefault();action(async()=>{checked(await supabase.from('adm_announcements').insert({owner_id:user.id,project_id:project,title,message}));await audit('comunicado',title);setTitle('');setMessage('');setNote('Comunicado interno salvo. Publicação externa ainda não integrada.')})}
 function saveReceipt(e){e.preventDefault();action(async()=>{checked(await supabase.from('adm_revenue').insert({owner_id:user.id,project_id:project,amount:Number(amount),description}));await audit('receita','Recebimento registrado: '+money(amount));setAmount('');setDescription('');setNote('Recebimento lançado manualmente; não há conciliação com pagamentos.')})}
 function saveEvent(e){e.preventDefault();action(async()=>{await audit('ocorrencia',message);setMessage('');setNote('Ocorrência registrada.')})}
 const filtered=t=>rows(t).filter(r=>r.project_id===project);
 const panel={border:'1px solid #e4e8f1',borderRadius:14,background:'#fff',padding:24,marginTop:18};
 const input={border:'1px solid #dce3ef',borderRadius:9,padding:12,width:'100%',font:'inherit'};
 const button={padding:'11px 15px',borderRadius:9,border:'1px solid #cbd5e5',background:'#fff',cursor:'pointer',fontWeight:700};
 return <div style={{maxWidth:1200,paddingBottom:60}}>
 <small style={{letterSpacing:2,color:'#506fba',fontWeight:800}}>CRM PLUS / PORTFÓLIO</small><h1 style={{fontSize:32,margin:'12px 0'}}>Central administrativa</h1><p style={{color:'#74819a'}}>Produtos, manutenções, comunicados, receitas registradas e auditoria. Mesmo login do CRM.</p>
 <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'24px 0'}}>
 {catalog.map(p=><button key={p.id} style={{...button,background:project===p.id?'#eaf0ff':'white',borderColor:project===p.id?'#4268e8':'#dce3ef',padding:20,flex:'1 1 210px',textAlign:'left'}} onClick={()=>{setProject(p.id);setNote('');setTab('Manutenção')}}><strong>{p.name}</strong><div style={{color:'#8290a5',fontSize:12,marginTop:8}}>{rows('adm_projects').find(x=>x.id===p.id)?.status||'Sem alteração administrativa'}</div></button>)}
 </div>
 <div style={{display:'flex',gap:18,flexWrap:'wrap',fontSize:12,fontWeight:700}}><a href={selected.url} target="_blank" rel="noreferrer">Abrir produto ↗</a><a href={selected.repo} target="_blank" rel="noreferrer">Repositório GitHub ↗</a><button style={{...button,padding:'5px 10px'}} onClick={load}>Atualizar dados</button></div>
 <div style={{...panel,display:'flex',flexWrap:'wrap',gap:24}}><div><small>Receitas registradas — todos os produtos</small><h2>{money(rows('adm_revenue').reduce((s,r)=>s+Number(r.amount),0))}</h2><small>Somente recebimentos lançados, não valor de leads</small></div><div><small>Receitas deste produto</small><h2>{money(filtered('adm_revenue').reduce((s,r)=>s+Number(r.amount),0))}</h2></div><div><small>Registros de auditoria</small><h2>{filtered('adm_events').length}</h2></div></div>
 {error&&<p role="alert" style={{padding:12,color:'#9e3333',background:'#ffefef'}}>{error}</p>}{note&&<p role="status" style={{padding:12,color:'#17623b',background:'#e8f8ef'}}>{note}</p>}
 <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:28}}>{['Manutenção','Comunicados','Receitas','Logs'].map(t=><button key={t} onClick={()=>{setTab(t);setMessage('')}} style={{...button,background:tab===t?'#304877':'white',color:tab===t?'white':'#41516a'}}>{t}</button>)}</div>
 <section style={panel}>
 {tab==='Manutenção'&&<><h2>Estado administrativo</h2><p style={{margin:'15px 0',color:'#76839a'}}>Registre o estado e acompanhe pendências. Este botão não altera o funcionamento público sem API de controle integrada.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{[['operational','Operacional'],['maintenance','Manutenção'],['incident','Incidente']].map(([v,label])=><button key={v} disabled={busy} style={{...button,background:(current?.status||'operational')===v?'#dce6ff':'white'}} onClick={()=>setStatus(v)}>{label}</button>)}</div></>}
 {tab==='Comunicados'&&<><h2>Comunicados internos</h2><p style={{color:'#76839a'}}>Registro no ADM; o site não recebe automaticamente este conteúdo.</p><form onSubmit={saveAnnouncement} style={{display:'grid',gap:12,margin:'18px 0'}}><input style={input} required maxLength={160} placeholder="Título" value={title} onChange={e=>setTitle(e.target.value)}/><textarea style={input} required rows={4} maxLength={4000} placeholder="Texto do aviso" value={message} onChange={e=>setMessage(e.target.value)}/><button style={button} disabled={busy}>Registrar comunicado</button></form>{filtered('adm_announcements').map(a=><article key={a.id} style={{borderTop:'1px solid #e5eaf2',padding:14}}><strong>{a.title}</strong><p>{a.message}</p><small>{new Date(a.created_at).toLocaleString('pt-BR')}</small></article>)}</>}
 {tab==='Receitas'&&<><h2>Recebimentos confirmados manualmente</h2><p style={{color:'#76839a'}}>Não confundir com estimativas do CRM. Pagamentos de assinaturas e decks precisam de integração financeira futura.</p><form onSubmit={saveReceipt} style={{display:'grid',gap:12,margin:'18px 0'}}><input style={input} type="number" min=".01" step=".01" placeholder="Valor recebido (R$)" required value={amount} onChange={e=>setAmount(e.target.value)}/><input style={input} placeholder="Descrição da receita" required maxLength={200} value={description} onChange={e=>setDescription(e.target.value)}/><button style={button} disabled={busy}>Registrar recebimento</button></form>{filtered('adm_revenue').map(r=><article key={r.id} style={{borderTop:'1px solid #e5eaf2',padding:14}}><strong>{money(r.amount)} — {r.description}</strong><small style={{display:'block'}}>{new Date(r.created_at).toLocaleString('pt-BR')}</small></article>)}</>}
 {tab==='Logs'&&<><h2>Histórico administrativo</h2><p style={{color:'#76839a'}}>Registros das ações no ADM, não logs técnicos de servidores ou Vercel.</p><form onSubmit={saveEvent} style={{display:'grid',gap:12,margin:'18px 0'}}><textarea style={input} rows={3} maxLength={3000} required placeholder="Descreva uma ocorrência, correção ou pendência" value={message} onChange={e=>setMessage(e.target.value)}/><button style={button} disabled={busy}>Adicionar ocorrência</button></form>{filtered('adm_events').map(ev=><article key={ev.id} style={{borderTop:'1px solid #e5eaf2',padding:14}}><strong>{ev.kind}</strong><p>{ev.description}</p><small>{new Date(ev.created_at).toLocaleString('pt-BR')}</small></article>)}</>}
 </section></div>;
}