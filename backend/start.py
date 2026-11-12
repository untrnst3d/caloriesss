import os
from pathlib import Path
import subprocess
import sys


def main():
    if os.environ.get('NUTRIDAY_RUN_HOSTING_TESTS') == '1':
        env = dict(os.environ, TEST_DATABASE_URL=os.environ['DATABASE_URL'])
        subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / 'tests' / 'postgres_check.py')], env=env, check=True)
    os.execvp(sys.executable, [sys.executable, '-m', 'uvicorn', 'app:app', '--host', '0.0.0.0', '--port', os.environ.get('PORT', '8000'), '--workers', '1', '--no-proxy-headers'])


if __name__ == '__main__':
    main()
