'use client';
import { useState } from 'react';
import { Contexto, Tarefa, PRIO, STATUS, msg } from '@/lib/api';

type Props = { ctx: Contexto[]; init?: Tarefa; label: string; onSubmit: (b: Record<string, unknown>) => Promise<void> };

export default function TarefaForm({ ctx, init, label, onSubmit }: Props) {
  const [v, setV] = useState({ titulo: init?.titulo ?? '', descricao: init?.descricao ?? '', contextoId: String(init?.contextoId ?? ctx[0]?.id ?? ''), prioridade: init?.prioridade ?? 'MEDIA', status: init?.status ?? 'PENDENTE', prazo: init?.prazo ?? '' });
  const [err, setErr] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const b: Record<string, unknown> = { titulo: v.titulo, contextoId: +v.contextoId, prioridade: v.prioridade, status: v.status };
    if (v.descricao !== '' || init) b.descricao = v.descricao;
    if (v.prazo) b.prazo = v.prazo; // a API não permite remover um prazo já definido
    try { await onSubmit(b); } catch (x) { setErr(msg(x)); }
  }
  if (!ctx.length) return <p className="err">Crie um contexto em Perfil antes de cadastrar tarefas.</p>;
  return (
    <form onSubmit={enviar}>
      <div className="f"><label>Título</label><input value={v.titulo} onChange={set('titulo')} maxLength={255} required /></div>
      <div className="row">
        <div className="f"><label>Contexto</label><select value={v.contextoId} onChange={set('contextoId')}>{ctx.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div className="f"><label>Prioridade</label><select value={v.prioridade} onChange={set('prioridade')}>{Object.entries(PRIO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
      </div>
      <div className="row">
        <div className="f"><label>Prazo</label><input type="date" value={v.prazo} onChange={set('prazo')} /></div>
        <div className="f"><label>Status</label><select value={v.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
      </div>
      <div className="f"><label>Descrição</label><textarea rows={4} value={v.descricao} onChange={set('descricao')} /></div>
      {err && <p className="err">{err}</p>}
      <div className="act"><button className="btn">{label}</button></div>
    </form>
  );
}
