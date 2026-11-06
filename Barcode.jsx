import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  ScanBarcode,
  Search,
  X,
  ArrowRight,
  Check,
} from "lucide-react";
import { api } from "./client.js";

const labels = {
  kcal: "Ккал",
  protein: "Белки, г",
  fat: "Жиры, г",
  carbs: "Углеводы, г",
};
export default function Barcode({ onSaved }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef(null),
    controls = useRef(null),
    sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      controls.current?.stop();
    },
    [],
  );
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Для камеры открой приложение по HTTPS. Сейчас можно ввести номер вручную.",
          );
        const [
          { BrowserMultiFormatReader },
          { BarcodeFormat, DecodeHintType },
        ] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.ITF,
        ]);
        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 300,
        });
        const controller = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video.current,
          (value, err, control) => {
            if (value && !cancelled) {
              cancelled = true;
              control.stop();
              setScanning(false);
              const digits = value.getText();
              setCode(digits);
              lookup(digits);
            }
          },
        );
        if (cancelled) controller.stop();
        else controls.current = controller;
      } catch (e) {
        if (!cancelled) {
          setError(
            e.name === "NotAllowedError"
              ? "Доступ к камере не разрешён. Разреши его в настройках Safari или введи номер вручную."
              : e.name === "NotFoundError"
                ? "Камера не найдена. Введи номер штрихкода вручную."
                : e.message || "Не удалось включить камеру",
          );
          setScanning(false);
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [scanning]);
  async function lookup(value) {
    const id = ++sequence.current;
    setError("");
    setBusy(true);
    setResult(null);
    setDraft(null);
    const clean = value.replace(/\s/g, "");
    setCode(clean);
    try {
      const data = await api("/barcodes/" + encodeURIComponent(clean));
      if (id !== sequence.current) return;
      setResult(data);
      if (!data.existing_product)
        setDraft({
          name: data.name || "",
          ...Object.fromEntries(
            Object.keys(labels).map((k) => [k, data[k] ?? ""]),
          ),
        });
    } catch (e) {
      if (id === sequence.current) setError(e.message);
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api("/barcodes/" + code + "/import", "POST", {
        name: draft.name,
        ...Object.fromEntries(
          Object.keys(labels).map((k) => [k, Number(draft[k])]),
        ),
      });
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="scan-layout">
      <section className="card scan-card">
        <span className="eyebrow">ИЗ УПАКОВКИ — В ДНЕВНИК</span>
        <h2>
          Найди продукт
          <br />
          по штрихкоду
        </h2>
        <p className="muted">
          Наведи камеру на полоски или введи цифры под ними.
        </p>
        <div className="scan-illustration" aria-hidden="true">
          <ScanBarcode size={108} strokeWidth={1} />
          <span>EAN / UPC</span>
        </div>
        <button
          className="primary wide"
          disabled={busy}
          onClick={() => {
            setError("");
            setScanning(true);
          }}
        >
          <Camera size={20} />
          Сканировать камерой
        </button>
        <div className="divider">
          <span>или введи номер</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
        >
          <label>
            Штрихкод
            <input
              inputMode="numeric"
              pattern="[0-9 ]+"
              required
              minLength="8"
              maxLength="20"
              placeholder="Например, 3017620422003"
              value={code}
              disabled={busy}
              onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
                setDraft(null);
              }}
            />
          </label>
          <button className="secondary wide" disabled={busy} type="submit">
            <Search size={18} />
            {busy ? "Загружаем…" : "Найти продукт"}
          </button>
        </form>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div>
        {result?.existing_product ? (
          <section className="card">
            <span className="success-tag">
              <Check size={16} />
              Уже в твоём каталоге
            </span>
            <h2>{result.existing_product.name}</h2>
            <p>{result.existing_product.kcal} ккал на 100 г / 100 мл</p>
            <button
              className="primary"
              onClick={() => onSaved(result.existing_product)}
            >
              Добавить в дневник
              <ArrowRight size={18} />
            </button>
          </section>
        ) : draft ? (
          <section className="card">
            <span className="eyebrow">
              {result.found ? "ПРОДУКТ НАЙДЕН" : "ДОБАВИМ ВРУЧНУЮ"}
            </span>
            <h2>
              {result.found ? "Проверь данные" : "В базе пока нет этого товара"}
            </h2>
            <p className="muted">
              {result.found
                ? `${result.brand || ""} ${result.quantity || ""}`
                : "Перепиши название и БЖУ с упаковки. Продукт сохранится в твоём каталоге."}
            </p>
            <p className="info-note">
              Все значения — на 100 г или 100 мл. Для напитка указывай в
              дневнике объём в мл. Данные на порцию сначала пересчитай на 100.
            </p>
            {result.missing?.length > 0 && (
              <p className="message">
                В базе не хватает части БЖУ. Заполни пустые поля с упаковки —
                это не нулевые значения.
              </p>
            )}
            <form onSubmit={save}>
              <label>
                Название продукта
                <input
                  required
                  maxLength="80"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                {Object.entries(labels).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      required
                      type="number"
                      min="0"
                      max={k === "kcal" ? 1000 : 100}
                      step="0.01"
                      value={draft[k]}
                      onChange={(e) =>
                        setDraft({ ...draft, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <button type="submit" disabled={busy} className="primary wide">
                {busy ? "Сохраняем…" : "Сохранить в мой каталог"}
                <ArrowRight size={18} />
              </button>
            </form>
            {result.found && (
              <p className="source-note">
                Источник:{" "}
                <a href={result.source_url} target="_blank" rel="noreferrer">
                  Open Food Facts
                </a>
                . Свёрка с упаковкой обязательна: база заполняется участниками.
              </p>
            )}
          </section>
        ) : (
          <section className="card how-card">
            <span className="eyebrow">КАК ЭТО РАБОТАЕТ</span>
            <h2>Три простых шага</h2>
            {[
              [
                "01",
                "Найди штрихкод",
                "Он обычно на обратной стороне упаковки.",
              ],
              [
                "02",
                "Проверь карточку",
                "Название, калории и БЖУ — по данным Open Food Facts.",
              ],
              [
                "03",
                "Сохрани продукт",
                "Он появится в твоём каталоге. Останется выбрать порцию.",
              ],
            ].map(([n, t, d]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <p className="source-note">
              Данные:{" "}
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noreferrer"
              >
                Open Food Facts
              </a>{" "}
              ·{" "}
              <a
                href="https://opendatacommons.org/licenses/odbl/1-0/"
                target="_blank"
                rel="noreferrer"
              >
                ODbL
              </a>
              . Найдутся не все товары.
            </p>
          </section>
        )}
      </div>
      {scanning && (
        <div className="modal-backdrop">
          <section
            className="scanner-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Сканер штрихкода"
          >
            <button
              className="icon-button close"
              autoFocus
              aria-label="Закрыть камеру"
              onClick={() => setScanning(false)}
            >
              <X />
            </button>
            <h2>Штрихкод в рамке</h2>
            <p>Держи упаковку ровно, при хорошем освещении.</p>
            <video ref={video} muted playsInline autoPlay />
            <button
              className="secondary wide"
              onClick={() => setScanning(false)}
            >
              Ввести номер вручную
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
