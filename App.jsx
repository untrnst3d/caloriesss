import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  async function loadProducts() {
    setError('');
    try {
      // Берём данные с сервера по адресу /api/products.
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Ошибка запроса');
      const data = await response.json();
      setProducts(data);
    } catch {
      setError('Не удалось загрузить продукты. Проверь, запущен ли Python.');
    }
  }

  return (
    <main>
      <h1>NutriDay</h1>
      <p>Калорийность продуктов на 100 г</p>
      <button onClick={loadProducts}>Загрузить продукты</button>
      <p role="alert">{error}</p>
      <ul>
        {products.map(product => (
          <li key={product.id}>{product.name} — {product.kcal} ккал</li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
