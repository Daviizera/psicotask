'use client';
import '../psicotask.css';
import { useState } from 'react';
import { api, msg } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [err, setErr] = useState('');
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try { await api('/api/auth/login', 'POST', { email, senha }); window.location.href = '/tarefas'; }
    catch (x) { setErr(msg(x)); }
  }
  return (
    <div className="auth">
      <div className="l">
        <div className="logo">Psico<span>Task</span></div>
        <h2>Suas tarefas e compromissos, organizados por contexto.</h2>
        <p style={{ color: 'var(--b)' }}>Atendimento, estudo, supervisão e rotina administrativa em um só lugar.</p>
      </div>
      <div className="r">
        <form className="box" onSubmit={entrar}>
          <h1>Entrar</h1>
          <div className="f"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="f"><label>Senha</label><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ width: '100%' }}>Entrar</button>
        </form>
      </div>
    </div>
  );
}
