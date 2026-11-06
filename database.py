import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB = Path(os.environ.get("NUTRIDAY_DB", Path(__file__).with_name("nutriday.sqlite3")))


@contextmanager
def connection():
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def query(sql, values=()):
    with connection() as db:
        result = db.execute(sql, values)
        return [dict(row) for row in result.fetchall()] if result.description else []


SEED = [('Яблоко', 52, 0.3, 0.2, 14), ('Банан', 89, 1.1, 0.3, 23), ('Молоко 2,5%', 52, 3, 2.5, 4.7), ('Яйцо куриное', 157, 12.7, 11.5, 0.7), ('Гречка сухая', 343, 13, 3.4, 72), ('Рис сухой', 344, 7, 0.6, 78), ('Куриная грудка', 113, 23, 1.9, 0), ('Огурец', 15, 0.8, 0.1, 2.8), ('Помидор', 20, 1.1, 0.2, 3.7), ('Творог 5%', 121, 17, 5, 1.8), ('Овсяные хлопья сухие', 366, 11.9, 7.2, 69), ('Хлеб пшеничный', 265, 8, 3.2, 49), ('Картофель', 77, 2, 0.4, 16.3), ('Говядина', 187, 18.9, 12.4, 0), ('Лосось', 208, 20, 13, 0), ('Морковь', 41, 0.9, 0.2, 10), ('Сыр твёрдый', 350, 25, 27, 2), ('Кефир 2,5%', 53, 2.9, 2.5, 4)]


def init_db():
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        commands = [
            "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL)",
            "CREATE TABLE IF NOT EXISTS auth_attempts (id INTEGER PRIMARY KEY, username TEXT NOT NULL, address TEXT NOT NULL, created INTEGER NOT NULL)",
            "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL, fat REAL NOT NULL, carbs REAL NOT NULL)",
            "CREATE TABLE IF NOT EXISTS portions (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, grams REAL NOT NULL)",
            "CREATE TABLE IF NOT EXISTS diary (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), day TEXT NOT NULL, meal TEXT NOT NULL, grams REAL NOT NULL, portion_name TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY, day TEXT NOT NULL, name TEXT NOT NULL, kcal REAL NOT NULL)",
        ]
        for sql in commands:
            db.execute(sql)
        columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
        for column, definition in [('avatar', 'BLOB'), ('avatar_version', "TEXT NOT NULL DEFAULT ''")]:
            if column not in columns:
                db.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")
        for table in ("products", "portions", "diary", "activities"):
            columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
            if "user_id" not in columns:
                db.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)")
        columns = {row["name"] for row in db.execute("PRAGMA table_info(products)")}
        if "is_builtin" not in columns:
            db.execute("ALTER TABLE products ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0")
                                                                             
            for index, item in enumerate(SEED, 1):
                db.execute("UPDATE products SET is_builtin = 1 WHERE id = ? AND name = ? AND kcal = ? AND protein = ? AND fat = ? AND carbs = ?", (index, *item))
        columns = {row["name"] for row in db.execute("PRAGMA table_info(profile)")}
        if columns and "user_id" not in columns:
            db.execute("ALTER TABLE profile RENAME TO legacy_profile")
        db.execute("CREATE TABLE IF NOT EXISTS profile (user_id INTEGER PRIMARY KEY REFERENCES users(id), sex TEXT NOT NULL, age INTEGER NOT NULL, height REAL NOT NULL, weight REAL NOT NULL, activity TEXT NOT NULL, goal TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS migration_state (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
        for table in ("diary", "activities"):
            db.execute(f"CREATE INDEX IF NOT EXISTS {table}_user_day ON {table}(user_id, day)")
        db.execute("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires)")
        if db.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            db.executemany("INSERT INTO products (name, kcal, protein, fat, carbs, is_builtin) VALUES (?, ?, ?, ?, ?, 1)", SEED)
