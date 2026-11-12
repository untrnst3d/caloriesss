
import argparse
from database import init_db, connection, DATABASE_URL


def claim(username):
    if DATABASE_URL:
        raise ValueError("Assign legacy ownership in SQLite before migrating to PostgreSQL")
    init_db()
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        user = db.execute("SELECT id FROM users WHERE username = ?", (username.strip().lower(),)).fetchone()
        if not user:
            raise ValueError("Сначала зарегистрируй этот логин в приложении")
        if db.execute("SELECT 1 FROM migration_state WHERE name = 'legacy_owner'").fetchone():
            raise ValueError("Старые данные уже были перенесены")
        uid = user["id"]
        old = db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'legacy_profile'").fetchone()
        if old:
            if db.execute("SELECT 1 FROM profile WHERE user_id = ?", (uid,)).fetchone():
                raise ValueError("У аккаунта уже есть анкета. Выбери новый аккаунт без анкеты")
            db.execute("INSERT INTO profile SELECT ?, sex, age, height, weight, activity, goal FROM legacy_profile", (uid,))
            db.execute("DROP TABLE legacy_profile")
        db.execute("UPDATE products SET user_id = ? WHERE user_id IS NULL AND is_builtin = 0", (uid,))
        for table in ("portions", "diary", "activities"):
            db.execute(f"UPDATE {table} SET user_id = ? WHERE user_id IS NULL", (uid,))
        db.execute("INSERT INTO migration_state VALUES ('legacy_owner', ?)", (str(uid),))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('username', help='Логин владельца старых данных')
    args = parser.parse_args()
    try:
        claim(args.username)
        print('Старые данные перенесены. Можно запустить сервер.')
    except ValueError as error:
        parser.exit(1, str(error) + '\n')
