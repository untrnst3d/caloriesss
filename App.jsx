import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const today = new Date().toLocaleDateString('en-CA');
const emptyProduct = { name: '', kcal: '', protein: '', fat: '', carbs: '' };
const meals = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

async function api(path, method = 'GET', data) {
  const response = await fetch('/api' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) throw new Error('Не удалось сохранить или загрузить данные');
  return response.json();
}

function App() {
  const [tab, setTab] = useState('Дневник');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState('Завтрак');
  const [day, setDay] = useState(today);
  const [diary, setDiary] = useState({ entries: [], total: {} });
  const [portions, setPortions] = useState([]);
  const [portionId, setPortionId] = useState('');
  const [portionName, setPortionName] = useState('');
  const [portionGrams, setPortionGrams] = useState(100);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/products').then(setProducts).catch(error => setMessage(error.message));
  }, []);

  useEffect(() => {
    api('/diary?day=' + day).then(setDiary).catch(error => setMessage(error.message));
  }, [day]);

  useEffect(() => {
    if (!productId) return;
    api('/portions?product_id=' + productId)
      .then(setPortions).catch(error => setMessage(error.message));
    setPortionId('');
    setGrams(100);
  }, [productId]);

  const product = products.find(item => item.id === Number(productId));
  const shownProducts = products.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );
  const nutrients = product && ['kcal', 'protein', 'fat', 'carbs'].map(key =>
    Math.round(product[key] * Number(grams || 0) / 100 * 10) / 10
  );

  async function addProduct(event) {
    event.preventDefault();
    try {
      const saved = await api('/products', 'POST', {
        name: newProduct.name,
        kcal: Number(newProduct.kcal), protein: Number(newProduct.protein),
        fat: Number(newProduct.fat), carbs: Number(newProduct.carbs),
      });
      setProducts([...products, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setProductId(String(saved.id));
      setNewProduct(emptyProduct);
      setMessage('Продукт сохранён');
    } catch (error) { setMessage(error.message); }
  }

  async function addPortion(event) {
    event.preventDefault();
    if (!productId) return setMessage('Сначала выбери продукт');
    try {
      const saved = await api('/portions', 'POST', {
        product_id: Number(productId), name: portionName, grams: Number(portionGrams),
      });
      setPortions([...portions, saved]);
      setPortionId(String(saved.id));
      setGrams(saved.grams);
      setPortionName('');
      setMessage('Порция сохранена');
    } catch (error) { setMessage(error.message); }
  }

  async function addEntry(event) {
    event.preventDefault();
    if (!productId) return setMessage('Сначала выбери продукт');
    try {
      const selected = portions.find(item => item.id === Number(portionId));
      const saved = await api('/diary', 'POST', {
        product_id: Number(productId), day, meal, grams: Number(grams),
        portion_name: selected ? selected.name : '',
      });
      setDiary(saved);
      setMessage('Добавлено в дневник');
    } catch (error) { setMessage(error.message); }
  }

  async function removeEntry(id) {
    try {
      await api('/diary/' + id, 'DELETE');
      setDiary(await api('/diary?day=' + day));
      setMessage('Запись удалена');
    } catch (error) { setMessage(error.message); }
  }

  return (
    <main>
      <header>
        <h1>NutriDay</h1>
        <p>Учёт питания</p>
      </header>
      <nav>
        {['Дневник', 'Продукты'].map(name =>
          <button key={name} className={tab === name ? 'active' : ''}
            onClick={() => { setTab(name); setMessage(''); }}>{name}</button>
        )}
      </nav>
      {message && <p className="message" role="alert">{message}</p>}

      {tab === 'Дневник' && <>
        <section>
          <h2>Дневник за день</h2>
          <label>Дата <input type="date" value={day}
            onChange={event => setDay(event.target.value)} /></label>
          <p>Всего: {diary.total.kcal || 0} ккал · Б {diary.total.protein || 0} г ·
            Ж {diary.total.fat || 0} г · У {diary.total.carbs || 0} г</p>
          {diary.entries.length === 0 && <p>За этот день пока нет записей.</p>}
          {meals.map(name => {
            const entries = diary.entries.filter(item => item.meal === name);
            return entries.length > 0 && <div key={name}>
              <h3>{name}</h3>
              {entries.map(item => <div className="row" key={item.id}>
                <span>{item.product_name} · {item.portion_name || item.grams + ' г'}
                  {item.portion_name && ' (' + item.grams + ' г)'} · {item.kcal} ккал</span>
                <button onClick={() => removeEntry(item.id)}>Удалить</button>
              </div>)}
            </div>;
          })}
        </section>
        <section>
          <h2>Добавить приём пищи</h2>
          <form onSubmit={addEntry}>
            <label>Приём пищи <select value={meal}
              onChange={event => setMeal(event.target.value)}>
              {meals.map(name => <option key={name}>{name}</option>)}
            </select></label>
            <label>Продукт <select value={productId} required
              onChange={event => setProductId(event.target.value)}>
              <option value="">Выбери продукт</option>
              {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            {product && <>
              <label>Порция <select value={portionId} onChange={event => {
                const id = event.target.value;
                setPortionId(id);
                const found = portions.find(item => item.id === Number(id));
                if (found) setGrams(found.grams);
              }}>
                <option value="">Ввести граммы вручную</option>
                {portions.map(item => <option key={item.id} value={item.id}>
                  {item.name} · {item.grams} г
                </option>)}
              </select></label>
              <label>Граммы <input type="number" min="1" max="5000" step="0.1"
                required value={grams} onChange={event => {
                  setGrams(event.target.value);
                  setPortionId('');
                }} /></label>
              <p>Для порции: {nutrients[0]} ккал · Б {nutrients[1]} г ·
                Ж {nutrients[2]} г · У {nutrients[3]} г</p>
            </>}
            <button type="submit">Добавить в дневник</button>
          </form>
        </section>
      </>}

      {tab === 'Продукты' && <>
        <section>
          <h2>Каталог</h2>
          <p>Калории и БЖУ указаны на 100 г. Значения примерные.</p>
          <input placeholder="Поиск продукта" value={search}
            onChange={event => setSearch(event.target.value)} />
          {shownProducts.map(item => <div className="row" key={item.id}>
            <span>{item.name} · {item.kcal} ккал · Б {item.protein} ·
              Ж {item.fat} · У {item.carbs}</span>
            <button onClick={() => { setProductId(String(item.id)); setTab('Дневник'); }}>
              Выбрать</button>
          </div>)}
        </section>
        <section>
          <h2>Свой продукт</h2>
          <form onSubmit={addProduct}>
            {Object.keys(emptyProduct).map(key => <label key={key}>
              {{ name: 'Название', kcal: 'Ккал', protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' }[key]}
              <input required type={key === 'name' ? 'text' : 'number'}
                min={key === 'name' ? undefined : 0} step={key === 'name' ? undefined : '0.1'}
                value={newProduct[key]} onChange={event => setNewProduct({
                  ...newProduct, [key]: event.target.value,
                })} />
            </label>)}
            <button type="submit">Сохранить продукт</button>
          </form>
        </section>
        <section>
          <h2>Своя порция</h2>
          <p>Например: «Моя кружка» — 250 г. Выбери продукт в дневнике.</p>
          <form onSubmit={addPortion}>
            <p>Продукт: {product?.name || 'не выбран'}</p>
            <label>Название порции <input required value={portionName}
              onChange={event => setPortionName(event.target.value)} /></label>
            <label>Вес в граммах <input type="number" min="1" max="5000"
              step="0.1" required value={portionGrams}
              onChange={event => setPortionGrams(event.target.value)} /></label>
            <button type="submit">Сохранить порцию</button>
          </form>
        </section>
      </>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
