'use client';
import '../psicotask.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Perfil, Contexto, corDe } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [me, setMe] = useState<Perfil | null>(null);
  const [ctx, setCtx] = useState<Contexto[]>([]);
  useEffect(() => {
    api<Perfil>('/api/auth/me').then(setMe).catch(() => {});
    api<Contexto[]>('/api/contextos').then(setCtx).catch(() => {});
  }, [path]);
  async function sair() { await api('/api/auth/logout', 'POST'); window.location.href = '/login'; }
  if (!me) return null;
  return (
    <div className="app">
      <aside className="side">
        <div className="logo">Psico<span>Task</span></div>
        <nav className="nav">
          <Link href="/tarefas" className={path.startsWith('/tarefas') || path === '/novo' ? 'on' : ''}>Tarefas</Link>
          <Link href="/perfil" className={path === '/perfil' ? 'on' : ''}>Perfil</Link>
        </nav>
        <div className="h">CONTEXTOS</div>
        <div className="ctx">{ctx.map((c) => <div key={c.id}><i className="dot" style={{ background: corDe(c.id) }} />{c.nome}</div>)}</div>
        <div className="user">{me.nome}<small>{me.registroProfissional}</small><button onClick={sair}>Sair</button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
