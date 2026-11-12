import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from fastapi.testclient import TestClient
from app import app


def check():
    headers={'Origin':'https://demo.example','X-NutriDay':'1'}
    with TestClient(app,base_url='https://demo.example',headers=headers) as a, TestClient(app,base_url='https://demo.example',headers=headers) as b:
        cred={'username':'regression_a','password':'password-123'}
        assert a.post('/api/auth/register',json=cred).status_code==201
        assert b.post('/api/auth/register',json=cred).status_code==409
        assert b.post('/api/auth/register',json={'username':'regression_b','password':'password-456'}).status_code==201
        assert b.post('/api/auth/login',json={'username':'regression_a','password':'wrong-password'}).status_code==401
        r=a.post('/api/products',json={'name':'Тест 100% ?','kcal':123.4,'protein':5.6,'fat':7.8,'carbs':9.1})
        assert r.status_code==201,r.text
        pid=r.json()['id']
        assert pid not in [p['id'] for p in b.get('/api/products').json()]
        assert a.post('/api/portions',json={'product_id':pid,'name':'Порция','grams':125}).status_code==201
        assert b.get(f'/api/portions?product_id={pid}').json()==[]
        entry={'product_id':pid,'day':'2026-11-12','meal':'Обед','grams':125,'portion_name':'Порция'}
        assert b.post('/api/diary',json=entry).status_code==404
        r=a.post('/api/diary',json=entry); assert r.status_code==201,r.text
        entry_id=r.json()['entries'][0]['id']
        total=r.json()['total']
        assert total=={'kcal':154.3,'protein':7.0,'fat':9.8,'carbs':11.4},total
        assert b.delete(f'/api/diary/{entry_id}').status_code==404
        assert a.delete(f'/api/diary/{entry_id}').status_code==200
        assert a.get('/api/diary?day=2026-11-12').json()['entries']==[]
        r=a.post('/api/activities',json={'day':'2026-11-12','name':'Ходьба','kcal':123.5})
        assert r.status_code==201,r.text
        aid=r.json()['id']
        assert a.get('/api/activities?day=2026-11-12').json()['total']==123.5
        assert b.delete(f'/api/activities/{aid}').status_code==404
        assert a.delete(f'/api/activities/{aid}').status_code==200
        for goal in ('lose','maintain','gain'):
            r=a.put('/api/profile',json={'sex':'female','age':25,'height':170,'weight':65,'activity':'low','goal':goal})
            assert r.status_code==200,r.text
            assert a.get('/api/profile').json()==r.json()
        assert a.put('/api/profile',json={'sex':'female','age':25,'height':170,'weight':0,'activity':'low','goal':'maintain'}).status_code==422
        assert a.put('/api/account/avatar',content=b'not an image').status_code==422
        assert a.delete('/api/account/avatar').status_code==200
        assert a.get('/api/account/avatar').status_code==404
    print('Products, portions, diary math, activities, profile, ownership, validation: OK')

if __name__=='__main__': check()
