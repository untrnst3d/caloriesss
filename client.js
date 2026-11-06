let activeAccount = null;
export function setActiveAccount(id) {
  activeAccount = id;
}
export async function api(path, method = "GET", data) {
  const file = data instanceof Blob;
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "X-NutriDay": "1",
      ...(activeAccount && !path.startsWith("/auth/")
        ? { "X-Account-ID": String(activeAccount) }
        : {}),
      ...(data
        ? {
            "Content-Type": file
              ? "application/octet-stream"
              : "application/json",
          }
        : {}),
    },
    body: data ? (file ? data : JSON.stringify(data)) : undefined,
  });
  if (!response.ok) {
    if (
      (response.status === 401 || response.status === 409) &&
      !path.startsWith("/auth/")
    ) {
      if (response.status === 401 || response.headers.get("X-Account-Changed"))
        window.dispatchEvent(new Event("nutriday-session-ended"));
    }
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      typeof body.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Проверь заполнение полей и допустимые значения"
          : "Не удалось сохранить или загрузить данные",
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}
