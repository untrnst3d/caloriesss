
import importlib.util
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
from pydantic import ValidationError


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        source = Path(__file__).resolve().parents[1] / 'app.py'
        shutil.copyfile(source, self.root / 'app.py')
        spec = importlib.util.spec_from_file_location('isolated_app', self.root / 'app.py')
        self.app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.app)
        self.data = dict(sex='male', age=30, height=180, weight=80,
                         activity='low', goal='maintain')

    def tearDown(self):
        self.temp.cleanup()

    def test_formula_and_goals(self):
        a = self.app
        for sex, resting in [('male', 1780), ('female', 1614)]:
            for activity, factor in a.ACTIVITY_FACTORS.items():
                for goal, adjustment in a.GOAL_FACTORS.items():
                    p = a.Profile(**(self.data | dict(sex=sex, activity=activity, goal=goal)))
                    result = a.calculate_goal(p)
                    self.assertEqual(result['resting_kcal'], resting)
                    self.assertEqual(result['maintenance_kcal'], round(resting * factor))
                    self.assertEqual(result['target_kcal'], round(resting * factor * adjustment))

    def test_floor(self):
        p = self.app.Profile(sex='female', age=78, height=120, weight=35,
                             activity='low', goal='lose')
        self.assertEqual(self.app.calculate_goal(p)['target_kcal'], 1200)
        self.assertTrue(self.app.calculate_goal(p)['minimum_applied'])

    def test_validation(self):
        for patch in [dict(age=18), dict(age=79), dict(age=25.5), dict(height=0),
                      dict(weight=-1), dict(weight=float('nan')), dict(height=float('inf')),
                      dict(sex='bad'), dict(activity='bad'), dict(goal='bad')]:
            with self.subTest(patch=patch), self.assertRaises(ValidationError):
                self.app.Profile(**(self.data | patch))

    def test_save_update_and_read(self):
        a = self.app
        self.assertEqual(a.get_profile(), dict(profile=None, calculation=None))
        saved = a.save_profile(a.Profile(**self.data))
        self.assertEqual(a.get_profile(), saved)
        changed = a.save_profile(a.Profile(**(self.data | dict(weight=90, goal='gain'))))
        self.assertEqual(a.get_profile(), changed)
        self.assertNotEqual(saved['calculation'], changed['calculation'])
        self.assertEqual(a.query('SELECT COUNT(*) AS n FROM profile')[0]['n'], 1)
        with sqlite3.connect(a.DB) as db:
            self.assertEqual(db.execute('SELECT weight FROM profile').fetchone()[0], 90)

    def test_migration_preserves_v3_records(self):
        a = self.app
        a.query('DROP TABLE profile')  
        product = a.add_product(a.Product(name='Тест', kcal=100, protein=1, fat=1, carbs=1))
        a.add_portion(a.Portion(product_id=product['id'], name='Порция', grams=150))
        a.add_diary(a.DiaryEntry(product_id=product['id'], day='2026-10-19', meal='Обед', grams=150))
        a.add_activity(a.Activity(day='2026-10-19', name='Прогулка', kcal=50))
        tables = ['products', 'portions', 'diary', 'activities']
        before = {t: a.query(f'SELECT * FROM {t}') for t in tables}
        a.init_db()
        a.init_db()
        self.assertEqual(before, {t: a.query(f'SELECT * FROM {t}') for t in tables})
        self.assertEqual(a.get_profile()['profile'], None)


if __name__ == '__main__':
    unittest.main()
