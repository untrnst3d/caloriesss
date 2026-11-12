
import hashlib
import hmac
import os
import secrets
import sqlite3
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from database import connection, query, INTEGRITY_ERRORS

router = APIRouter(prefix="/api/auth")
COOKIE = "nutriday_session"
LIFETIME = 7 * 24 * 60 * 60
ITERATIONS = 600_000
PRODUCTION = os.environ.get("APP_ENV") == "production"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1" if PRODUCTION else "0") == "1"
PUBLIC_URL = os.environ.get("PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL", "")
local_origins = ",".join(
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1")
    for port in range(5173, 5200)
)
ALLOWED_ORIGINS = {
    value.strip().rstrip("/") for value in
    os.environ.get("ALLOWED_ORIGINS", "" if PRODUCTION else local_origins).split(",")
    if value.strip()
}
if PUBLIC_URL:
    ALLOWED_ORIGINS.add(PUBLIC_URL.rstrip("/"))
if PRODUCTION and (not COOKIE_SECURE or not ALLOWED_ORIGINS
                   or any(not origin.startswith("https://") for origin in ALLOWED_ORIGINS)):
    raise RuntimeError("Production requires secure cookies and an explicit HTTPS public origin")



class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def check_password(cls, value):
        if not value.strip():
            raise ValueError("Пароль не может состоять из пробелов")
        return value


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest.hex()}"


def verify_password(password, stored):
    algorithm, iterations, salt, expected = stored.split("$")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return algorithm == "pbkdf2_sha256" and hmac.compare_digest(digest.hex(), expected)


DUMMY_HASH = hash_password("not-a-real-account-password")


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(request: Request):
    token = request.cookies.get(COOKIE, "")
    rows = query("""SELECT users.id, users.username FROM sessions JOIN users
        ON users.id = sessions.user_id WHERE token_hash = ? AND expires > ?""",
        (token_hash(token), int(time.time())))
    if not rows:
        raise HTTPException(401, "Войди в аккаунт")
    return rows[0]


async def protect_requests(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
                                                                   
        origin = request.headers.get("origin")
        if request.headers.get("x-nutriday") != "1" or (origin and origin not in ALLOWED_ORIGINS):
            return JSONResponse({"detail": "Запрос с этого источника запрещён"}, status_code=403)
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def check_rate_limit(request, username):
    now = int(time.time())
    address = request.client.host if request.client else "unknown"
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM auth_attempts WHERE created <= ?", (now - 900,))
        per_name = db.execute("SELECT COUNT(*) FROM auth_attempts WHERE username = ?", (username,)).fetchone()[0]
        per_ip = db.execute("SELECT COUNT(*) FROM auth_attempts WHERE address = ?", (address,)).fetchone()[0]
        if per_name >= 5 or per_ip >= 30:
            raise HTTPException(429, "Слишком много попыток. Попробуй через 15 минут", headers={"Retry-After": "900"})
        db.execute("INSERT INTO auth_attempts (username, address, created) VALUES (?, ?, ?)", (username, address, now))


def start_session(request, response, user):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with connection() as db:
        db.execute("DELETE FROM sessions WHERE expires <= ? OR token_hash = ?",
                   (now, token_hash(request.cookies.get(COOKIE, ""))))
        db.execute("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)",
                   (token_hash(token), user["id"], now + LIFETIME))
    response.set_cookie(COOKIE, token, max_age=LIFETIME, httponly=True,
                        secure=COOKIE_SECURE, samesite="strict", path="/api")
    return {"user": {"id": user["id"], "username": user["username"]}}


@router.post("/register", status_code=201)
def register(credentials: Credentials, request: Request, response: Response):
    check_rate_limit(request, credentials.username)
    password_hash = hash_password(credentials.password)
    try:
        user = query("INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id, username",
                     (credentials.username, password_hash))[0]
    except INTEGRITY_ERRORS:
        raise HTTPException(409, "Этот логин уже занят")
    return start_session(request, response, user)


@router.post("/login")
def login(credentials: Credentials, request: Request, response: Response):
    check_rate_limit(request, credentials.username)
    rows = query("SELECT * FROM users WHERE username = ?", (credentials.username,))
    valid = verify_password(credentials.password, rows[0]["password_hash"] if rows else DUMMY_HASH)
    if not rows or not valid:
        raise HTTPException(401, "Неверный логин или пароль")
    return start_session(request, response, rows[0])


@router.get("/me")
def me(user=Depends(current_user)):
    return {"user": user}


@router.post("/logout")
def logout(request: Request, response: Response):
    query("DELETE FROM sessions WHERE token_hash = ?", (token_hash(request.cookies.get(COOKIE, "")),))
    response.delete_cookie(COOKIE, path="/api", httponly=True, secure=COOKIE_SECURE, samesite="strict")
    return {"ok": True}
