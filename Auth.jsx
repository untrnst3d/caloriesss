import React, { useEffect, useRef, useState } from 'react';
import { api } from './client.js';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  async function checkSession(showLoading = true) {
    const request = ++generation.current;
    if (showLoading) setChecking(true);
    setUnavailable(false);
    try {
      const result = await api('/auth/me');
      if (request === generation.current) setUser(result.user);
    } catch (e) {
      if (request !== generation.current) return;
      setUser(null);
      if (e.status !== 401) setUnavailable(true);
    } finally {
      if (request === generation.current) setChecking(false);
    }
  }

  function notifyTabs() {
    try { localStorage.setItem('nutriday-auth-change', String(Date.now())); } catch {  }
  }

  useEffect(() => {
    checkSession();
    const expired = () => {
      generation.current++;
      setUser(null);
      setChecking(false);
      setError('Сессия закончилась. Войди снова');
    };
    const changed = event => { if (event.key === 'nutriday-auth-change') checkSession(); };
    window.addEventListener('nutriday-session-ended', expired);
    window.addEventListener('storage', changed);
    const focused = () => checkSession(false);
    window.addEventListener('focus', focused);
    return () => {
      generation.current++;
      window.removeEventListener('nutriday-session-ended', expired);
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', focused);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (register && password !== confirmation) return setError('Пароли не совпадают');
    if (!password.trim()) return setError('Пароль не должен состоять из пробелов');
    setBusy(true);
    const request = ++generation.current;
    try {
      const result = await api(register ? '/auth/register' : '/auth/login', 'POST', { username, password });
      if (request !== generation.current) return;
      setUser(result.user);
      setPassword('');
      setConfirmation('');
      notifyTabs();
    } catch (e) { if (request === generation.current) setError(e.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    generation.current++;
    try {
      await api('/auth/logout', 'POST');
      generation.current++;
      setUser(null);
      setRegister(false);
      setChecking(false);
      setPassword('');
      notifyTabs();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (checking) return <main><p role="status">Проверяем вход…</p></main>;
  if (unavailable) return <main><section><h1>NutriDay</h1>
    <p role="alert">Не удалось подключиться к серверу.</p>
    <button onClick={checkSession}>Повторить</button></section></main>;
  if (user) return <>
    <div className="account-bar"><span>Аккаунт: <strong>{user.username}</strong></span>
      <button onClick={logout} disabled={busy}>Выйти</button>
      {error && <p role="alert">{error}</p>}</div>
    {children(user)}
  </>;
  return <main className="auth-page"><header><h1>NutriDay</h1><p>Личный дневник питания</p></header>
    <section><h2>{register ? 'Регистрация' : 'Вход'}</h2>
      <p>Войди, чтобы открыть свой профиль и записи.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Логин <input autoComplete="username" required minLength="3" maxLength="32"
            pattern="[A-Za-z0-9_]+" value={username} onChange={e => setUsername(e.target.value)} /></label>
          <p className="hint">3–32 символа: латинские буквы, цифры и _. Регистр не важен.</p>
          <label>Пароль <input type="password" required minLength="8" maxLength="128"
            autoComplete={register ? 'new-password' : 'current-password'} value={password}
            onChange={e => setPassword(e.target.value)} /></label>
          {register && <><p className="hint">От 8 до 128 символов.</p>
            <label>Повтори пароль <input type="password" autoComplete="new-password" required
              value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></>}
          {error && <p className="message" role="alert">{error}</p>}
          <button type="submit">{busy ? 'Подожди…' : register ? 'Создать аккаунт' : 'Войти'}</button>
        </fieldset>
      </form>
      <button className="auth-switch" disabled={busy} onClick={() => {
        setRegister(!register); setError(''); setPassword(''); setConfirmation('');
      }}>{register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}</button>
    </section>
  </main>;
}
