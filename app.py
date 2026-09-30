from fastapi import FastAPI

app = FastAPI()

# Первый вариант каталога: небольшой список прямо в коде.
products = [
    {"id": 1, "name": "Яблоко", "kcal": 52},
    {"id": 2, "name": "Банан", "kcal": 89},
    {"id": 3, "name": "Молоко 2,5%", "kcal": 52},
]

@app.get("/api/products")
def get_products():
    return products
