export async function api(path, method = 'GET', data) {
  const isFile = data instanceof Blob;
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin',
    headers: { 'X-NutriDay': '1', ...(data ? { 'Content-Type': isFile ? (data.type || 'application/octet-stream') : 'application/json' } : {}) },
    body: isFile ? data : data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('nutriday-session-ended'));
    }
    const body = await response.json().catch(() => ({}));
    const error = new Error(typeof body.detail === 'string' ? body.detail
      : response.status === 422 ? 'Проверь заполнение полей и допустимые значения'
      : 'Не удалось сохранить или загрузить данные');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
