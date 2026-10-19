'use client';
import { useEffect, useState } from 'react';
import { api, Perfil as PerfilT, Contexto, corDe, msg } from '@/lib/api';

export default function Perfil() {
  const [p, setP] = useState<PerfilT | null>(null);
  const [c, setC] = useState<Contexto[]>([]);
  const [novo, setNovo] = useState('');
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [errC, setErrC] = useState('');
  const loadC = () => api<Contexto[]>('/api/contextos').then(setC).catch((e) => setErrC(msg(e)));
  useEffect(() => { api<PerfilT>('/api/perfil').then(setP).catch((e) => setErr(msg(e))); loadC(); }, []);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setOk('');
    if (!p) return;
    try { setP(await api<PerfilT>('/api/perfil', 'PUT', { nome: p.nome, email: p.email, registroProfissional: p.registroProfissional })); setOk('Alterações salvas.'); }
    catch (x) { setErr(msg(x)); }
  }
  const acao = async (fn: () => Promise<unknown>) => { setErrC(''); try { await fn(); await loadC(); } catch (x) { setErrC(msg(x)); } };
  const criar = (e: React.FormEvent) => { e.preventDefault(); acao(async () => { await api('/api/contextos', 'POST', { nome: novo }); setNovo(''); }); };
  const renomear = (x: Contexto) => { const nome = prompt('Novo nome do contexto', x.nome); if (nome) acao(() => api(`/api/contextos/${x.id}`, 'PUT', { nome })); };
  const excluir = (x: Contexto) => { if (confirm(`Excluir "${x.nome}"?`)) acao(() => api(`/api/contextos/${x.id}`, 'DELETE')); };
  if (!p) return <p className="err">{err || 'Carregando...'}</p>;
  const upd = (k: keyof PerfilT) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value });
  return (
    <>
      <div className="top"><h1>Perfil</h1></div>
      <div className="wrap">
        <form className="card2" onSubmit={salvar}>
          <h3>Dados profissionais</h3>
          <div className="f"><label>Nome completo</label><input value={p.nome} onChange={upd('nome')} maxLength={200} required /></div>
          <div className="row">
            <div className="f"><label>Registro profissional (CRP)</label><input value={p.registroProfissional} onChange={upd('registroProfissional')} maxLength={50} required /></div>
            <div className="f"><label>E-mail</label><input type="email" value={p.email} onChange={upd('email')} maxLength={254} required /></div>
          </div>
          {err && <p className="err">{err}</p>}{ok && <p className="ok">{ok}</p>}
          <div className="act"><button className="btn">Salvar alterações</button></div>
        </form>
        <aside className="card2" style={{ width: 400 }}>
          <h3>Meus contextos</h3>
          {c.map((x) => <div className="crow" key={x.id}><i className="dot" style={{ background: corDe(x.id) }} /><span>{x.nome}</span><button onClick={() => renomear(x)}>Renomear</button><button onClick={() => excluir(x)}>Excluir</button></div>)}
          {errC && <p className="err" style={{ marginTop: 10 }}>{errC}</p>}
          <form onSubmit={criar} style={{ display: 'flex', gap: 8, marginTop: 16 }}><input placeholder="Novo contexto" value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={200} required /><button className="btn">Criar</button></form>
        </aside>
      </div>
    </>
  );
}
