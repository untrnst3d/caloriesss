from account import router as account_router
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, Depends
from database import query, init_db
from security import router, current_user, protect_requests
from pydantic import BaseModel, Field

app = FastAPI(title="NutriDay")
app.include_router(router)
app.include_router(account_router)
app.middleware("http")(protect_requests)


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


class Activity(BaseModel):
    day: date
    name: str = Field(min_length=1, max_length=80)
    kcal: float = Field(gt=0, le=10000)


                                                               
ACTIVITY_FACTORS = {"low": 1.2, "light": 1.375, "moderate": 1.55, "high": 1.725}
GOAL_FACTORS = {"lose": 0.9, "maintain": 1.0, "gain": 1.1}


class Profile(BaseModel):
    sex: Literal["male", "female"]
    age: int = Field(ge=19, le=78)
    height: float = Field(ge=120, le=230, allow_inf_nan=False)
    weight: float = Field(ge=35, le=250, allow_inf_nan=False)
    activity: Literal["low", "light", "moderate", "high"]
    goal: Literal["lose", "maintain", "gain"]


def calculate_goal(profile: Profile):
    offset = 5 if profile.sex == "male" else -161
    resting = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + offset
    maintenance = resting * ACTIVITY_FACTORS[profile.activity]
    target = maintenance * GOAL_FACTORS[profile.goal]
                                                                                    
    minimum = 1500 if profile.sex == "male" else 1200
    return {
        "resting_kcal": round(resting),
        "maintenance_kcal": round(maintenance),
        "target_kcal": round(max(target, minimum)),
        "minimum_applied": target < minimum,
    }


init_db()


@app.get("/api/products")
def get_products(user=Depends(current_user)):
    return query("SELECT * FROM products WHERE is_builtin = 1 OR user_id = ? ORDER BY name", (user["id"],))


@app.post("/api/products", status_code=201)
def add_product(product: Product, user=Depends(current_user)):
    item = query(
        "INSERT INTO products (name, kcal, protein, fat, carbs, user_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
        (product.name.strip(), product.kcal, product.protein, product.fat, product.carbs, user["id"]),
    )
    return item[0]


@app.get("/api/portions")
def get_portions(product_id: int, user=Depends(current_user)):
    return query("SELECT * FROM portions WHERE product_id = ? AND user_id = ? ORDER BY id", (product_id, user["id"]))


@app.post("/api/portions", status_code=201)
def add_portion(portion: Portion, user=Depends(current_user)):
    if not query("SELECT id FROM products WHERE id = ? AND (is_builtin = 1 OR user_id = ?)", (portion.product_id, user["id"])):
        raise HTTPException(404, "Продукт не найден")
    item = query(
        "INSERT INTO portions (product_id, name, grams, user_id) VALUES (?, ?, ?, ?) RETURNING *",
        (portion.product_id, portion.name.strip(), portion.grams, user["id"]),
    )
    return item[0]


@app.get("/api/diary")
def get_diary(day: date, user=Depends(current_user)):
    rows = query("""
        SELECT diary.*, products.name AS product_name,
               ROUND(products.kcal * diary.grams / 100, 1) AS kcal,
               ROUND(products.protein * diary.grams / 100, 1) AS protein,
               ROUND(products.fat * diary.grams / 100, 1) AS fat,
               ROUND(products.carbs * diary.grams / 100, 1) AS carbs
        FROM diary JOIN products ON products.id = diary.product_id
        WHERE diary.day = ? AND diary.user_id = ? ORDER BY diary.id
    """, (day.isoformat(), user["id"]))
    total = {key: round(sum(row[key] for row in rows), 1)
             for key in ("kcal", "protein", "fat", "carbs")}
    return {"entries": rows, "total": total}


@app.post("/api/diary", status_code=201)
def add_diary(entry: DiaryEntry, user=Depends(current_user)):
    if not query("SELECT id FROM products WHERE id = ? AND (is_builtin = 1 OR user_id = ?)", (entry.product_id, user["id"])):
        raise HTTPException(404, "Продукт не найден")
    query(
        "INSERT INTO diary (product_id, day, meal, grams, portion_name, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        (entry.product_id, entry.day.isoformat(), entry.meal, entry.grams, entry.portion_name, user["id"]),
    )
    return get_diary(entry.day, user)


@app.delete("/api/diary/{entry_id}")
def delete_diary(entry_id: int, user=Depends(current_user)):
    if not query("SELECT id FROM diary WHERE id = ? AND user_id = ?", (entry_id, user["id"])):
        raise HTTPException(404, "Запись не найдена")
    query("DELETE FROM diary WHERE id = ? AND user_id = ?", (entry_id, user["id"]))
    return {"ok": True}


@app.get("/api/activities")
def get_activities(day: date, user=Depends(current_user)):
    entries = query("SELECT * FROM activities WHERE day = ? AND user_id = ? ORDER BY id", (day.isoformat(), user["id"]))
    return {"entries": entries, "total": round(sum(item["kcal"] for item in entries), 1)}


@app.post("/api/activities", status_code=201)
def add_activity(activity: Activity, user=Depends(current_user)):
    if not activity.name.strip():
        raise HTTPException(422, "Введи название активности")
    return query(
        "INSERT INTO activities (day, name, kcal, user_id) VALUES (?, ?, ?, ?) RETURNING *",
        (activity.day.isoformat(), activity.name.strip(), activity.kcal, user["id"]),
    )[0]


@app.delete("/api/activities/{activity_id}")
def delete_activity(activity_id: int, user=Depends(current_user)):
    if not query("SELECT id FROM activities WHERE id = ? AND user_id = ?", (activity_id, user["id"])):
        raise HTTPException(404, "Активность не найдена")
    query("DELETE FROM activities WHERE id = ? AND user_id = ?", (activity_id, user["id"]))
    return {"ok": True}


@app.get("/api/profile")
def get_profile(user=Depends(current_user)):
    rows = query("SELECT sex, age, height, weight, activity, goal FROM profile WHERE user_id = ?", (user["id"],))
    if not rows:
        return {"profile": None, "calculation": None}
    profile = Profile(**rows[0])
    return {"profile": profile.model_dump(), "calculation": calculate_goal(profile)}


@app.put("/api/profile")
def save_profile(profile: Profile, user=Depends(current_user)):
    query("""
        INSERT INTO profile (user_id, sex, age, height, weight, activity, goal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            sex = excluded.sex, age = excluded.age, height = excluded.height,
            weight = excluded.weight, activity = excluded.activity, goal = excluded.goal
    """, (user["id"], profile.sex, profile.age, profile.height, profile.weight, profile.activity, profile.goal))
    return {"profile": profile.model_dump(), "calculation": calculate_goal(profile)}
