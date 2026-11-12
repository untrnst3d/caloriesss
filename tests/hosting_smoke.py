import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def worker(stage):
    sys.path.insert(0, str(ROOT / 'backend'))
    from fastapi.testclient import TestClient
    from PIL import Image
    from app import app
    with TestClient(app, base_url='https://demo.example', headers={'Origin': 'https://demo.example', 'X-NutriDay': '1'}) as c:
        assert c.get('/api/health').json() == {'status': 'ok'}
        assert c.get('/').status_code == 200
        import re
        asset = re.search(r'src="([^"]+\.js)"', c.get('/').text).group(1)
        assert c.get(asset).status_code == 200
        assert c.get('/api/missing').status_code == 404
        credentials = {'username': 'hosting_test', 'password': 'test-password-123'}
        if stage == 'create':
            assert c.post('/api/auth/register', json=credentials, headers={'Origin': 'https://evil.example'}).status_code == 403
            r = c.post('/api/auth/register', json=credentials)
            assert r.status_code == 201, r.text
            assert 'Secure' in r.headers['set-cookie'] and 'HttpOnly' in r.headers['set-cookie']
            assert c.put('/api/profile', json={'sex':'female','age':25,'height':170,'weight':65,'activity':'low','goal':'maintain'}).status_code == 200
            raw = io.BytesIO(); Image.new('RGB', (16,16), 'green').save(raw, format='PNG')
            assert c.put('/api/account/avatar', content=raw.getvalue()).status_code == 200
            product = c.get('/api/products').json()[0]
            assert c.post('/api/diary', json={'product_id':product['id'],'day':'2026-11-12','meal':'Завтрак','grams':120,'portion_name':''}).status_code == 201
        else:
            assert c.post('/api/auth/login', json=credentials).status_code == 200
            assert c.get('/api/profile').json()['profile']['weight'] == 65
            assert c.get('/api/account/avatar').headers['content-type'] == 'image/jpeg'
            assert len(c.get('/api/diary?day=2026-11-12').json()['entries']) == 1
            assert c.post('/api/auth/logout').status_code == 200
            assert c.get('/api/auth/me').status_code == 401
    print(stage, 'OK')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        worker(sys.argv[1])
    else:
        with tempfile.TemporaryDirectory() as folder:
            env = dict(os.environ, DATABASE_URL='', REQUIRE_DATABASE_URL='0', APP_ENV='production', PUBLIC_URL='https://demo.example', COOKIE_SECURE='1', NUTRIDAY_DB=str(Path(folder)/'nested'/'test.sqlite3'))
            for stage in ('create', 'restart'):
                subprocess.run([sys.executable, __file__, stage], env=env, check=True)
        print('Build, API, HTTPS cookies, origin protection and restart persistence: OK')
