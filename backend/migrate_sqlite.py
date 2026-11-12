import argparse
import os
from pathlib import Path
import sqlite3
from postgres import connect

TABLES = ('users', 'products', 'portions', 'diary', 'activities', 'profile', 'migration_state')
IDENTITIES = ('users', 'products', 'portions', 'diary', 'activities')


def migrate(source_path):
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        raise ValueError('Set DATABASE_URL to the empty target PostgreSQL database')
    source = sqlite3.connect(Path(source_path).resolve().as_uri() + '?mode=ro', uri=True)
    source.row_factory = sqlite3.Row
    try:
        source.execute('BEGIN')
        tables = {r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not set(TABLES).issubset(tables) or 'legacy_profile' in tables:
            raise ValueError('Use an initialized v0.0.5 SQLite backup; resolve legacy profile ownership first')
        with connect(url) as target:
            target.execute('BEGIN IMMEDIATE')
            existing = target.execute("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()").fetchall()
            if any(row['tablename'] in set(TABLES) | {'sessions', 'auth_attempts'} for row in existing):
                raise ValueError('Target must be empty: migration never overwrites existing application tables')
            for statement in Path(__file__).with_name('schema_postgres.sql').read_text().split(';'):
                if statement.strip():
                    target.execute(statement)
            for table in TABLES:
                columns = [row['name'] for row in source.execute(f'PRAGMA table_info({table})')]
                allowed = {row['column_name'] for row in target.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?', (table,))}
                if set(columns) != allowed:
                    raise ValueError(f'Unexpected schema for {table}; no data was imported')
                names = ','.join('"' + col + '"' for col in columns)
                placeholders = ','.join('?' for _ in columns)
                count = 0
                for row in source.execute(f'SELECT * FROM {table}'):
                    target.execute(f'INSERT INTO {table} ({names}) VALUES ({placeholders})', tuple(row))
                    count += 1
                assert target.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == count
            for table in IDENTITIES:
                target.execute(f"SELECT setval(pg_get_serial_sequence('{table}','id'), COALESCE(MAX(id),1), COUNT(*)>0) FROM {table}")
        print('Migration completed. Accounts, profiles, products, diary and photos copied. Log in again.')
    finally:
        source.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Copy a SQLite backup into EMPTY PostgreSQL; source stays unchanged')
    parser.add_argument('source')
    args = parser.parse_args()
    try:
        migrate(args.source)
    except Exception:
        raise SystemExit('Migration failed and was rolled back. Check connectivity and empty target schema; source unchanged.')
