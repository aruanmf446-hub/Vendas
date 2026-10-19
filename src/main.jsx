import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    console.error('Falha ao carregar o CRM', error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#0c172d',color:'#fff',fontFamily:'system-ui'}}>
        <div style={{width:'min(460px,100%)',padding:32,borderRadius:18,border:'1px solid #ffffff35',background:'#ffffff10'}}>
          <div style={{color:'#9bbdff',fontWeight:800,letterSpacing:2,fontSize:12}}>CRM PLUS VENDAS</div>
          <h1 style={{margin:'14px 0',fontSize:26}}>Não foi possível abrir o painel</h1>
          <p style={{lineHeight:1.7,color:'#c3d1e9'}}>Ocorreu um erro inesperado. Atualize a página. Se persistir, informe ao suporte.</p>
          <button style={{marginTop:20,border:0,borderRadius:9,padding:'13px 22px',color:'#fff',background:'#4268e8',fontWeight:800,cursor:'pointer'}} onClick={()=>window.location.reload()}>Tentar novamente</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
);
