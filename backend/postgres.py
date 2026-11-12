from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
import psycopg
from psycopg.rows import dict_row


class Row(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


def convert(row):
    if row is None:
        return None
    return Row({key: float(value) if isinstance(value, Decimal) else value for key, value in row.items()})


class Result:
    def __init__(self, cursor):
        self.cursor = cursor
        self.description = cursor.description

    def fetchone(self):
        return convert(self.cursor.fetchone())

    def fetchall(self):
        return [convert(row) for row in self.cursor.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())


class Connection:
    def __init__(self, raw):
        self.raw = raw

    def execute(self, sql, values=()):
        if sql.strip().upper() == "BEGIN IMMEDIATE":
            return Result(self.raw.execute("SELECT pg_advisory_xact_lock(7410291)"))
        return Result(self.raw.execute(sql.replace("?", "%s"), values))

    def executemany(self, sql, rows):
        cursor = self.raw.cursor()
        cursor.executemany(sql.replace("?", "%s"), rows)
        return Result(cursor)


@contextmanager
def connect(url):
    with psycopg.connect(url, row_factory=dict_row, connect_timeout=20, prepare_threshold=None) as raw:
        with raw.transaction():
            yield Connection(raw)


def initialize(url, seed):
    with connect(url) as db:
        db.execute("BEGIN IMMEDIATE")
        schema = Path(__file__).with_name("schema_postgres.sql").read_text()
        for statement in schema.split(";"):
            if statement.strip():
                db.execute(statement)
        if db.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            db.executemany("INSERT INTO products (name,kcal,protein,fat,carbs,is_builtin) VALUES (?,?,?,?,?,1)", seed)
