import os
import sys
import secrets
import time
import bcrypt
import json
import boto3
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import List, Optional, Dict

from itsdangerous import URLSafeTimedSerializer
from fastapi.templating import Jinja2Templates
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, utc_to_vet

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Templates
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Security Config
_IS_PRODUCTION = os.environ.get("RAILWAY_ENVIRONMENT") == "production"

def _load_secret_key() -> str:
    key = os.environ.get("MELO_SECRET_KEY")
    if key: return key
    if _IS_PRODUCTION:
        print("ERROR CRÍTICO: MELO_SECRET_KEY no está configurada.", file=sys.stderr)
        sys.exit(1)
    return secrets.token_hex(32)

SECRET_KEY = _load_secret_key()
signer = URLSafeTimedSerializer(SECRET_KEY)

# WebAuthn & Push Config
RP_ID = os.environ.get("RP_ID", "melo-finance.up.railway.app") if _IS_PRODUCTION else "localhost"
RP_NAME = "Melo Finance"
ORIGIN = f"https://{RP_ID}" if _IS_PRODUCTION else f"http://{RP_ID}:8000"

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {"sub": "mailto:nixon@melo-finance.com"}

if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
    VAPID_PUBLIC_KEY = ""

# S3 / Storage Config
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL")

s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME:
    try:
        s3_client = boto3.client(
            's3', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION, endpoint_url=AWS_S3_ENDPOINT_URL
        )
    except Exception as e:
        print(f"STORAGE ERROR: Falló vinculación a S3 ({e}).")

# Shared Filters / Helpers
def format_datetime_vet(dt):
    if dt is None: return "—"
    return utc_to_vet(dt).strftime('%d/%m/%Y %H:%M')

def format_date_vet(dt):
    if dt is None: return "—"
    vet_dt = utc_to_vet(dt) if hasattr(dt, 'hour') else dt
    return vet_dt.strftime('%d/%m/%Y')

# Rate Limiter State
_redis_client = None
_login_attempts_memory: Dict[str, List[float]] = {}

def _get_redis():
    global _redis_client
    if _redis_client is not None: return _redis_client
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url: return None
    try:
        import redis
        client = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        _redis_client = client
        return _redis_client
    except: return None

def check_rate_limit(ip: str, max_attempts: int = 5, window_seconds: int = 60) -> bool:
    now = time.time()
    key = f"rate_limit:login:{ip}"
    redis = _get_redis()
    if redis:
        try:
            pipe = redis.pipeline()
            pipe.zadd(key, {str(now): now})
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            pipe.zcard(key)
            pipe.expire(key, window_seconds + 10)
            results = pipe.execute()
            return results[2] <= max_attempts
        except: pass
    
    attempts = _login_attempts_memory.get(ip, [])
    attempts = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        _login_attempts_memory[ip] = attempts
        return False
    attempts.append(now)
    _login_attempts_memory[ip] = attempts
    return True

# Password Helpers
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed or not hashed.startswith("$2b$"):
        return False
    try:
        return bcrypt.checkpw(plain.encode('utf-8')[:72], hashed.encode('utf-8'))
    except:
        return False

def needs_rehash(hashed: str) -> bool:
    if not hashed.startswith("$2b$"): return False
    try:
        parts = hashed.split("$")
        return int(parts[2]) < 12 if len(parts) > 2 else False
    except:
        return False

# Dependencies
def get_pagination_params(page: int = 1, limit: int = 20):
    return (page - 1) * limit, limit

def get_pagination_metadata(total_count: int, page: int, limit: int):
    total_pages = (total_count + limit - 1) // limit
    return {
        "page": page, "limit": limit, "total_count": total_count,
        "total_pages": total_pages, "has_next": page < total_pages, "has_prev": page > 1
    }

def get_current_user(request: Request, db: Session = Depends(get_db)):
    from database import User
    token = request.cookies.get("session_token")
    if not token: return None
    try:
        user_id = signer.loads(token, max_age=60 * 60 * 24 * 30)
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user
    except: return None

def require_user(current_user: Session = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_303_SEE_OTHER, headers={"Location": "/login"})
    return current_user

def log_admin_action(db: Session, admin_id: int, user_id: int, action: str, detail: str = None):
    from database import AdminActionLog
    log = AdminActionLog(admin_id=admin_id, user_id=user_id, action=action, detail=detail)
    db.add(log)
    db.commit()
    return log

def crear_alerta(db: Session, user_id: int, titulo: str, mensaje: str, tipo: str = "info"):
    from database import Notification
    db.add(Notification(user_id=user_id, titulo=titulo, mensaje=mensaje, tipo=tipo))
    db.commit()

# CSRF Helpers
def generate_csrf_token(request: Request):
    token_payload = "guest"
    session = request.cookies.get("session_token")
    if session:
        try:
            token_payload = str(signer.loads(session, max_age=60 * 60 * 24 * 30))
        except: pass
    return signer.dumps({"rnd": os.urandom(16).hex(), "id": token_payload})

def verify_csrf_token(token: str, request: Request) -> bool:
    try:
        data = signer.loads(token, max_age=3600)
        expected_id = "guest"
        session = request.cookies.get("session_token")
        if session:
            try:
                expected_id = str(signer.loads(session, max_age=60 * 60 * 24 * 30))
            except: pass
        return str(data.get("id")) == expected_id
    except: return False
