'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, Tarefa, Contexto, Resumo, Status, corCtx, fmt, msg, STATUS, PRIO } from '@/lib/api';

const COLS: Status[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA'];
const COL_COR: Record<Status, string> = { PENDENTE: '#005696', EM_ANDAMENTO: '#0284C7', CONCLUIDA: '#0f766e' };

export default function Tarefas() {
  const [t, setT] = useState<Tarefa[]>([]);
  const [c, setC] = useState<Contexto[]>([]);
  const [res, setRes] = useState<Resumo | null>(null);
  const [q, setQ] = useState('');
  const [p, setP] = useState('');
  const [cx, setCx] = useState(0);
  const [ord, setOrd] = useState('recentes');
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api<Tarefa[]>('/api/tarefas'), api<Contexto[]>('/api/contextos'), api<Resumo>('/api/resumo')])
      .then(([a, b, r]) => { setT(a); setC(b); setRes(r); }).catch((e) => setErr(msg(e)));
  }, []);
  const hoje = new Date().toLocaleDateString('en-CA');
  const ativas = t.filter((x) => x.status !== 'CONCLUIDA');
  const urgentes = ativas.filter((x) => x.prioridade === 'ALTA').length;
  const pct = t.length ? Math.round((t.filter((x) => x.status === 'CONCLUIDA').length * 100) / t.length) : 0;
  const prox = res?.proximosCompromissos[0];
  const lista = t
    .filter((x) => x.titulo.toLowerCase().includes(q.toLowerCase()) && (!p || x.prioridade === p) && (!cx || x.contextoId === cx))
    .sort((a, b) => (ord === 'prazo' ? (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') : b.id - a.id));
  const ctxDe = (id: number) => c.find((k) => k.id === id) ?? { id, nome: '—' };
  const stat = (bg: string, cor: string, icon: string) => <div className="ic" style={{ background: bg, color: cor }}><span className="ms">{icon}</span></div>;
  return (
    <>
      <div className="top"><h1>Minhas Tarefas</h1><Link href="/novo" className="btn"><span className="ms">add</span>Nova Tarefa</Link></div>
      {err && <p className="err">{err}</p>}
      <div className="sum">
        <div className="sc">{stat('#eff4ff', '#005696', 'assignment')}<div><b>{ativas.length}</b><small>demandas ativas</small></div></div>
        <div className="sc">{stat('#ffe4e6', '#be123c', 'warning')}<div><b style={{ color: '#be123c' }}>{urgentes}</b><small>alta prioridade</small></div></div>
        <div className="sc">{stat('#fef3c7', '#b45309', 'event')}<div><b className="m">{prox ? prox.titulo : 'Sem compromissos'}</b><small>{prox ? `${fmt(prox.data)} · ${prox.horaInicio}` : 'Próximo compromisso'}</small></div></div>
        <div className="sc"><div className="ring" style={{ '--v': `${pct}%` } as React.CSSProperties} /><div><b>{pct}%</b><small>tarefas concluídas</small></div></div>
      </div>
      <div className="fl">
        <div className="fr"><input placeholder="Filtrar por título..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={ord} onChange={(e) => setOrd(e.target.value)}><option value="recentes">Ordenar: Recentes</option><option value="prazo">Ordenar: Prazo</option></select></div>
        <div className="fr"><span className="lb">CONTEXTO</span><div>
          <button className={`chip ${!cx ? 'on' : ''}`} onClick={() => setCx(0)}>Todos</button>
          {c.map((k) => <button key={k.id} className={`chip ${cx === k.id ? 'on' : ''}`} onClick={() => setCx(cx === k.id ? 0 : k.id)}><i className="dot" style={{ background: corCtx(k) }} />{k.nome} <small>({t.filter((x) => x.contextoId === k.id).length})</small></button>)}
        </div></div>
        <div className="fr"><span className="lb">PRIORIDADE</span><div>
          <button className={`chip ${!p ? 'on' : ''}`} onClick={() => setP('')}>Todas</button>
          {Object.entries(PRIO).reverse().map(([k, v]) => <button key={k} className={`chip ${p === k ? 'on' : ''}`} onClick={() => setP(p === k ? '' : k)}>{v} <small>({t.filter((x) => x.prioridade === k).length})</small></button>)}
        </div></div>
      </div>
      <div className="board">
        {COLS.map((s) => {
          const col = lista.filter((x) => x.status === s);
          return (
            <div className="col" key={s}>
              <h2><i className="dot" style={{ background: COL_COR[s] }} />{STATUS[s]} <b>{col.length}</b>{s !== 'CONCLUIDA' && <Link href="/novo"><span className="ms">add</span></Link>}</h2>
              {col.map((x) => {
                const k = ctxDe(x.contextoId); const cor = corCtx(k); const atrasada = !!x.prazo && x.prazo < hoje && s !== 'CONCLUIDA';
                return (
                  <Link key={x.id} href={`/tarefas/${x.id}`} className={`card ${s === 'CONCLUIDA' ? 'done' : ''}`} style={{ borderLeftColor: cor }}>
                    <div className="ch"><span className="pill" style={{ background: `${cor}1a`, color: cor }}><i className="dot" style={{ background: cor }} />{k.nome}</span>
                      {s === 'CONCLUIDA' ? <span className="pr ok">✓ Concluída</span> : <span className={`pr ${x.prioridade}`}>{PRIO[x.prioridade]}</span>}</div>
                    <p>{x.titulo}</p>
                    {x.descricao && <small>{x.descricao}</small>}
                    {x.prazo && <div className={`dt ${atrasada ? 'late' : ''}`}><span className="ms">calendar_today</span>{fmt(x.prazo)}{atrasada && ' · atrasada'}</div>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
