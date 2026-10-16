import sqlite3
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="NutriDay")
DB = Path(__file__).with_name("nutriday.sqlite3")


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kcal: float = Field(ge=0, le=1000)
    protein: float = Field(ge=0, le=100)
    fat: float = Field(ge=0, le=100)
    carbs: float = Field(ge=0, le=100)


class Portion(BaseModel):
    product_id: int
    name: str = Field(min_length=1, max_length=50)
    grams: float = Field(gt=0, le=5000)


class DiaryEntry(BaseModel):
    product_id: int
    day: date
    meal: str = Field(pattern="^(Завтрак|Обед|Ужин|Перекус)$")
    grams: float = Field(gt=0, le=5000)
    portion_name: str = Field(default="", max_length=50)


def query(sql, values=()):
    with sqlite3.connect(DB) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        result = db.execute(sql, values)
        return [dict(row) for row in result.fetchall()] if result.description else []


def init_db():
    with sqlite3.connect(DB) as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL,
                kcal REAL NOT NULL, protein REAL NOT NULL,
                fat REAL NOT NULL, carbs REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portions (
                id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL,
                name TEXT NOT NULL, grams REAL NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
            CREATE TABLE IF NOT EXISTS diary (
                id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL,
                day TEXT NOT NULL, meal TEXT NOT NULL,
                grams REAL NOT NULL, portion_name TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
            CREATE INDEX IF NOT EXISTS diary_day ON diary(day);
        """)
        if db.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            products = [
                ("Яблоко", 52, 0.3, 0.2, 14),
                ("Банан", 89, 1.1, 0.3, 23),
                ("Молоко 2,5%", 52, 3, 2.5, 4.7),
                ("Яйцо куриное", 157, 12.7, 11.5, 0.7),
                ("Гречка сухая", 343, 13, 3.4, 72),
                ("Рис сухой", 344, 7, 0.6, 78),
                ("Куриная грудка", 113, 23, 1.9, 0),
                ("Огурец", 15, 0.8, 0.1, 2.8),
                ("Помидор", 20, 1.1, 0.2, 3.7),
                ("Творог 5%", 121, 17, 5, 1.8),
                ("Овсяные хлопья сухие", 366, 11.9, 7.2, 69),
                ("Хлеб пшеничный", 265, 8, 3.2, 49),
                ("Картофель", 77, 2, 0.4, 16.3),
                ("Говядина", 187, 18.9, 12.4, 0),
                ("Лосось", 208, 20, 13, 0),
                ("Морковь", 41, 0.9, 0.2, 10),
                ("Сыр твёрдый", 350, 25, 27, 2),
                ("Кефир 2,5%", 53, 2.9, 2.5, 4),
            ]
            db.executemany(
                "INSERT INTO products (name, kcal, protein, fat, carbs) VALUES (?, ?, ?, ?, ?)",
                products,
            )


init_db()


@app.get("/api/products")
def get_products():
    return query("SELECT * FROM products ORDER BY name")


@app.post("/api/products", status_code=201)
def add_product(product: Product):
    item = query(
        "INSERT INTO products (name, kcal, protein, fat, carbs) VALUES (?, ?, ?, ?, ?) RETURNING *",
        (product.name.strip(), product.kcal, product.protein, product.fat, product.carbs),
    )
    return item[0]


@app.get("/api/portions")
def get_portions(product_id: int):
    return query("SELECT * FROM portions WHERE product_id = ? ORDER BY id", (product_id,))


@app.post("/api/portions", status_code=201)
def add_portion(portion: Portion):
    if not query("SELECT id FROM products WHERE id = ?", (portion.product_id,)):
        raise HTTPException(404, "Продукт не найден")
    item = query(
        "INSERT INTO portions (product_id, name, grams) VALUES (?, ?, ?) RETURNING *",
        (portion.product_id, portion.name.strip(), portion.grams),
    )
    return item[0]


@app.get("/api/diary")
def get_diary(day: date):
    rows = query("""
        SELECT diary.*, products.name AS product_name,
               ROUND(products.kcal * diary.grams / 100, 1) AS kcal,
               ROUND(products.protein * diary.grams / 100, 1) AS protein,
               ROUND(products.fat * diary.grams / 100, 1) AS fat,
               ROUND(products.carbs * diary.grams / 100, 1) AS carbs
        FROM diary JOIN products ON products.id = diary.product_id
        WHERE diary.day = ? ORDER BY diary.id
    """, (day.isoformat(),))
    total = {key: round(sum(row[key] for row in rows), 1)
             for key in ("kcal", "protein", "fat", "carbs")}
    return {"entries": rows, "total": total}


@app.post("/api/diary", status_code=201)
def add_diary(entry: DiaryEntry):
    if not query("SELECT id FROM products WHERE id = ?", (entry.product_id,)):
        raise HTTPException(404, "Продукт не найден")
    query(
        "INSERT INTO diary (product_id, day, meal, grams, portion_name) VALUES (?, ?, ?, ?, ?)",
        (entry.product_id, entry.day.isoformat(), entry.meal, entry.grams, entry.portion_name),
    )
    return get_diary(entry.day)


@app.delete("/api/diary/{entry_id}")
def delete_diary(entry_id: int):
    if not query("SELECT id FROM diary WHERE id = ?", (entry_id,)):
        raise HTTPException(404, "Запись не найдена")
    query("DELETE FROM diary WHERE id = ?", (entry_id,))
    return {"ok": True}
