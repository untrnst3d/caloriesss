import React, { useEffect, useState } from 'react';
import { api } from './client.js';

export default function ProfilePhoto() {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api('/account').then(data => { if (active) setPhoto(data.avatar_url); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  async function update(file) {
    if (busy) return;
    setError('');
    setMessage('');
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Выбери фото не больше 5 МБ');
      return;
    }
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Выбери фотографию в формате JPG, PNG или WebP');
      return;
    }
    setBusy(true);
    try {
      const data = await api('/account/avatar', file ? 'PUT' : 'DELETE', file || undefined);
      setPhoto(data.avatar_url);
      setMessage(file ? 'Фотография сохранена' : 'Фотография удалена');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="profile-photo">
    <div className="profile-photo-preview">
      {photo ? <img src={photo} alt="Фото профиля" /> : <span>Нет фото</span>}
    </div>
    <div>
      <h3>Фотография профиля</h3>
      {loading ? <p role="status">Загружаем фото…</p> : <>
        <label>Добавить или заменить фото
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) update(file);
            }} />
        </label>
        <p className="hint">JPG, PNG или WebP, до 5 МБ и 12 мегапикселей. Фото обрезается до квадрата по центру и сохраняется автоматически.</p>
        {photo && <button type="button" disabled={busy} onClick={() => update(null)}>Удалить фото</button>}
      </>}
      {busy && <p role="status">Сохраняем…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error} <button type="button" disabled={busy || loading}
        onClick={() => setRetry(value => value + 1)}>Повторить загрузку</button></p>}
    </div>
  </div>;
}
