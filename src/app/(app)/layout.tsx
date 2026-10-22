'use client';
import '../psicotask.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Perfil, Contexto, Tarefa, corCtx } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [me, setMe] = useState<Perfil | null>(null);
  const [ctx, setCtx] = useState<Contexto[]>([]);
  const [ts, setTs] = useState<Tarefa[]>([]);
  useEffect(() => {
    api<Perfil>('/api/auth/me').then(setMe).catch(() => {});
    api<Contexto[]>('/api/contextos').then(setCtx).catch(() => {});
    api<Tarefa[]>('/api/tarefas').then(setTs).catch(() => {});
  }, [path]);
  async function sair() { await api('/api/auth/logout', 'POST'); window.location.href = '/login'; }
  if (!me) return null;
  const ini = me.nome.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><div className="bi"><span className="ms">psychology</span></div><div><b>PsicoTask</b><small>CLÍNICA &amp; ROTINA</small></div></div>
        <div className="h">MENU PRINCIPAL</div>
        <nav className="nav">
          <Link href="/tarefas" className={path.startsWith('/tarefas') || path === '/novo' ? 'on' : ''}><span className="ms">checklist</span>Minhas Tarefas</Link>
          <Link href="/perfil" className={path === '/perfil' ? 'on' : ''}><span className="ms">account_circle</span>Perfil</Link>
        </nav>
        <div className="ctx"><div className="h" style={{ marginLeft: 0, padding: '0 12px' }}>CONTEXTOS</div>
          {ctx.map((c) => <div key={c.id}><i className="dot" style={{ background: corCtx(c) }} />{c.nome}<span>{ts.filter((t) => t.contextoId === c.id).length}</span></div>)}
        </div>
        <div className="user"><div className="av">{ini}</div><div>{me.nome}<small>{me.registroProfissional}</small></div><button onClick={sair} title="Sair"><span className="ms">logout</span></button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
