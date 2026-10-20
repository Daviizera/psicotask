'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TarefaForm from '@/components/TarefaForm';
import { api, Contexto, Resumo, fmt, msg } from '@/lib/api';

export default function Novo() {
  const r = useRouter();
  const [aba, setAba] = useState<'t' | 'c'>('t');
  const [ctx, setCtx] = useState<Contexto[] | null>(null);
  const [res, setRes] = useState<Resumo | null>(null);
  const vazio = { titulo: '', data: '', horaInicio: '', horaFim: '', descricao: '' };
  const [v, setV] = useState(vazio);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const carregar = () => api<Resumo>('/api/resumo').then(setRes).catch(() => {});
  useEffect(() => { api<Contexto[]>('/api/contextos').then(setCtx).catch(() => setCtx([])); carregar(); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  async function criarCompromisso(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setOk('');
    try {
      await api('/api/compromissos', 'POST', { titulo: v.titulo, data: v.data, horaInicio: v.horaInicio, horaFim: v.horaFim, ...(v.descricao ? { descricao: v.descricao } : {}) });
      setV(vazio); setOk('Compromisso criado.'); carregar();
    } catch (x) { setErr(msg(x)); }
  }
  return (
    <>
      <div className="top"><h1>{aba === 't' ? 'Nova tarefa' : 'Novo compromisso'}</h1></div>
      <div className="seg"><button className={aba === 't' ? 'a' : ''} onClick={() => setAba('t')}>Tarefa</button><button className={aba === 'c' ? 'a' : ''} onClick={() => setAba('c')}>Compromisso</button></div>
      <div className="wrap">
        <div className="card2">
          {aba === 't' ? (ctx && <TarefaForm ctx={ctx} label="Salvar tarefa" onSubmit={async (b) => { await api('/api/tarefas', 'POST', b); r.push('/tarefas'); }} />) : (
            <form onSubmit={criarCompromisso}>
              <div className="f"><label>Título</label><input value={v.titulo} onChange={set('titulo')} maxLength={255} required /></div>
              <div className="row">
                <div className="f"><label>Data</label><input type="date" value={v.data} onChange={set('data')} required /></div>
                <div className="f"><label>Início</label><input type="time" value={v.horaInicio} onChange={set('horaInicio')} required /></div>
                <div className="f"><label>Término</label><input type="time" value={v.horaFim} onChange={set('horaFim')} required /></div>
              </div>
              <div className="f"><label>Descrição</label><textarea rows={4} value={v.descricao} onChange={set('descricao')} /></div>
              {err && <p className="err">{err}</p>}{ok && <p className="ok">{ok}</p>}
              <div className="act"><button className="btn">Salvar compromisso</button></div>
            </form>
          )}
        </div>
        <aside className="card2" style={{ background: 'var(--b)' }}>
          <h3>Próximos compromissos</h3>
          {res?.proximosCompromissos.length ? res.proximosCompromissos.map((c) => <div className="mini" key={c.id} style={{ background: '#fff' }}><b>{c.titulo}</b><small>{fmt(c.data)} · {c.horaInicio} às {c.horaFim}</small></div>) : <p style={{ fontSize: 13 }}>Nenhum compromisso agendado.</p>}
        </aside>
      </div>
    </>
  );
}
