import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Leaf,
  LayoutDashboard,
  ScanBarcode,
  Apple,
  UserRound,
  Plus,
  ArrowUpRight,
  Footprints,
  Trash2,
  Search,
  Sun,
  ChevronRight,
} from "lucide-react";
import AuthGate from "./Auth.jsx";
import Profile, { Avatar } from "./Profile.jsx";
import Barcode from "./Barcode.jsx";
import { api } from "./client.js";
import { getDayProgress } from "./dailyGoal.js";
import "./style.css";
const tabs = [
  ["Дневник", LayoutDashboard],
  ["Сканер", ScanBarcode],
  ["Продукты", Apple],
  ["Профиль", UserRound],
];
const meals = ["Завтрак", "Обед", "Ужин", "Перекус"];
const blankProduct = { name: "", kcal: "", protein: "", fat: "", carbs: "" };
function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function App({ user, logout, logoutBusy }) {
  const [tab, setTab] = useState("Дневник"),
    [account, setAccount] = useState(null),
    [profile, setProfile] = useState(null),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState([]),
    [day, setDay] = useState(localDay),
    [diary, setDiary] = useState({ entries: [], total: {} }),
    [activities, setActivities] = useState({ entries: [], total: 0 });
  const [productId, setProductId] = useState(""),
    [grams, setGrams] = useState(100),
    [meal, setMeal] = useState("Завтрак"),
    [search, setSearch] = useState("");
  const [portions, setPortions] = useState([]),
    [portionId, setPortionId] = useState(""),
    [portionName, setPortionName] = useState(""),
    [portionGrams, setPortionGrams] = useState(100);
  const [newProduct, setNewProduct] = useState(blankProduct),
    [activityName, setActivityName] = useState(""),
    [burned, setBurned] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [dayReady, setDayReady] = useState(false);
  useEffect(() => {
    let live = true;
    setLoadError("");
    Promise.all([api("/account"), api("/profile"), api("/products")])
      .then(([a, p, foods]) => {
        if (live) {
          setAccount(a);
          setProfile(p);
          setProducts(foods);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setLoadError(e.message);
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    setDayReady(false);
    setDiary({ entries: [], total: {} });
    setActivities({ entries: [], total: 0 });
    if (!day) return;
    Promise.all([api("/diary?day=" + day), api("/activities?day=" + day)])
      .then(([d, a]) => {
        if (live) {
          setDiary(d);
          setActivities(a);
          setDayReady(true);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [day, refresh]);
  useEffect(() => {
    let live = true;
    setPortions([]);
    setPortionId("");
    setGrams(100);
    if (productId)
      api("/portions?product_id=" + productId)
        .then((p) => {
          if (live) setPortions(p);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [productId]);
  async function act(job, success) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await job();
      setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(value) {
    setTab(value);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function imported(product) {
    setProducts((current) =>
      [...current.filter((p) => p.id !== product.id), product].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setProductId(String(product.id));
    navigate("Дневник");
    setMessage("Продукт выбран. Укажи количество и добавь в дневник");
    setTimeout(
      () =>
        document
          .getElementById("meal-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  }
  const selected = products.find((p) => p.id === Number(productId));
  const progress = getDayProgress(
    profile?.calculation?.target_kcal,
    diary.total.kcal || 0,
  );
  const prettyDate = day
    ? new Date(day + "T12:00:00").toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "long",
      })
    : "Выбери дату";
  if (loadError && !ready)
    return (
      <div className="loading-screen">
        <h2>Не удалось открыть дневник</h2>
        <p>{loadError}</p>
        <button onClick={() => setRefresh((x) => x + 1)}>Повторить</button>
      </div>
    );
  if (!ready)
    return (
      <div className="loading-screen">
        <Leaf />
        <p>Загружаем твой дневник…</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Leaf />
          </span>
          NutriDay<span className="brand-dot">.</span>
        </a>
        <p className="nav-label">ТВОЙ КАЖДЫЙ ДЕНЬ</p>
        <nav aria-label="Главная навигация">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={name === tab ? "active" : ""}
              aria-current={name === tab ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={21} />
              <span>{name}</span>
              {name === tab && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Sun />
          <h3>В своём темпе</h3>
          <p>
            Маленькие привычки
            <br />
            складываются в заботу.
          </p>
        </div>
        <button className="sidebar-account" onClick={() => navigate("Профиль")}>
          <Avatar account={account} />
          <span>
            <strong>{account.display_name || user.username}</strong>
            <small>Мой профиль</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">
            Моё пространство <span>/</span> {tab}
          </span>
          <button className="mobile-brand" onClick={() => navigate("Дневник")}>
            <Leaf size={20} />
            NutriDay
          </button>
          <button
            className="account-chip"
            aria-label="Открыть профиль"
            onClick={() => navigate("Профиль")}
          >
            <span>{account.display_name || user.username}</span>
            <Avatar account={account} />
          </button>
        </header>
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              {tab === "Дневник"
                ? "ТВОЙ ДЕНЬ, ТВОЙ БАЛАНС"
                : "NUTRIDAY / " + tab.toUpperCase()}
            </span>
            <h1>
              {tab === "Дневник"
                ? `Привет, ${account.display_name || user.username}`
                : tab === "Сканер"
                  ? "Продукт за пару секунд"
                  : tab === "Продукты"
                    ? "Твой каталог"
                    : "Всё начинается с тебя"}
              <span className="heading-dot">.</span>
            </h1>
            <p className="muted">
              {tab === "Дневник"
                ? "Пусть сегодня будет чуть больше заботы о себе."
                : tab === "Продукты"
                  ? "Любимые продукты и привычные порции — в одном месте."
                  : tab === "Профиль"
                    ? "Твои данные, твои цели, твой ритм."
                    : "Меньше ручного ввода. Больше времени на жизнь."}
            </p>
          </div>
          {tab === "Дневник" && (
            <label className="date-control">
              Дата
              <input
                aria-label="Дата дневника"
                type="date"
                required
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          )}
        </div>
        {(error || loadError) && (
          <div className="message error" role="alert">
            {error || loadError}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setRefresh((x) => x + 1);
              }}
            >
              Повторить загрузку
            </button>
          </div>
        )}
        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
        {tab === "Сканер" && <Barcode onSaved={imported} />}
        {tab === "Профиль" && (
          <Profile
            account={account}
            setAccount={setAccount}
            profile={profile}
            setProfile={setProfile}
            logout={logout}
            logoutBusy={logoutBusy}
          />
        )}
        {tab === "Дневник" && (
          <>
            <div className="dashboard-top">
              <section className="balance-card">
                <div className="balance-copy">
                  <span className="eyebrow">БАЛАНС ЗА ДЕНЬ</span>
                  <h2>
                    {dayReady
                      ? progress
                        ? progress.remaining >= 0
                          ? "Ещё немного до цели"
                          : "Сегодня выше цели"
                        : "Начнём с твоей цели"
                      : "Загружаем день…"}
                  </h2>
                  {progress ? (
                    <>
                      <p className="balance-number">
                        {Math.abs(progress.remaining)}{" "}
                        <span>
                          ккал{" "}
                          {progress.remaining >= 0 ? "осталось" : "сверх цели"}
                        </span>
                      </p>
                      <p>
                        Цель {progress.target} ккал · Съедено {progress.eaten}{" "}
                        ккал
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Заполни короткую анкету —<br />
                        рассчитаем дневную цель.
                      </p>
                      <button
                        className="light-button"
                        onClick={() => navigate("Профиль")}
                      >
                        Заполнить профиль
                        <ArrowUpRight size={18} />
                      </button>
                    </>
                  )}
                </div>
                <div
                  className="calorie-ring"
                  role="img"
                  aria-label={
                    progress
                      ? `Съедено ${progress.eaten} из ${progress.target} ккал`
                      : "Дневная цель не задана"
                  }
                >
                  <svg viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="67" className="ring-track" />
                    <circle
                      cx="80"
                      cy="80"
                      r="67"
                      className="ring-value"
                      strokeDasharray={`${(progress?.percent || 0) * 4.21} 421`}
                    />
                  </svg>
                  <div>
                    <Leaf size={22} />
                    <strong>
                      {dayReady ? Math.round(diary.total.kcal || 0) : "—"}
                    </strong>
                    <small>ккал съедено</small>
                  </div>
                </div>
              </section>
              <section className="card nutrients">
                <span className="eyebrow">НЕ ТОЛЬКО КАЛОРИИ</span>
                <h2>Твой баланс БЖУ</h2>
                {[
                  ["protein", "Белки", "protein"],
                  ["fat", "Жиры", "fat"],
                  ["carbs", "Углеводы", "carbs"],
                ].map(([key, label, cls]) => (
                  <div className="nutrient" key={key}>
                    <span className={"nutrient-dot " + cls} />
                    <span>{label}</span>
                    <strong>
                      {dayReady ? diary.total[key] || 0 : "—"} <small>г</small>
                    </strong>
                  </div>
                ))}
                <p className="field-hint">
                  Фактически съедено за выбранный день
                </p>
              </section>
            </div>
            <div className="dashboard-columns">
              <div>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{prettyDate}</span>
                      <h2>Дневник питания</h2>
                    </div>
                    <span className="count-badge">{diary.entries.length}</span>
                  </div>
                  {!dayReady ? (
                    <p className="muted">
                      {error
                        ? "Не удалось загрузить записи"
                        : "Загружаем записи…"}
                    </p>
                  ) : diary.entries.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Apple size={30} />
                      </span>
                      <h3>Здесь начинается твой день</h3>
                      <p>
                        Добавь первый приём пищи.
                        <br />
                        Продукт можно найти по штрихкоду.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => navigate("Сканер")}
                      >
                        <ScanBarcode size={18} />
                        Найти продукт
                      </button>
                    </div>
                  ) : (
                    meals.map((name) => {
                      const rows = diary.entries.filter((r) => r.meal === name);
                      return (
                        rows.length > 0 && (
                          <div className="meal-group" key={name}>
                            <h3>
                              {name}
                              <span>
                                {Math.round(
                                  rows.reduce((a, r) => a + r.kcal, 0),
                                )}{" "}
                                ккал
                              </span>
                            </h3>
                            {rows.map((item) => (
                              <div className="food-row" key={item.id}>
                                <span className="food-symbol">
                                  <Apple size={21} />
                                </span>
                                <div>
                                  <strong>{item.product_name}</strong>
                                  <p>
                                    {item.portion_name &&
                                      item.portion_name + " · "}
                                    {item.grams} г / мл · Б {item.protein} · Ж{" "}
                                    {item.fat} · У {item.carbs}
                                  </p>
                                </div>
                                <span className="row-kcal">
                                  {item.kcal}
                                  <small>ккал</small>
                                </span>
                                <button
                                  className="icon-button"
                                  aria-label={"Удалить " + item.product_name}
                                  disabled={busy}
                                  onClick={() =>
                                    act(async () => {
                                      await api("/diary/" + item.id, "DELETE");
                                      setDiary(await api("/diary?day=" + day));
                                    }, "Запись удалена")
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      );
                    })
                  )}
                </section>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ДВИЖЕНИЕ В РАДОСТЬ</span>
                      <h2>Активность</h2>
                    </div>
                    <Footprints className="muted" />
                  </div>
                  <p className="muted">
                    {activities.total} ккал за день. Учитываются отдельно от
                    цели.
                  </p>
                  {activities.entries.map((a) => (
                    <div className="activity-row" key={a.id}>
                      <span>{a.name}</span>
                      <strong>{a.kcal} ккал</strong>
                      <button
                        className="icon-button"
                        aria-label={"Удалить активность " + a.name}
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            await api("/activities/" + a.id, "DELETE");
                            setActivities(await api("/activities?day=" + day));
                          }, "Активность удалена")
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await api("/activities", "POST", {
                          day,
                          name: activityName.trim(),
                          kcal: Number(burned),
                        });
                        setActivities(await api("/activities?day=" + day));
                        setActivityName("");
                        setBurned("");
                      }, "Активность добавлена");
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Активность
                        <input
                          required
                          maxLength="80"
                          placeholder="Например, прогулка"
                          value={activityName}
                          onChange={(e) => setActivityName(e.target.value)}
                        />
                      </label>
                      <label>
                        Сожжено ккал
                        <input
                          required
                          type="number"
                          min="0.1"
                          max="10000"
                          step="0.1"
                          placeholder="По данным трекера"
                          value={burned}
                          onChange={(e) => setBurned(e.target.value)}
                        />
                      </label>
                    </div>
                    <button className="secondary" disabled={busy || !dayReady}>
                      <Plus size={18} />
                      Добавить активность
                    </button>
                  </form>
                </section>
              </div>
              <section className="card meal-form" id="meal-form">
                <span className="eyebrow">ЧТО БЫЛО В ТАРЕЛКЕ?</span>
                <h2>Добавить еду</h2>
                <button
                  className="barcode-shortcut"
                  onClick={() => navigate("Сканер")}
                >
                  <ScanBarcode />
                  <span>Найти по штрихкоду</span>
                  <ArrowUpRight size={18} />
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      setDiary(
                        await api("/diary", "POST", {
                          product_id: Number(productId),
                          day,
                          meal,
                          grams: Number(grams),
                          portion_name:
                            portions.find((p) => p.id === Number(portionId))
                              ?.name || "",
                        }),
                      );
                    }, "Добавлено в дневник");
                  }}
                >
                  <label>
                    Приём пищи
                    <select
                      value={meal}
                      onChange={(e) => setMeal(e.target.value)}
                    >
                      {meals.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Продукт
                    <select
                      required
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">Выбери продукт</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected && (
                    <>
                      <label>
                        Сохранённая порция
                        <select
                          value={portionId}
                          onChange={(e) => {
                            setPortionId(e.target.value);
                            const found = portions.find(
                              (p) => p.id === Number(e.target.value),
                            );
                            if (found) setGrams(found.grams);
                          }}
                        >
                          <option value="">Указать количество вручную</option>
                          {portions.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name} · {p.grams} г / мл
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Количество, г / мл
                        <input
                          type="number"
                          required
                          min="0.1"
                          max="5000"
                          step="0.1"
                          value={grams}
                          onChange={(e) => {
                            setGrams(e.target.value);
                            setPortionId("");
                          }}
                        />
                      </label>
                      <div className="portion-preview">
                        <strong>
                          {Math.round(
                            (selected.kcal * Number(grams || 0)) / 100,
                          )}
                          <small> ккал</small>
                        </strong>
                        <span>в этой порции</span>
                      </div>
                      <p className="field-hint">
                        Для значений на 100 г вводи граммы, на 100 мл —
                        миллилитры.
                      </p>
                    </>
                  )}
                  <button
                    className="primary wide"
                    disabled={busy || !selected || !dayReady}
                  >
                    <Plus size={18} />
                    Добавить в дневник
                  </button>
                </form>
              </section>
            </div>
          </>
        )}
        {tab === "Продукты" && (
          <div className="catalog-layout">
            <section className="card">
              <div className="section-heading">
                <h2>
                  Продукты{" "}
                  <span className="count-badge">{products.length}</span>
                </h2>
                <Apple size={24} />
              </div>
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="Поиск продукта"
                  placeholder="Найти в своём каталоге"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <p className="field-hint">
                КБЖУ на 100 г / 100 мл. У исходных продуктов значения примерные.
              </p>
              {products
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <div className="catalog-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <p>
                        Б {p.protein} · Ж {p.fat} · У {p.carbs}
                        {p.source === "openfoodfacts" && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={p.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Food Facts
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <span>
                      {p.kcal}
                      <small> ккал</small>
                    </span>
                    <button
                      className="icon-button add-food"
                      aria-label={"Выбрать " + p.name}
                      onClick={() => imported(p)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                ))}
              {!products.some((p) =>
                p.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <div className="empty-state">
                  <h3>Пока ничего не нашли</h3>
                  <p>Измени запрос или добавь свой продукт.</p>
                </div>
              )}
            </section>
            <div>
              <section className="card">
                <span className="eyebrow">ТВОЙ РЕЦЕПТ, ТВОИ ДАННЫЕ</span>
                <h2>Свой продукт</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      const p = await api("/products", "POST", {
                        name: newProduct.name,
                        ...Object.fromEntries(
                          ["kcal", "protein", "fat", "carbs"].map((k) => [
                            k,
                            Number(newProduct[k]),
                          ]),
                        ),
                      });
                      setProducts((current) =>
                        [...current, p].sort((a, b) =>
                          a.name.localeCompare(b.name),
                        ),
                      );
                      setProductId(String(p.id));
                      setNewProduct(blankProduct);
                    }, "Продукт сохранён");
                  }}
                >
                  <label>
                    Название
                    <input
                      required
                      maxLength="80"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    {[
                      ["kcal", "Ккал"],
                      ["protein", "Белки, г"],
                      ["fat", "Жиры, г"],
                      ["carbs", "Углеводы, г"],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          required
                          type="number"
                          min="0"
                          max={key === "kcal" ? 1000 : 100}
                          step="0.1"
                          value={newProduct[key]}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button className="primary wide" disabled={busy}>
                    Сохранить продукт
                    <Plus size={18} />
                  </button>
                </form>
              </section>
              <section className="card">
                <h2>Привычная порция</h2>
                <p className="muted">Сохрани свой стакан или тарелку.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      const p = await api("/portions", "POST", {
                        product_id: Number(productId),
                        name: portionName,
                        grams: Number(portionGrams),
                      });
                      setPortions((current) => [...current, p]);
                      setPortionName("");
                    }, "Порция сохранена");
                  }}
                >
                  <label>
                    Продукт для порции
                    <select
                      required
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">Выбери продукт</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Название порции
                    <input
                      required
                      maxLength="50"
                      placeholder="Моя кружка"
                      value={portionName}
                      onChange={(e) => setPortionName(e.target.value)}
                    />
                  </label>
                  <label>
                    Количество в порции, г / мл
                    <input
                      required
                      type="number"
                      min="0.1"
                      max="5000"
                      step="0.1"
                      value={portionGrams}
                      onChange={(e) => setPortionGrams(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary wide"
                    disabled={busy || !productId}
                  >
                    Сохранить порцию
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
        <footer className="app-footer">
          <span>
            <Leaf size={14} />
            NutriDay · Забота в простых вещах
          </span>
          <span>Версия 0.0.5</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <AuthGate>
    {(user, logout, busy) => (
      <App key={user.id} user={user} logout={logout} logoutBusy={busy} />
    )}
  </AuthGate>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
