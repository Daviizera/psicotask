'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, Tarefa, Contexto, Status, corDe, fmt, msg, STATUS, PRIO } from '@/lib/api';

const COLS: Status[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA'];

export default function Tarefas() {
  const [t, setT] = useState<Tarefa[]>([]);
  const [c, setC] = useState<Contexto[]>([]);
  const [q, setQ] = useState('');
  const [p, setP] = useState('');
  const [cx, setCx] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api<Tarefa[]>('/api/tarefas'), api<Contexto[]>('/api/contextos')])
      .then(([a, b]) => { setT(a); setC(b); }).catch((e) => setErr(msg(e)));
  }, []);
  const lista = t.filter((x) => x.titulo.toLowerCase().includes(q.toLowerCase()) && (!p || x.prioridade === p) && (!cx || x.contextoId === +cx)).sort((a, b) => b.id - a.id);
  const nome = (id: number) => c.find((k) => k.id === id)?.nome ?? '—';
  return (
    <>
      <div className="top"><h1>Minhas Tarefas</h1><Link href="/novo" className="btn">+ Nova Tarefa</Link></div>
      {err && <p className="err">{err}</p>}
      <div className="filters">
        <input placeholder="Pesquisar tarefas..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={p} onChange={(e) => setP(e.target.value)}><option value="">Prioridade</option>{Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={cx} onChange={(e) => setCx(e.target.value)}><option value="">Contexto</option>{c.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}</select>
      </div>
      <div className="board">
        {COLS.map((s) => {
          const col = lista.filter((x) => x.status === s);
          return (
            <div className="col" key={s}>
              <h2>{STATUS[s]} <b>{col.length}</b></h2>
              {col.map((x) => (
                <Link key={x.id} href={`/tarefas/${x.id}`} className={`card ${s === 'CONCLUIDA' ? 'done' : ''}`} style={{ borderColor: corDe(x.contextoId) }}>
                  <p>{x.titulo}</p>
                  <div className="meta"><span className="tag" style={{ background: corDe(x.contextoId) }}>{nome(x.contextoId)}</span><span>{PRIO[x.prioridade]}{x.prazo ? ` · ${fmt(x.prazo)}` : ''}</span></div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
