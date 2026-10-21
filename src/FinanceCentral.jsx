import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';
const projects=[{id:'ponto-do-pedido',name:'Ponto do Pedido'},{id:'quem-sou-eu',name:'Quem Sou Eu'}];
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const box={background:'white',border:'1px solid #e5eaf3',padding:22,borderRadius:14};
const input={width:'100%',border:'1px solid #dce3ed',padding:12,borderRadius:9,font:'inherit'};
export default function FinanceCentral({user}){
 const [receipts,setReceipts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[project,setProject]=useState('quem-sou-eu'),[amount,setAmount]=useState(''),[description,setDescription]=useState('');
 const [players,setPlayers]=useState(300),[conversion,setConversion]=useState(3),[price,setPrice]=useState(9.9),[generations,setGenerations]=useState(13),[imageCost,setImageCost]=useState(.3),[fees,setFees]=useState(8),[otherCosts,setOtherCosts]=useState(40);
 async function load(){const r=await supabase.from('adm_revenue').select('*').order('created_at',{ascending:false}).limit(1000);if(r.error)setError(r.error.message);else{setReceipts(r.data||[]);setError('')}}
 useEffect(()=>{load()},[user.id]);
 const sales=Math.round(players*conversion/100),gross=sales*price,api=sales*generations*imageCost,transaction=gross*fees/100,margin=gross-api-transaction,net=margin-otherCosts;
 const byProject=useMemo(()=>projects.map(p=>({...p,received:receipts.filter(r=>r.project_id===p.id).reduce((a,r)=>a+Number(r.amount),0)})),[receipts]);
 const total=byProject.reduce((s,p)=>s+p.received,0);
 async function save(e){e.preventDefault();setBusy(true);setError('');try{const value=Number(amount);if(!Number.isFinite(value)||value<=0)throw Error('Valor inválido.');const r=await supabase.from('adm_revenue').insert({owner_id:user.id,project_id:project,amount:value,description:description.trim()});if(r.error)throw r.error;setAmount('');setDescription('');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const field=(name,value,min,max,step)=> <label style={{display:'grid',gap:7,fontSize:12,color:'#65738a',fontWeight:700}}>{name}<input style={input} type="number" min={min} max={max} step={step} value={value[0]} onChange={e=>value[1](Number(e.target.value))}/></label>;
 return <div style={{maxWidth:1250,paddingBottom:65}}>
 <small style={{letterSpacing:1.8,fontWeight:800,color:'#4268e8'}}>CRM PLUS / FINANCEIRO</small><h1 style={{fontSize:32,margin:'12px 0'}}>Receitas e custos</h1><p style={{color:'#76849b',lineHeight:1.65}}>Financeiro centralizado de todos os produtos. Recebimentos reais ficam separados das projeções.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,margin:'24px 0'}}>
 <div style={box}><small>Receita recebida cadastrada</small><h2 style={{marginTop:16}}>{money(total)}</h2><small style={{color:'#8995a7'}}>Não inclui oportunidades do funil</small></div>
 {byProject.map(p=><div key={p.id} style={box}><small>{p.name}</small><h2 style={{marginTop:16}}>{money(p.received)}</h2><small style={{color:'#8995a7'}}>Lançamentos confirmados</small></div>)}
 </div>
 <section style={box}><h2 style={{marginBottom:12}}>Registrar recebimento</h2><p style={{fontSize:12,color:'#77869a'}}>Entrada manual de valores efetivamente recebidos. Não há integração com gateway de pagamento ainda.</p>
 <form onSubmit={save} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginTop:16}}>
 <select aria-label="Produto" style={input} value={project} onChange={e=>setProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <input style={input} type="number" min=".01" step=".01" required value={amount} placeholder="Valor recebido (R$)" onChange={e=>setAmount(e.target.value)}/>
 <input style={input} maxLength={200} required value={description} placeholder="Descrição da receita" onChange={e=>setDescription(e.target.value)}/>
 <button disabled={busy} className="btn btn-primary">Salvar recebimento</button></form>
 {error&&<p role="alert" style={{color:'#ba3b32',marginTop:12}}>{error}</p>}
 <div style={{marginTop:18}}>{receipts.slice(0,20).map(r=><div key={r.id} style={{padding:'12px 0',borderTop:'1px solid #edf0f5',display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',fontSize:12}}><span>{projects.find(p=>p.id===r.project_id)?.name||r.project_id} · {r.description}</span><strong>{money(r.amount)}</strong></div>)}</div></section>
 <section style={{...box,marginTop:18}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><small style={{color:'#4268e8',fontWeight:800}}>PROJEÇÃO / QUEM SOU EU</small><h2 style={{margin:'9px 0'}}>Simulador de decks</h2></div><span style={{background:'#fff3db',color:'#805f29',borderRadius:18,padding:'7px 12px',fontSize:11,fontWeight:800}}>HIPÓTESE · NÃO É RECEITA REAL</span></div>
 <p style={{color:'#77869a',fontSize:12,lineHeight:1.7,margin:'0 0 20px'}}>Deck com 10 personagens. Base: até 15 gerações por compra e custo ilustrativo por imagem. Ajuste os valores conforme a operação.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:14}}>
 {field('Jogadores',[players,setPlayers],0,100000,100)}
 {field('Conversão em compra (%)',[conversion,setConversion],0,100,.5)}
 {field('Preço por deck (R$)',[price,setPrice],0,10000,.1)}
 {field('Gerações médias / deck',[generations,setGenerations],10,15,1)}
 {field('Custo / imagem (R$)',[imageCost,setImageCost],0,100,.05)}
 {field('Taxas de pagamento (%)',[fees,setFees],0,100,.5)}
 {field('Outros custos / reserva (R$)',[otherCosts,setOtherCosts],0,100000,5)}
 </div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginTop:20}}>
 {[['Decks projetados',String(sales)],['Receita bruta',money(gross)],['Custo OpenAI',money(api)],['Taxas',money(transaction)],['Margem antes de outros custos',money(margin)],['Saldo após reserva',money(net)]].map(([name,value])=><div key={name} style={{background:'#f4f7fd',padding:17,borderRadius:11}}><small style={{display:'block',color:'#6e7e97',marginBottom:9}}>{name}</small><strong style={{fontSize:21}}>{value}</strong></div>)}
 </div>
 <p style={{fontSize:11,color:'#8c98aa',marginTop:18}}>Valores hipotéticos, sem impostos, hospedagem ou demais despesas não informadas. Projeção nunca soma ao total de receitas recebidas.</p>
 </section></div>;
}