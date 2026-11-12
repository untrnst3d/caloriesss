import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import uuid

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[1]


def run(script, env, *args, success=True):
    result = subprocess.run([sys.executable, str(ROOT / script), *args], env=env)
    assert (result.returncode == 0) == success, script


def main():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        raise SystemExit('Set TEST_DATABASE_URL to a dedicated TEST Neon database (not the live app database)')
    env = dict(os.environ, APP_ENV='production', PUBLIC_URL='https://demo.example', COOKIE_SECURE='1')
    with psycopg.connect(url, autocommit=True) as admin:
        for mode in ('fresh', 'migration'):
            schema = 'nutriday_test_' + uuid.uuid4().hex
            admin.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
            try:
                scoped_url = make_conninfo(url, options=f'-c search_path={schema}')
                pg_env = dict(env, DATABASE_URL=scoped_url, REQUIRE_DATABASE_URL='1')
                if mode == 'fresh':
                    run('tests/hosting_smoke.py', pg_env, 'create')
                    run('tests/hosting_smoke.py', pg_env, 'restart')
                    run('tests/logic_regression.py', pg_env)
                else:
                    with tempfile.TemporaryDirectory() as tmp:
                        source = str(Path(tmp) / 'source.sqlite3')
                        local_env = dict(env, DATABASE_URL='', REQUIRE_DATABASE_URL='0', NUTRIDAY_DB=source)
                        run('tests/hosting_smoke.py', local_env, 'create')
                        before = Path(source).read_bytes()
                        run('backend/migrate_sqlite.py', pg_env, source)
                        assert Path(source).read_bytes() == before
                        run('tests/hosting_smoke.py', pg_env, 'restart')
                        run('backend/migrate_sqlite.py', pg_env, source, success=False)
                        run('tests/logic_regression.py', pg_env)
                print(mode, 'PASSED')
            finally:
                admin.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))
    print('PostgreSQL and migration checks passed')


if __name__ == '__main__':
    main()
