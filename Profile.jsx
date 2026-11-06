import React, { useState } from "react";
import { Camera, Check, LogOut, Smartphone, UserRound } from "lucide-react";
import { api } from "./client.js";
export const emptyProfile = {
  sex: "female",
  age: "",
  height: "",
  weight: "",
  activity: "low",
  goal: "maintain",
};
export function Avatar({ account, large = false }) {
  return (
    <span className={"avatar" + (large ? " avatar-large" : "")}>
      {account?.avatar_url ? (
        <img src={account.avatar_url} alt="Твоя аватарка" />
      ) : (
        (account?.display_name || account?.username || "N")
          .slice(0, 1)
          .toUpperCase()
      )}
    </span>
  );
}
export default function Profile({
  account,
  setAccount,
  profile,
  setProfile,
  logout,
  logoutBusy,
}) {
  const [name, setName] = useState(account.display_name || "");
  const [form, setForm] = useState(profile?.profile || emptyProfile);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function action(job, success) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await job();
      setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function photo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)
      return setError("Выбери фото не больше 5 МБ");
    await action(
      async () => setAccount(await api("/account/avatar", "PUT", file)),
      "Аватарка обновлена",
    );
  }
  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }
  return (
    <>
      <div className="profile-feedback">
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="message" role="status">
            <Check size={18} />
            {message}
          </p>
        )}
      </div>
      <div className="profile-layout">
        <div>
          <section className="card identity-card">
            <Avatar account={account} large />
            <h2>{account.display_name || account.username}</h2>
            <p className="muted">@{account.username}</p>
            <label
              className={"secondary photo-button" + (busy ? " disabled" : "")}
            >
              <Camera size={18} />
              Загрузить фото
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={photo}
              />
            </label>
            <p className="field-hint">
              JPG, PNG, WebP · до 5 МБ и 12 Мп.
              <br />
              Фото обрезается до квадрата по центру.
            </p>
            {account.avatar_url && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  action(
                    async () =>
                      setAccount(await api("/account/avatar", "DELETE")),
                    "Фото удалено",
                  )
                }
              >
                Удалить фото
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(
                  async () =>
                    setAccount(
                      await api("/account", "PUT", { display_name: name }),
                    ),
                  "Имя сохранено",
                );
              }}
            >
              <label>
                Как тебя называть
                <input
                  required
                  maxLength="60"
                  placeholder="Твоё имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button className="secondary wide" disabled={busy}>
                Сохранить имя
              </button>
            </form>
            <button
              className="logout-button"
              disabled={logoutBusy || busy}
              onClick={logout}
            >
              <LogOut size={18} />
              Выйти из аккаунта
            </button>
          </section>
          <section className="card phone-tip">
            <Smartphone size={28} />
            <h3>Всегда под рукой</h3>
            <p>
              На iPhone открой приложение в Safari, нажми «Поделиться» → «На
              экран Домой».
            </p>
            <p className="field-hint">
              Нужен адрес работающего сервера. Без интернета дневник недоступен.
            </p>
          </section>
        </div>
        <section className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ПОДСТРОИМ ПОД ТЕБЯ</span>
              <h2>Моя анкета</h2>
            </div>
            <UserRound size={28} />
          </div>
          <p className="muted">
            По анкете рассчитаем ориентировочную дневную цель.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                const saved = await api("/profile", "PUT", {
                  ...form,
                  age: Number(form.age),
                  height: Number(form.height),
                  weight: Number(form.weight),
                });
                setProfile(saved);
                setForm(saved.profile);
              }, "Анкета сохранена. Дневная цель обновлена");
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Пол для расчёта
                <select name="sex" value={form.sex} onChange={change}>
                  <option value="female">Женский</option>
                  <option value="male">Мужской</option>
                </select>
              </label>
              <div className="form-grid three">
                {[
                  ["age", "Возраст, лет", 19, 78, 1],
                  ["height", "Рост, см", 120, 230, 0.1],
                  ["weight", "Вес, кг", 35, 250, 0.1],
                ].map(([key, label, min, max, step]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      required
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={form[key]}
                      onChange={change}
                    />
                  </label>
                ))}
              </div>
              <label>
                Уровень активности
                <select name="activity" value={form.activity} onChange={change}>
                  <option value="low">Низкая — в основном сидя</option>
                  <option value="light">Лёгкая — немного движения</option>
                  <option value="moderate">
                    Средняя — регулярные нагрузки
                  </option>
                  <option value="high">Высокая — интенсивные нагрузки</option>
                </select>
              </label>
              <label>
                Моя цель
                <select name="goal" value={form.goal} onChange={change}>
                  <option value="maintain">Сохранить вес</option>
                  <option value="lose">Похудеть</option>
                  <option value="gain">Набрать вес</option>
                </select>
              </label>
              <button type="submit" className="primary wide">
                {busy ? "Сохраняем…" : "Сохранить анкету"}
                <Check size={18} />
              </button>
            </fieldset>
          </form>
          {profile?.calculation && (
            <div className="profile-target">
              <span>Твоя дневная цель</span>
              <strong>
                {profile.calculation.target_kcal}
                <small> ккал</small>
              </strong>
              <p>Расчёт по сохранённой анкете</p>
            </div>
          )}
          <p className="field-hint">
            Формула Миффлина — Сан Жеора, для взрослых 19–78 лет. Цель
            ориентировочная. При заболеваниях, беременности и кормлении согласуй
            питание со специалистом. Тренировки отдельно не увеличивают цель;
            текущая цель применяется ко всем датам.
          </p>
        </section>
      </div>
    </>
  );
}
