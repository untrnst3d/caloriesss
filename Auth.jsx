import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Leaf, ShieldCheck, Sun } from "lucide-react";
import { api, setActiveAccount } from "./client.js";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busyRef = useRef(false);

  function acceptUser(next) {
    setActiveAccount(next?.id || null);
    setUser(next);
  }
  async function checkSession() {
    if (busyRef.current) return;
    const request = ++generation.current;
    try {
      const result = await api("/auth/me");
      if (request === generation.current) {
        acceptUser(result.user);
        setUnavailable(false);
      }
    } catch (e) {
      if (request !== generation.current) return;
      if (e.status === 401) {
        acceptUser(null);
        setUnavailable(false);
      } else setUnavailable(true);
    } finally {
      if (request === generation.current) setChecking(false);
    }
  }
  function notifyTabs() {
    try {
      localStorage.setItem("nutriday-auth-change", String(Date.now()));
    } catch {}
  }
  useEffect(() => {
    checkSession();
    const expired = () => {
      generation.current++;
      acceptUser(null);
      setError("Войди снова: сессия завершилась или аккаунт изменился");
    };
    const changed = (e) => {
      if (e.key === "nutriday-auth-change") checkSession();
    };
    window.addEventListener("nutriday-session-ended", expired);
    window.addEventListener("storage", changed);
    window.addEventListener("focus", checkSession);
    return () => {
      generation.current++;
      window.removeEventListener("nutriday-session-ended", expired);
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", checkSession);
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busyRef.current) return;
    setError("");
    if (register && password !== confirmation)
      return setError("Пароли не совпадают");
    if (!password.trim())
      return setError("Пароль не должен состоять из пробелов");
    busyRef.current = true;
    setBusy(true);
    generation.current++;
    try {
      const result = await api(
        register ? "/auth/register" : "/auth/login",
        "POST",
        { username, password },
      );
      acceptUser(result.user);
      setPassword("");
      setConfirmation("");
      notifyTabs();
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    generation.current++;
    try {
      await api("/auth/logout", "POST");
      acceptUser(null);
      setRegister(false);
      setPassword("");
      notifyTabs();
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="loading-screen">
        <Leaf size={36} />
        <p>Открываем NutriDay…</p>
      </div>
    );
  if (unavailable)
    return (
      <div className="loading-screen">
        <Leaf size={36} />
        <h2>Не получается связаться с сервером</h2>
        <p>Проверь подключение к интернету и попробуй ещё раз.</p>
        <button onClick={checkSession}>Повторить</button>
      </div>
    );
  if (user)
    return (
      <>
        {error && (
          <p className="global-message" role="alert">
            {error}
          </p>
        )}
        {children(user, logout, busy)}
      </>
    );
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Leaf />
          </span>
          NutriDay<span className="brand-dot">.</span>
        </a>
        <div className="story-copy">
          <span className="eyebrow">МАЛЕНЬКИЕ ШАГИ. ТВОЙ РИТМ.</span>
          <h1>
            Больше заботы.
            <br />
            <em>Меньше сложностей.</em>
          </h1>
          <p>Питание, которое понятно. Дневник, который всегда под рукой.</p>
          <div className="plate-art" aria-hidden="true">
            <div className="plate-inner">
              <Leaf size={80} />
              <span>
                Каждый день —<br />
                новое начало
              </span>
            </div>
            <span className="art-badge">
              <Sun size={18} /> В своём темпе
            </span>
          </div>
        </div>
        <p className="story-bottom">Твой маленький ежедневный ритуал</p>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span>
          <h2>{register ? "Начнём знакомство" : "С возвращением"}</h2>
          <p className="muted">
            {register
              ? "Создай аккаунт для своего дневника питания."
              : "Войди, чтобы продолжить заботиться о себе."}
          </p>
          <div className="segmented">
            <button
              className={!register ? "selected" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
                setPassword("");
              }}
              disabled={busy}
            >
              Вход
            </button>
            <button
              className={register ? "selected" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
                setPassword("");
              }}
              disabled={busy}
            >
              Регистрация
            </button>
          </div>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Логин
                <input
                  required
                  autoComplete="username"
                  minLength="3"
                  maxLength="32"
                  pattern="[A-Za-z0-9_]+"
                  placeholder="Например, ulyana"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <p className="field-hint">
                3–32 символа: латинские буквы, цифры и _
              </p>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength="8"
                  maxLength="128"
                  placeholder="Не менее 8 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {register && (
                <label>
                  Повтори пароль
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              )}
              {error && (
                <p className="message error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary wide" type="submit">
                {busy
                  ? "Подожди…"
                  : register
                    ? "Создать аккаунт"
                    : "Войти в NutriDay"}
                <ArrowUpRight size={20} />
              </button>
            </fieldset>
          </form>
          <p className="auth-note">
            <ShieldCheck size={18} /> Твои записи доступны только в твоём
            аккаунте.
          </p>
        </div>
      </main>
    </div>
  );
}
