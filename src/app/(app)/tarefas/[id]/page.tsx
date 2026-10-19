'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TarefaForm from '@/components/TarefaForm';
import { api, Tarefa, Contexto, Status, corDe, fmt, msg, STATUS, PRIO } from '@/lib/api';

export default function Detalhe() {
  const { id } = useParams<{ id: string }>();
  const r = useRouter();
  const [t, setT] = useState<Tarefa | null>(null);
  const [c, setC] = useState<Contexto[]>([]);
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api<Tarefa>(`/api/tarefas/${id}`), api<Contexto[]>('/api/contextos')])
      .then(([a, b]) => { setT(a); setC(b); }).catch((e) => setErr(msg(e)));
  }, [id]);
  async function put(b: Record<string, unknown>) { setT(await api<Tarefa>(`/api/tarefas/${id}`, 'PUT', b)); setEdit(false); }
  const mover = (s: Status) => put({ status: s }).catch((e) => setErr(msg(e)));
  async function excluir() { if (confirm('Excluir esta tarefa?')) { await api(`/api/tarefas/${id}`, 'DELETE'); r.push('/tarefas'); } }
  if (!t) return <p className="err">{err || 'Carregando...'}</p>;
  const ctxNome = c.find((k) => k.id === t.contextoId)?.nome ?? '—';
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--t)', marginBottom: 6 }}><Link href="/tarefas">Tarefas</Link> / Detalhes</p>
      <div className="top"><h1>{t.titulo}</h1></div>
      <div className="wrap">
        <div className="card2">
          {edit ? <TarefaForm ctx={c} init={t} label="Salvar alterações" onSubmit={put} /> : (
            <>
              <span className="tag" style={{ background: corDe(t.contextoId) }}>{ctxNome}</span>{' '}
              <span className="tag" style={{ background: t.prioridade === 'ALTA' ? '#c0392b' : 'var(--t)' }}>{PRIO[t.prioridade]}</span>
              <div className="grid"><div><label>Prazo</label>{fmt(t.prazo) || '—'}</div><div><label>Status</label>{STATUS[t.status]}</div><div><label>Criada em</label>{fmt(t.dataCriacao)}</div></div>
              <h3>Descrição</h3><p style={{ lineHeight: 1.6, fontSize: 14 }}>{t.descricao || 'Sem descrição.'}</p>
            </>
          )}
        </div>
        <aside className="card2">
          <h3>Mover para</h3>
          <div className="st">{(Object.keys(STATUS) as Status[]).map((s) => <button key={s} className={t.status === s ? 'on' : ''} onClick={() => mover(s)}>{STATUS[s]}</button>)}</div>
          {err && <p className="err">{err}</p>}
          {t.status !== 'CONCLUIDA' && <button className="btn" style={{ width: '100%', marginBottom: 10 }} onClick={() => mover('CONCLUIDA')}>Concluir tarefa</button>}
          <button className="btn ghost" style={{ width: '100%', marginBottom: 10 }} onClick={() => setEdit(!edit)}>{edit ? 'Cancelar edição' : 'Editar tarefa'}</button>
          <div style={{ textAlign: 'center' }}><button className="del" onClick={excluir}>Excluir tarefa</button></div>
        </aside>
      </div>
    </>
  );
}
