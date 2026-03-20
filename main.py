from fastapi import FastAPI, Depends, Request, Form, HTTPException, status, Response, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import os
import shutil
from typing import List, Optional
import secrets
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from database import engine, Base, get_db, init_db, get_now_vet, get_now_utc, utc_to_vet, User, Client, Loan, Transaction, Rate, CapitalTransaction, Notification, LoanAttachment, WebAuthnCredential, PushSubscription, SupportRequest
import schemas
from scraper import update_bcv_rate_if_needed
import utils
from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from sqlalchemy.orm import joinedload
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))
import analytics_engine
import json
import base64
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
    PublicKeyCredentialDescriptor,
)
from pywebpush import webpush, WebPushException
import boto3
from botocore.exceptions import NoCredentialsError

# --- S3 / Supabase Storage Configuración ---
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL")

s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME:
    print("STORAGE: Conectando a bucket remoto S3/Supabase...")
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            endpoint_url=AWS_S3_ENDPOINT_URL
        )
    except Exception as e:
        print(f"STORAGE ERROR: Falló vinculación a S3 ({e}). Fallback local.")
else:
    print("STORAGE WARNING: Credenciales S3 faltantes. Guardando en almacenamiento local efímero.")

# --- Seguridad ---
import secrets as py_secrets
import sys

# ── Configuración de clave secreta ────────────────────────────────────────────

_IS_PRODUCTION = os.environ.get("RAILWAY_ENVIRONMENT") == "production"

def _load_secret_key() -> str:
    """
    Carga la clave secreta de forma segura.
    
    Entornos:
    - Producción (RAILWAY_ENVIRONMENT=production): MELO_SECRET_KEY obligatoria.
      Si no está definida, la aplicación NO arranca.
    - Desarrollo local: Si no está definida, genera una clave aleatoria segura
      (las sesiones se invalidan en cada reinicio — aceptable en desarrollo).
    
    Para generar una clave segura:
        python -c "import secrets; print(secrets.token_hex(32))"
    """
    key = os.environ.get("MELO_SECRET_KEY")
    
    if key:
        if len(key) < 32:
            print(
                "SECURITY WARNING: MELO_SECRET_KEY tiene menos de 32 caracteres. "
                "Genera una clave más larga con: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return key
    
    if _IS_PRODUCTION:
        # En producción, fallar explícitamente. No hay fallback.
        print(
            "\n" + "="*60 + "\n"
            "ERROR CRÍTICO: MELO_SECRET_KEY no está configurada.\n"
            "La aplicación no puede arrancar en producción sin una clave secreta.\n\n"
            "Para configurarla en Railway:\n"
            "  1. Ve a tu proyecto en Railway\n"
            "  2. Variables → New Variable\n"
            "  3. Name: MELO_SECRET_KEY\n"
            "  4. Value: (ejecuta esto para generarla)\n"
            "     python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            + "="*60 + "\n",
            file=sys.stderr
        )
        sys.exit(1)  # Falla el proceso. Railway no desplegará.
    
    # Desarrollo: clave aleatoria por sesión (insegura pero funcional para desarrollo)
    dev_key = py_secrets.token_hex(32)
    print(
        "SECURITY WARNING: MELO_SECRET_KEY no configurada. "
        "Usando clave temporal (sesiones se invalidan al reiniciar). "
        "Para persistencia en desarrollo, define MELO_SECRET_KEY en tu .env"
    )
    return dev_key


SECRET_KEY = _load_secret_key()
signer = URLSafeTimedSerializer(SECRET_KEY)

# --- Configuración WebAuthn (Biometría) ---
RP_ID = os.environ.get("RP_ID", "melo-finance.up.railway.app") if os.environ.get("RAILWAY_ENVIRONMENT") == "production" else "localhost"
RP_NAME = "Melo Finance"
ORIGIN = f"https://{RP_ID}" if os.environ.get("RAILWAY_ENVIRONMENT") == "production" else f"http://{RP_ID}:8000"

# --- Configuración WebPush (Notificaciones) ---
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {"sub": "mailto:nixon@melo-finance.com"}

if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
    print("WARNING: VAPID keys not set. Push notifications disabled.")
    VAPID_PUBLIC_KEY = ""


# --- CSRF & Security Helpers ---
def generate_csrf_token(request: Request):
    token_payload = "guest"
    session = request.cookies.get("session_token")
    if session:
        try:
            token_payload = str(signer.loads(session, max_age=60 * 60 * 24 * 30))
        except:
            pass
    return signer.dumps({"rnd": os.urandom(16).hex(), "id": token_payload})

def verify_csrf_token(token: str, request: Request) -> bool:
    try:
        data = signer.loads(token, max_age=3600)
        expected_id = "guest"
        session = request.cookies.get("session_token")
        if session:
            try:
                expected_id = str(signer.loads(session, max_age=60 * 60 * 24 * 30))
            except:
                pass
        return str(data.get("id")) == expected_id
    except:
        return False

# Rate Limiter Simple (En memoria para la Beta)
import time
import json
from typing import Dict, List, Optional

# ── Rate Limiter con Redis o fallback en memoria ──────────────────────────────

_redis_client = None
_login_attempts_memory: Dict[str, List[float]] = {}


def _get_redis():
    """
    Intenta conectar a Redis. Retorna el cliente o None si no está disponible.
    Cachea el resultado para no intentar reconectar en cada request.
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None
    
    try:
        import redis
        client = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()  # Verificar conectividad
        _redis_client = client
        print("RATE LIMITER: Usando Redis como backend.")
        return _redis_client
    except Exception as e:
        print(f"RATE LIMITER WARNING: Redis no disponible ({e}). Usando memoria.")
        return None


def check_rate_limit(ip: str, max_attempts: int = 5, window_seconds: int = 60) -> bool:
    """
    Verifica si una IP puede hacer un intento de login.
    
    Retorna True si el intento está permitido, False si debe ser bloqueado.
    
    Estrategia:
    - Con Redis: sliding window usando ZADD/ZREMRANGEBYSCORE (preciso y eficiente)
    - Sin Redis: lista en memoria (solo para desarrollo)
    
    El bloqueo es por IP. No por usuario, para evitar DoS de cuentas específicas.
    """
    now = time.time()
    key = f"rate_limit:login:{ip}"
    
    redis = _get_redis()
    
    if redis:
        try:
            pipe = redis.pipeline()
            # Sliding window: agregar timestamp actual
            pipe.zadd(key, {str(now): now})
            # Remover entradas fuera de la ventana
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            # Contar intentos en la ventana
            pipe.zcard(key)
            # Expirar la clave completa después de la ventana
            pipe.expire(key, window_seconds + 10)
            results = pipe.execute()
            attempt_count = results[2]
            return attempt_count <= max_attempts
        except Exception as e:
            print(f"RATE LIMITER ERROR (Redis): {e}. Fallback a memoria.")
            # Si Redis falla en runtime, caer a memoria
    
    # Fallback: memoria (solo desarrollo o si Redis falla)
    attempts = _login_attempts_memory.get(ip, [])
    attempts = [t for t in attempts if now - t < window_seconds]
    
    # Limpiar IPs inactivas si el dict crece demasiado
    if len(_login_attempts_memory) > 1000:
        cutoff = now - window_seconds
        keys_to_delete = [
            k for k, v in _login_attempts_memory.items()
            if not any(t > cutoff for t in v)
        ]
        for k in keys_to_delete[:500]:  # Limpiar hasta 500 a la vez
            del _login_attempts_memory[k]
    
    if len(attempts) >= max_attempts:
        _login_attempts_memory[ip] = attempts
        return False
    
    attempts.append(now)
    _login_attempts_memory[ip] = attempts
    return True

def hash_password(password: str) -> str:
    """
    Hashea una contraseña usando bcrypt con cost factor 12.
    Trunca a 72 bytes (límite de bcrypt) antes de hashear.
    """
    if not password:
        raise ValueError("La contraseña no puede estar vacía")
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifica una contraseña contra su hash bcrypt.
    NUNCA compara texto plano. Si el hash no es bcrypt válido,
    retorna False para forzar reset de contraseña.
    """
    if not plain or not hashed:
        return False
    if not hashed.startswith("$2b$"):
        # Hash inválido o legacy: rechazar siempre.
        # El usuario deberá usar "Olvidé mi contraseña" para regenerar.
        return False
    plain_bytes = plain.encode('utf-8')[:72]
    try:
        return bcrypt.checkpw(plain_bytes, hashed.encode('utf-8'))
    except (ValueError, Exception):
        return False


def needs_rehash(hashed: str) -> bool:
    """
    Retorna True si el hash debe ser actualizado al cost factor actual (12).
    Útil para actualizar hashes creados con cost factors anteriores.
    """
    if not hashed.startswith("$2b$"):
        return False  # No es bcrypt, no se puede rehashear automáticamente
    try:
        # Extrae el cost factor del hash: $2b$12$... -> 12
        parts = hashed.split("$")
        current_cost = int(parts[2]) if len(parts) > 2 else 0
        return current_cost < 12
    except (IndexError, ValueError):
        return False

# No llamar a init_db() globalmente. Se maneja en el startup_event o mediante Alembic.
print("🚀 MELO FINANCE PRO v2.4 - DASHBOARD ADMINISTRATIVO CARGADO")
sys.stdout.flush()

app = FastAPI(title="Melo Préstamos - Bimoneda", description="App de gestión de préstamos USD/VES", version="1.0.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Montar static para CSS y JS
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Directorio de subidas (archivos de préstamos)
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Templates
if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)
templates = Jinja2Templates(directory=TEMPLATES_DIR)

def format_currency(value):
    try:
        if value is None:
            return "0,00"
        # Forzar Decimal para redondeo seguro antes de formatear
        d_val = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return "{:,.2f}".format(float(d_val)).replace(",", "X").replace(".", ",").replace("X", ".")
    except (ValueError, TypeError, InvalidOperation):
        return value

templates.env.filters["format_currency"] = format_currency


def format_datetime_vet(dt):
    """Convierte UTC a Venezuela para mostrar en templates"""
    if dt is None:
        return "—"
    vet_dt = utc_to_vet(dt)
    return vet_dt.strftime('%d/%m/%Y %H:%M')


def format_date_vet(dt):
    if dt is None:
        return "—"
    if hasattr(dt, 'date'):
        vet_dt = utc_to_vet(dt)
        return vet_dt.strftime('%d/%m/%Y')
    return dt.strftime('%d/%m/%Y')


templates.env.filters["format_datetime"] = format_datetime_vet
templates.env.filters["format_date"] = format_date_vet

# --- Helpers ---
def crear_alerta(db: Session, user_id: int, titulo: str, mensaje: str, tipo: str = "info"):
    new_notif = Notification(user_id=user_id, titulo=titulo, mensaje=mensaje, tipo=tipo)
    db.add(new_notif)
    db.commit()

def calculate_interest(loan: Loan) -> float:
    return loan.monto_principal * (loan.porcentaje_interes / 100)

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        # init_db() # Descomentar solo si no se usa Alembic para crear tablas
        update_bcv_rate_if_needed(db)
        print("🚀 STARTUP: Sistema inicializado correctamente.")
    except Exception as e:
        print(f"🚀 STARTUP ERROR: {e}")
    finally:
        sys.stdout.flush()

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        return None
    try:
        user_id = signer.loads(token, max_age=60 * 60 * 24 * 30)
    except (BadSignature, SignatureExpired):
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if user and not user.is_active:
        return None
    return user

def require_user(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_303_SEE_OTHER, headers={"Location": "/login"})
    return current_user

# --- Endpoints de Biometría (WebAuthn) ---

@app.get("/auth/webauthn/register/options")
def webauthn_register_options(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.webauthn_id:
        current_user.webauthn_id = os.urandom(16).hex()
        db.commit()

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=bytes.fromhex(current_user.webauthn_id),
        user_name=current_user.username,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
    )
    
    json_options = options_to_json(options)
    res = Response(content=json_options, media_type="application/json")
    res.set_cookie("reg_options", signer.dumps(json_options), max_age=300, httponly=True, secure=True if RP_ID != "localhost" else False)
    return res

@app.post("/auth/webauthn/register/verify")
async def webauthn_register_verify(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    data = await request.json()
    options_cookie = request.cookies.get("reg_options")
    if not options_cookie:
        raise HTTPException(status_code=400, detail="Sesión de registro expirada")
    
    try:
        options_json = json.loads(signer.loads(options_cookie))
        registration_verification = verify_registration_response(
            credential=data,
            expected_challenge=base64.urlsafe_b64decode(options_json["challenge"] + "=="),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
        )
        
        new_cred = WebAuthnCredential(
            user_id=current_user.id,
            credential_id=registration_verification.credential_id.hex(),
            public_key=base64.b64encode(registration_verification.credential_public_key).decode('utf-8'),
            sign_count=registration_verification.sign_count,
        )
        db.add(new_cred)
        db.commit()
        return {"status": "ok", "message": "Biometría registrada correctamente"}
    except Exception as e:
        print(f"WEBAUTHN REG ERROR: {e}")
        raise HTTPException(status_code=400, detail="Error al verificar biometría")

@app.get("/auth/webauthn/login/options")
def webauthn_login_options(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.credentials:
        raise HTTPException(status_code=404, detail="Usuario no tiene biometría configurada")

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=bytes.fromhex(c.credential_id), type="public-key")
            for c in user.credentials
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    
    json_options = options_to_json(options)
    res = Response(content=json_options, media_type="application/json")
    res.set_cookie("auth_options", signer.dumps(json_options), max_age=300, httponly=True, secure=True if RP_ID != "localhost" else False)
    res.set_cookie("auth_user", str(user.id), max_age=300, httponly=True)
    return res

@app.post("/auth/webauthn/login/verify")
async def webauthn_login_verify(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    options_cookie = request.cookies.get("auth_options")
    user_id_cookie = request.cookies.get("auth_user")
    
    if not options_cookie or not user_id_cookie:
        raise HTTPException(status_code=400, detail="Sesión biométrica expirada")
    
    user = db.query(User).filter(User.id == int(user_id_cookie)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    try:
        options_json = json.loads(signer.loads(options_cookie))
        cred_id_raw = data["rawId"]
        import base64
        cred_id_bytes = base64.urlsafe_b64decode(cred_id_raw + "==")
        cred_id_hex = cred_id_bytes.hex()
        
        db_cred = db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == cred_id_hex).first()
        if not db_cred:
             raise HTTPException(status_code=404, detail="Credencial no reconocida")

        authentication_verification = verify_authentication_response(
            credential=data,
            expected_challenge=base64.urlsafe_b64decode(options_json["challenge"] + "=="),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            credential_public_key=base64.b64decode(db_cred.public_key),
            credential_current_sign_count=db_cred.sign_count,
        )
        
        db_cred.sign_count = authentication_verification.new_sign_count
        user.last_login = get_now_vet()
        db.commit()
        
        token = signer.dumps(user.id)
        res = Response(content=json.dumps({"status": "ok"}), media_type="application/json")
        res.set_cookie("session_token", token, max_age=60 * 60 * 24 * 30, httponly=True, secure=True if RP_ID != "localhost" else False)
        return res
    except Exception as e:
        print(f"WEBAUTHN LOGIN ERROR: {e}")
        raise HTTPException(status_code=400, detail="Firma biométrica inválida")

@app.post("/push/subscribe")
async def push_subscribe(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    try:
        data = await request.json()
        existing = db.query(PushSubscription).filter(PushSubscription.endpoint == data["endpoint"]).first()
        if existing:
            return {"status": "ok", "message": "Ya suscrito"}
        
        new_sub = PushSubscription(
            user_id=current_user.id,
            endpoint=data["endpoint"],
            auth_key=data["keys"]["auth"],
            p256dh_key=data["keys"]["p256dh"],
            browser=request.headers.get("user-agent", "unknown")
        )
        db.add(new_sub)
        db.commit()
        return {"status": "ok"}
    except Exception as e:
        print(f"SUBSCRIBE ERROR: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/push/test")
def push_test(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user or not current_user.push_subscriptions:
        return {"status": "error", "message": "No hay suscripciones activas en este dispositivo."}
    
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return {"status": "error", "message": "VAPID Keys no configuradas en el servidor."}

    sent_count: int = 0
    expired_count: int = 0
    for sub in current_user.push_subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"auth": sub.auth_key, "p256dh": sub.p256dh_key}
                },
                data=json.dumps({
                    "title": "Melo Finance 🚀",
                    "body": "¡Notificaciones push activadas correctamente!",
                    "url": "/dashboard"
                }),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            sent_count += 1
        except WebPushException as ex:
            print(f"PUSH TEST ERROR: {ex}")
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                expired_count += 1
    
    db.commit()
    return {"status": "ok", "sent": sent_count, "deleted_expired": expired_count}


@app.get("/", response_class=RedirectResponse)
def index():
    return RedirectResponse(url="/login")

@app.get("/terminos", response_class=HTMLResponse)
def terminos_get(request: Request):
    return templates.TemplateResponse("terminos.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
def login_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("login.html", {"request": request, "csrf_token": csrf_token})

@app.post("/login")
def login_post(
    request: Request,
    email: str = Form(""), 
    password: str = Form(""), 
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    if not check_rate_limit(request.client.host):
        return RedirectResponse(url="/login?error=too_many_requests", status_code=status.HTTP_303_SEE_OTHER)

    user = db.query(User).filter(User.username == email).first()
    # Verificación sin texto plano
    if not user or not verify_password(password, user.hashed_password):
        return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)
    
    if not user.is_active:
        return RedirectResponse(url="/login?error=account_blocked", status_code=status.HTTP_303_SEE_OTHER)
    
    # Rehash transparente si el cost factor es bajo (sin texto plano)
    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(password)
        db.commit()
    
    token = signer.dumps(user.id)
    if user.is_admin:
        response = RedirectResponse(url="/admin/soporte", status_code=status.HTTP_303_SEE_OTHER)
    else:
        response = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    
    is_prod = os.environ.get("RAILWAY_ENVIRONMENT") == "production"
    response.set_cookie(
        key="session_token", 
        value=token, 
        path="/",
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=60 * 60 * 12
    )
    return response

@app.get("/signup", response_class=HTMLResponse)
def signup_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("sign-up.html", {"request": request, "csrf_token": csrf_token})

@app.post("/signup")
def signup_post(
    request: Request,
    nombre: str = Form(""), 
    apellido: str = Form(""), 
    email: str = Form(""), 
    password: str = Form(""), 
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    existing = db.query(User).filter(User.username == email).first()
    if existing:
        return RedirectResponse(url="/signup?error=exists", status_code=status.HTTP_303_SEE_OTHER)
    user = User(
        username=email, 
        nombre=nombre, 
        apellido=apellido, 
        hashed_password=hash_password(password),
        capital_total_usd=0.0,
        capital_total_ves=0.0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = signer.dumps(user.id)
    response = RedirectResponse(url="/settings/capital", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="session_token", value=token, path="/",
        httponly=True, samesite="lax",
        max_age=60 * 60 * 24 * 30
    )
    return response

@app.get("/logout")
def logout():
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("session_token")
    return response

@app.get("/forgot-password", response_class=HTMLResponse)
def forgot_password_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("forgot-password.html", {"request": request, "csrf_token": csrf_token})

@app.post("/forgot-password")
def forgot_password_post(
    request: Request,
    email: str = Form(""),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        return templates.TemplateResponse("forgot-password.html", {
            "request": request, 
            "error": "CSRF Token inválido",
            "csrf_token": generate_csrf_token(request)
        })
    
    user = db.query(User).filter(User.username == email).first()
    if user:
        # Generar token de recuperación (expira en 1 hora)
        token = signer.dumps(user.username, salt='password-reset')
        reset_link = f"{request.base_url}reset-password/{token}"
        
        # Guardar en soporte para que se vea en el panel de admin si no hay SMTP
        new_support = SupportRequest(email=email, token=token)
        db.add(new_support)
        db.commit()
        
        # LOG PARA DESARROLLO (Railway consola)
        print("\n" + "="*50)
        print(f"RECUPERACIÓN DE CONTRASEÑA PARA: {email}")
        print(f"LINK: {reset_link}")
        print("="*50 + "\n")
        
        # Aquí iría el código para enviar el mail (ej. usando fastapi-mail o smtplib)
        # Por ahora simulamos éxito visualmente.
        
    return templates.TemplateResponse("forgot-password.html", {
        "request": request, 
        "success": True,
        "csrf_token": generate_csrf_token(request)
    })

@app.get("/reset-password/{token}", response_class=HTMLResponse)
def reset_password_get(request: Request, token: str):
    try:
        # Verificar token (vence en 1 hora)
        email = signer.loads(token, salt='password-reset', max_age=3600)
    except:
        return RedirectResponse(url="/forgot-password?error=token_invalid", status_code=status.HTTP_303_SEE_OTHER)
    
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("reset-password.html", {
        "request": request, 
        "token": token, 
        "csrf_token": csrf_token
    })

@app.post("/reset-password/{token}")
def reset_password_post(
    request: Request,
    token: str,
    password: str = Form(...),
    confirm_password: str = Form(...),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    try:
        email = signer.loads(token, salt='password-reset', max_age=3600)
    except:
        return RedirectResponse(url="/forgot-password?error=token_expired", status_code=status.HTTP_303_SEE_OTHER)
    
    if password != confirm_password:
        return templates.TemplateResponse("reset-password.html", {
            "request": request, 
            "token": token, 
            "error": "Las contraseñas no coinciden",
            "csrf_token": generate_csrf_token(request)
        })
    
    user = db.query(User).filter(User.username == email).first()
    if user:
        user.hashed_password = hash_password(password)
        
        # Marcar la solicitud como atendida si existe en la tabla de soporte
        support_req = db.query(SupportRequest).filter(SupportRequest.token == token).first()
        if support_req:
            support_req.atendida = True
            
        db.commit()
    
    return RedirectResponse(url="/login?msg=password_reset_success", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/admin/soporte", response_class=HTMLResponse)
def support_admin_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.is_admin:
        return RedirectResponse(url="/dashboard?error=admin_only", status_code=status.HTTP_303_SEE_OTHER)
    
    # Datos de Recuperación de Contraseña
    recovery_requests = db.query(SupportRequest).order_by(SupportRequest.fecha.desc()).limit(20).all()
    
    # Gestión de Usuarios
    all_users = db.query(User).order_by(User.created_at.desc()).all()
    
    users_data = []
    for u in all_users:
        # Calcular almacenamiento (suma de adjuntos)
        total_bytes = db.query(func.sum(LoanAttachment.file_size)).join(Loan).join(Client).filter(Client.user_id == u.id).scalar() or 0
        storage_mb = round(total_bytes / (1024 * 1024), 2)
        
        # Conteo de clientes y préstamos
        client_count = db.query(Client).filter(Client.user_id == u.id).count() or 0
        loan_count = db.query(Loan).join(Client).filter(Client.user_id == u.id).count() or 0
        
        users_data.append({
            "id": u.id,
            "email": u.username,
            "nombre": f"{u.nombre} {u.apellido}",
            "fecha": u.created_at,
            "is_active": u.is_active,
            "storage": storage_mb,
            "clients": client_count,
            "loans": loan_count
        })

    return templates.TemplateResponse("admin-soporte.html", {
        "request": request, 
        "requests": recovery_requests,
        "users": users_data,
        "current_user": current_user
    })

@app.post("/admin/toggle-user/{u_id}")
def toggle_user(request: Request, u_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    user = db.query(User).filter(User.id == u_id).first()
    if user:
        user.is_active = not user.is_active
        db.commit()
    
    return RedirectResponse(url="/admin/soporte", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    user = current_user
        
    if user.capital_total_usd == 0 and user.capital_total_ves == 0:
        return RedirectResponse(url="/settings/capital")
        
    tasa_actual = update_bcv_rate_if_needed(db)
    capital_inicial = user.capital_total_usd
    
    active_loans = db.query(Loan).options(joinedload(Loan.transactions)).join(Client).filter(Client.user_id == user.id, Loan.estatus == 'activo').all()
    
    prestamos_vencidos: int = sum(1 for l in active_loans if utils.chequear_cuota_vencida(l))
    total_prestamos_activos: int = len(active_loans)
    
    capital_prestado_usd: Decimal = sum(
        max(Decimal("0.0"), l.monto_principal - sum(t.monto for t in l.transactions if t.tipo == 'pago_cuota')) 
        for l in active_loans
    )

    ganancias_proyectadas: Decimal = sum(
        utils.calcular_interes_simple(l.monto_principal, l.porcentaje_interes) * Decimal(str(l.cuotas_totales or 1))
        for l in active_loans
    )
    
    ganancias_reales: Decimal = Decimal("0.0")
    all_user_loans = db.query(Loan).join(Client).filter(Client.user_id == user.id).all()
    for l in all_user_loans:
        pagos_usd = sum(t.monto for t in l.transactions if t.tipo == 'pago_cuota')
        if pagos_usd > l.monto_principal:
            ganancias_reales += (pagos_usd - l.monto_principal)
    
    unread_count = db.query(Notification).filter(Notification.user_id == user.id, Notification.leida == False).count()

    disponible_usd: Decimal = user.capital_total_usd
    disponible_ves: Decimal = user.capital_total_ves

    hoy = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        target_date = hoy.replace(day=1) - relativedelta(months=i)
        start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = (start + relativedelta(months=1))
        mes_label = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][start.month - 1]
        meses_labels.append(mes_label)

        sum_mes: Decimal = db.query(func.sum(Transaction.monto)).join(Loan).join(Client).filter(
            Client.user_id == user.id,
            Transaction.tipo == 'pago_cuota',
            Transaction.fecha >= start,
            Transaction.fecha < end
        ).scalar() or Decimal("0.0")
        meses_valores.append(sum_mes)
        
    max_val: Decimal = max(meses_valores) if meses_valores and max(meses_valores) > Decimal("0.0") else Decimal("1.0")
    grafico_data = [{"label": l, "height": int((v / max_val) * 100)} for l, v in zip(meses_labels, meses_valores)]

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "capital_inicial": capital_inicial,
        "disponible_usd": disponible_usd,
        "disponible_ves": disponible_ves,
        "capital_prestado_usd": capital_prestado_usd,
        "prestamos_vencidos": prestamos_vencidos,
        "total_prestamos_activos": total_prestamos_activos,
        "ganancias_proyectadas": ganancias_proyectadas,
        "ganancias_reales": ganancias_reales,
        "tasa_actual": tasa_actual,
        "unread_count": unread_count,
        "grafico_data": grafico_data,
        "user": user
    })

@app.get("/history/movements", response_class=HTMLResponse)
def movements_history_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    loan_trans = db.query(Transaction).join(Loan).join(Client).filter(Client.user_id == current_user.id).all()
    cap_trans = db.query(CapitalTransaction).filter(CapitalTransaction.user_id == current_user.id).all()
    
    movements = []  # ✅ CORRECCIÓN: lista inicializada
    
    for t in loan_trans:
        titulo = f"Pago: {t.loan.client.nombre}"
        tipo_mov = "entrada"
        if t.tipo == "egreso_capital":
            titulo = f"Préstamo a: {t.loan.client.nombre}"
            tipo_mov = "salida"
        elif t.tipo == "ingreso_extra":
            titulo = f"Ajuste/Anulación: {t.loan.client.nombre}"
            tipo_mov = "entrada"

        movements.append({
            "fecha": t.fecha,
            "titulo": titulo,
            "monto": t.monto_real if getattr(t, 'monto_real', None) else t.monto,
            "moneda": t.moneda,
            "tipo_ui": tipo_mov,
            "categoria": "Préstamo"
        })

    for t in cap_trans:
        movements.append({
            "fecha": t.fecha,
            "titulo": "Ajuste de Capital",
            "monto": t.monto,
            "moneda": t.moneda,
            "tipo_ui": "entrada" if t.tipo in ["inversion", "ajuste_directo"] else "salida",
            "categoria": "Capital"
        })
        
    movements.sort(key=lambda x: x["fecha"], reverse=True)
    
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("historial-movimientos.html", {"request": request, "movements": movements, "unread_count": unread_count})

@app.get("/history/loans", response_class=HTMLResponse)
def loans_history_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client)).join(Client).filter(Client.user_id == current_user.id).order_by(Loan.fecha_creacion.desc()).all()
    
    formatted_loans = []
    for l in loans:
        monto_display = l.monto_principal
        if l.moneda == 'VES':
            monto_display = l.monto_principal * (l.tasa_bcv_snapshot or tasa_actual)
            
        formatted_loans.append({
            "id": l.id,
            "client": l.client,
            "cliente_id": l.client.id,
            "monto_principal": monto_display,
            "moneda": l.moneda,
            "fecha_creacion": l.fecha_creacion,
            "estatus": l.estatus,
            "porcentaje_interes": l.porcentaje_interes
        })
        
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("historial-prestamos.html", {"request": request, "loans": formatted_loans, "unread_count": unread_count})

@app.get("/clients", response_class=HTMLResponse)
def clients_list(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    clients = db.query(Client).options(joinedload(Client.loans).joinedload(Loan.transactions)).filter(Client.user_id == current_user.id).all()
    client_data = []
    for c in clients:
        deuda = sum(utils.obtener_deuda_pendiente(l) for l in c.loans if l.estatus == 'activo')
        client_data.append({
            "id": c.id,
            "nombre": c.nombre,
            "deuda": deuda,
            "tiene_atraso": any(utils.chequear_cuota_vencida(l) for l in c.loans if l.estatus == 'activo')
        })
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("directorio-de-clientes.html", {"request": request, "clients": client_data, "unread_count": unread_count})

@app.get("/loans", response_class=HTMLResponse)
def loans_hub(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    active_loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client)).join(Client).filter(Client.user_id == current_user.id, Loan.estatus == 'activo').all()
    
    total_prestado = sum(utils.obtener_deuda_pendiente(l) for l in active_loans)
    vencidos = sum(1 for l in active_loans if utils.chequear_cuota_vencida(l))
    
    loan_list = []
    for l in active_loans:
        monto_display = l.monto_principal
        deuda_display = utils.obtener_deuda_pendiente(l)
        
        if l.moneda == 'VES':
            monto_display = l.monto_principal * tasa_actual
            deuda_display = deuda_display * tasa_actual

        loan_list.append({
            "id": l.id,
            "cliente": l.client.nombre,
            "cliente_id": l.client.id,
            "monto": monto_display,
            "deuda": deuda_display,
            "atraso": utils.chequear_cuota_vencida(l),
            "moneda": l.moneda
        })
        
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("centro-de-prestamos.html", {
        "request": request, 
        "loans": loan_list,
        "total_prestado": total_prestado,
        "vencidos": vencidos,
        "total_activos": len(active_loans),
        "tasa_actual": tasa_actual,
        "unread_count": unread_count
    })

@app.get("/settings", response_class=HTMLResponse)
def settings_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    return RedirectResponse(url="/settings/profile", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/clients/new", response_class=HTMLResponse)
def new_client_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("nuevo-cliente.html", {"request": request, "unread_count": unread_count, "csrf_token": csrf_token})

@app.post("/clients/new")
def new_client_post(
    request: Request,
    nombre: str = Form(...),
    cedula: str = Form(None),
    telefono: str = Form(None),
    direccion: str = Form(None),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    db_client = Client(
        nombre=nombre, 
        cedula=cedula or "", 
        telefono=telefono or "", 
        direccion=direccion or "", 
        user_id=current_user.id
    )
    db.add(db_client)
    db.commit()
    return RedirectResponse(url="/clients", status_code=status.HTTP_303_SEE_OTHER)



@app.get("/clients/{client_id}", response_class=HTMLResponse)
def client_detail(request: Request, client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).options(joinedload(Client.loans).joinedload(Loan.transactions)).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    active_loans = []
    for l in client.loans:
        if l.estatus == 'activo':
            deuda = utils.obtener_deuda_pendiente(l)
            active_loans.append({
                "id": l.id,
                "monto_principal": l.monto_original if l.monto_original else l.monto_principal,
                "moneda": l.moneda,
                "porcentaje_interes": l.porcentaje_interes,
                "fecha_creacion": l.fecha_creacion,
                "deuda_pendiente": deuda
            })
            
    total_deuda = sum(l['deuda_pendiente'] for l in active_loans)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("detalle-cliente.html", {
        "request": request,
        "client": client,
        "active_loans": active_loans,
        "total_deuda": total_deuda,
        "unread_count": unread_count,
        "format_currency": format_currency
    })

@app.get("/loans/new", response_class=HTMLResponse)
def new_loan_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    clients = db.query(Client).filter(Client.user_id == current_user.id).all()
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse("formulario-de-prestamo.html", {"request": request, "tasa_actual": tasa_actual, "clients": clients, "unread_count": unread_count, "user": current_user, "csrf_token": csrf_token})

@app.post("/loans/new")
def new_loan_post(
    request: Request,
    client_id: int = Form(...),
    monto_principal: Decimal = Form(...),
    moneda: str = Form(...),
    porcentaje_interes: Decimal = Form(...),
    frecuencia: str = Form("mensual"),
    cuotas: int = Form(1),
    fecha_inicio: str = Form(None),
    fecha_fin: str = Form(None),
    notas: str = Form(""),
    csrf_token: str = Form(""),
    archivos: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

    tasa = update_bcv_rate_if_needed(db)
    
    if moneda == "USD":
        updated = db.query(User).filter(
            User.id == current_user.id,
            User.capital_total_usd >= monto_principal
        ).update({User.capital_total_usd: User.capital_total_usd - monto_principal})
    else:
        updated = db.query(User).filter(
            User.id == current_user.id,
            User.capital_total_ves >= monto_principal
        ).update({User.capital_total_ves: User.capital_total_ves - monto_principal})

    if not updated:
        return RedirectResponse(url="/loans/new?error=capital_insuficiente", status_code=status.HTTP_303_SEE_OTHER)

    try:
        start_date = datetime.strptime(fecha_inicio, "%Y-%m-%d").date() if fecha_inicio else get_now_vet().date()
        end_date = datetime.strptime(fecha_fin, "%Y-%m-%d").date() if fecha_fin else None
    except:
        start_date = get_now_vet().date()
        end_date = None

    monto_base_db = monto_principal / tasa if moneda == "VES" else monto_principal

    new_loan = Loan(
        client_id=client_id,
        monto_principal=monto_base_db,
        monto_original=monto_principal,
        moneda=moneda,
        porcentaje_interes=porcentaje_interes,
        tasa_bcv_snapshot=tasa,
        frecuencia_pagos=frecuencia,
        cuotas_totales=max(1, cuotas),
        fecha_inicio=start_date,
        fecha_vencimiento=end_date,
        notas=notas,
        estatus='activo'
    )
    db.add(new_loan)
    db.flush()
    
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf', '.docx'}
    MAX_FILE_SIZE = 5 * 1024 * 1024

    for upload_file in archivos:
        if upload_file.filename:
            ext = os.path.splitext(upload_file.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue
            
            unique_filename = f"loan_{new_loan.id}_{int(datetime.now().timestamp())}{ext}"
            
            file_url = ""
            if s3_client:
                # Subir a S3
                try:
                    s3_client.upload_fileobj(
                        upload_file.file,
                        AWS_STORAGE_BUCKET_NAME,
                        f"uploads/{unique_filename}",
                        ExtraArgs={"ContentType": upload_file.content_type}
                    )
                    
                    if AWS_S3_ENDPOINT_URL:
                        # Si es Supabase o similar custom endpoint (ajuste manual de dominio público)
                        # Nota: Esto asume un bucket público para visualización simple en esta BD
                        file_url = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/uploads/{unique_filename}"
                    else:
                        file_url = f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/uploads/{unique_filename}"
                except Exception as e:
                    print(f"S3 UPLOAD ERROR: {e}")
                    # Fallback a local si Cloud falla
                    file_path = os.path.join(UPLOAD_DIR, unique_filename)
                    with open(file_path, "wb") as buffer:
                        upload_file.file.seek(0)
                        shutil.copyfileobj(upload_file.file, buffer)
                    file_url = f"/static/uploads/{unique_filename}"
            else:
                # Subida local clásica
                file_path = os.path.join(UPLOAD_DIR, unique_filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(upload_file.file, buffer)
                file_url = f"/static/uploads/{unique_filename}"
            
            # Calcular tamaño antes de guardar
            upload_file.file.seek(0, 2)
            f_size = upload_file.file.tell()
            upload_file.file.seek(0)
            
            attachment = LoanAttachment(loan_id=new_loan.id, file_path=file_url, file_size=f_size)
            db.add(attachment)
    
    monto_usd_egreso = monto_principal if moneda == "USD" else monto_base_db
    egreso_trans = Transaction(
        loan_id=new_loan.id,
        tipo='egreso_capital',
        monto=monto_usd_egreso,
        monto_real=monto_principal,
        moneda=moneda
    )
    db.add(egreso_trans)
    db.commit()

    crear_alerta(db, current_user.id, "Préstamo Otorgado", f"Préstamo registrado para {client.nombre}.", "success")
    return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/loans/{loan_id}", response_class=HTMLResponse)
def loan_detail(request: Request, loan_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    loan = db.query(Loan).join(Client).filter(Loan.id == loan_id, Client.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    
    tasa_actual = update_bcv_rate_if_needed(db)
    deuda_pendiente = utils.obtener_deuda_pendiente(loan)
    
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("detalle-prestamo.html", {
        "request": request,
        "loan": loan,
        "tasa_actual": tasa_actual,
        "deuda_pendiente": deuda_pendiente,
        "unread_count": unread_count
    })

@app.get("/clients/{client_id}/edit", response_class=HTMLResponse)
def edit_client_get(request: Request, client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("editar-cliente.html", {"request": request, "client": client, "unread_count": unread_count})

@app.post("/clients/{client_id}/edit")
def edit_client_post(
    client_id: int,
    nombre: str = Form(...),
    cedula: str = Form(None),
    telefono: str = Form(None),
    direccion: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    client.nombre = nombre
    client.cedula = cedula or ""
    client.telefono = telefono or ""
    client.direccion = direccion or ""
    db.commit()
    
    crear_alerta(db, current_user.id, "Cliente Actualizado", f"Los datos de {nombre} han sido modificados.", "info")
    return RedirectResponse(url=f"/clients/{client_id}", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/clients/{client_id}/delete")
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    db.delete(client)
    db.commit()
    
    crear_alerta(db, current_user.id, "Cliente Eliminado", f"Se ha borrado el registro del cliente.", "alert")
    return RedirectResponse(url="/clients", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/settings/capital", response_class=HTMLResponse)
def capital_settings_get(request: Request, current_user: User = Depends(require_user)):
    return templates.TemplateResponse("capital_settings.html", {"request": request, "user": current_user})

@app.post("/settings/capital")
def capital_settings_post(
    capital_usd: Decimal = Form(None), 
    capital_ves: Decimal = Form(None), 
    ajuste_usd: Decimal = Form(Decimal("0.0")),
    ajuste_ves: Decimal = Form(Decimal("0.0")),
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_user)
):
    user = current_user
    if user:
        if ajuste_usd != 0:
            db.query(User).filter(User.id == user.id).update({
                User.capital_total_usd: User.capital_total_usd + ajuste_usd
            })
            ct = CapitalTransaction(user_id=user.id, tipo="inversion" if ajuste_usd > 0 else "retiro", monto=abs(ajuste_usd), moneda="USD")
            db.add(ct)
        
        if ajuste_ves != 0:
            db.query(User).filter(User.id == user.id).update({
                User.capital_total_ves: User.capital_total_ves + ajuste_ves
            })
            ct = CapitalTransaction(user_id=user.id, tipo="inversion" if ajuste_ves > 0 else "retiro", monto=abs(ajuste_ves), moneda="VES")
            db.add(ct)

        if capital_usd is not None and ajuste_usd == 0:
            dif_usd = capital_usd - user.capital_total_usd
            if dif_usd != 0:
                ct = CapitalTransaction(user_id=user.id, tipo="ajuste_directo", monto=abs(dif_usd), moneda="USD")
                db.add(ct)
                user.capital_total_usd = capital_usd
        
        if capital_ves is not None and ajuste_ves == 0:
            dif_ves = capital_ves - user.capital_total_ves
            if dif_ves != 0:
                ct = CapitalTransaction(user_id=user.id, tipo="ajuste_directo", monto=abs(dif_ves), moneda="VES")
                db.add(ct)
                user.capital_total_ves = capital_ves
        
        if ajuste_usd != 0 or ajuste_ves != 0 or capital_usd is not None or capital_ves is not None:
            crear_alerta(db, user.id, "Capital Actualizado", "Tus ajustes de capital han sido guardados.", "success")
            
        db.commit()
    return RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/settings/profile", response_class=HTMLResponse)
def profile_settings_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("perfil-usuario.html", {
        "request": request, 
        "user": current_user, 
        "unread_count": unread_count,
        "tasa_actual": tasa_actual,
        "vapid_public_key": VAPID_PUBLIC_KEY
    })

@app.post("/settings/profile")
def profile_settings_post(
    nombre: str = Form(""),
    apellido: str = Form(""),
    password: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    current_user.nombre = nombre.strip()
    current_user.apellido = apellido.strip()
    if password:
        current_user.hashed_password = hash_password(password)
    db.commit()
    return RedirectResponse(url="/settings/profile?saved=1", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/loans/{loan_id}/cancel")
def cancel_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    loan = db.query(Loan).join(Client).filter(Loan.id == loan_id, Client.user_id == current_user.id).first()
    if not loan or loan.estatus != 'activo':
        raise HTTPException(status_code=404, detail="Préstamo no encontrado o ya no está activo")
    
    pagos_usd = sum(t.monto for t in loan.transactions if t.tipo == 'pago_cuota')
    capital_por_recuperar = max(0.0, loan.monto_principal - pagos_usd)
    
    if loan.moneda == "USD":
        db.query(User).filter(User.id == current_user.id).update({User.capital_total_usd: User.capital_total_usd + capital_por_recuperar})
    else:
        tasa = update_bcv_rate_if_needed(db)
        db.query(User).filter(User.id == current_user.id).update({User.capital_total_ves: User.capital_total_ves + (capital_por_recuperar * tasa)})
    
    loan.estatus = 'anulado'
    
    reintegro_trans = Transaction(
        loan_id=loan.id,
        tipo='ingreso_extra',
        monto=capital_por_recuperar,
        monto_real=capital_por_recuperar if loan.moneda == "USD" else (capital_por_recuperar * update_bcv_rate_if_needed(db)),
        moneda=loan.moneda
    )
    db.add(reintegro_trans)
    db.commit()

    crear_alerta(db, current_user.id, "Préstamo Anulado", f"El préstamo de {loan.client.nombre} fue anulado. Capital devuelto al fondo.", "alert")
    return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/notifications", response_class=HTMLResponse)
def notifications_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.fecha.desc()).all()
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse("notificaciones.html", {"request": request, "notifications": notifs, "unread_count": unread_count})

@app.post("/notifications/read-all")
def notifications_read_all(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"leida": True})
    db.commit()
    return RedirectResponse(url="/notifications", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/loans/{loan_id}/pay")
def register_payment(
    loan_id: int,
    monto: Decimal = Form(...),
    moneda_pago: str = Form("USD"),
    tasa_pago: Decimal = Form(None),
    tipo: str = Form("pago_cuota"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    loan = db.query(Loan).join(Client).filter(Loan.id == loan_id, Client.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
        
    if monto <= 0:
        return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)
    
    tasa = tasa_pago or update_bcv_rate_if_needed(db)
    
    # Validar que no se pague más de la cuenta
    deuda_pendiente = utils.obtener_deuda_pendiente(loan, en_bolivares=(moneda_pago == "VES"), tasa_actual=tasa)
    if monto > (deuda_pendiente + 0.1): # Margen para errores de redondeo de centavos
        return RedirectResponse(url=f"/loans?error=pago_excesivo&max={deuda_pendiente}", status_code=status.HTTP_303_SEE_OTHER)
    
    monto_final_usd = monto
    
    if loan.moneda == "VES":
        if moneda_pago == "VES":
            monto_final_usd = monto / tasa
        else:
            monto_final_usd = monto
    else:
        if moneda_pago == "VES":
            monto_final_usd = monto / tasa
        else:
            monto_final_usd = monto

    new_transaction = Transaction(
        loan_id=loan_id, 
        tipo=tipo, 
        monto=monto_final_usd, 
        monto_real=monto, 
        moneda=moneda_pago
    )
    db.add(new_transaction)
    
    if moneda_pago == "USD":
        db.query(User).filter(User.id == current_user.id).update({
            User.capital_total_usd: User.capital_total_usd + monto
        })
    else:
        db.query(User).filter(User.id == current_user.id).update({
            User.capital_total_ves: User.capital_total_ves + monto
        })

    db.commit()
    db.refresh(loan)
    
    deuda = utils.obtener_deuda_pendiente(loan, en_bolivares=True, tasa_actual=tasa)
    
    if deuda <= 0.5:
        loan.estatus = 'pagado'
        crear_alerta(db, current_user.id, "Préstamo Liquidado", f"El préstamo de {loan.client.nombre} ha sido pagado totalmente.", "success")
    else:
        crear_alerta(db, current_user.id, "Abono Recibido", f"Se registró un pago de {monto} {moneda_pago} de {loan.client.nombre}.", "info")
        
    db.commit()
    return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/clients/", response_model=schemas.ClientResponse)
def create_client_api(
    request: Request,
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    """
    API endpoint para crear clientes via JSON (usado por el modal de registro rápido).
    Requiere header X-CSRF-Token válido.
    Diferente de POST /clients/new que procesa formulario HTML con campo csrf_token.
    """
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token or not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    # Validar que el nombre no esté vacío después de strip
    nombre = client.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre del cliente es requerido")
    
    db_client = Client(
        nombre=nombre,
        cedula=client.cedula.strip() if client.cedula else "",
        telefono=client.telefono.strip() if client.telefono else "",
        direccion=client.direccion.strip() if client.direccion else "",
        user_id=current_user.id
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@app.post("/loans/", response_model=schemas.LoanResponse)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).filter(Client.id == loan.client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=403, detail="No autorizado para este cliente")
        
    tasa = update_bcv_rate_if_needed(db)
    
    db_loan = Loan(
        **loan.model_dump(),
        tasa_bcv_snapshot=tasa,
        estatus='activo'
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.get("/reports", response_class=HTMLResponse)
def reports_dashboard(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    user = current_user
    tasa_actual = update_bcv_rate_if_needed(db)

    active_loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client)).join(Client).filter(Client.user_id == current_user.id, Loan.estatus == 'activo').all()

    prestamos_vencidos: int = sum(1 for l in active_loans if utils.chequear_cuota_vencida(l))
    total_activos: int = len(active_loans)
    capital_prestado_usd: Decimal = sum(
        max(Decimal("0.0"), l.monto_principal - sum(t.monto for t in l.transactions if t.tipo == 'pago_cuota')) 
        for l in active_loans
    )

    ganancias_proyectadas: Decimal = sum(
        utils.calcular_interes_simple(l.monto_principal, l.porcentaje_interes) * Decimal(str(l.cuotas_totales or 1))
        for l in active_loans
    )

    ganancias_reales: Decimal = Decimal("0.0")
    all_user_loans = db.query(Loan).join(Client).filter(Client.user_id == user.id).all()
    for l in all_user_loans:
        pagos_usd = sum(t.monto for t in l.transactions if t.tipo == 'pago_cuota')
        if pagos_usd > l.monto_principal:
            ganancias_reales += (pagos_usd - l.monto_principal)

    unread_count = db.query(Notification).filter(Notification.user_id == user.id, Notification.leida == False).count()

    disponible_usd: Decimal = user.capital_total_usd
    disponible_ves: Decimal = user.capital_total_ves

    hoy = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        target_date = hoy.replace(day=1) - relativedelta(months=i)
        start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = (start + relativedelta(months=1))
        mes_label = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][start.month - 1]
        meses_labels.append(mes_label)

        sum_mes: Decimal = db.query(func.sum(Transaction.monto)).join(Loan).join(Client).filter(
            Client.user_id == user.id,
            Transaction.tipo == 'pago_cuota',
            Transaction.fecha >= start,
            Transaction.fecha < end
        ).scalar() or Decimal("0.0")
        meses_valores.append(sum_mes)

    max_val: Decimal = max(meses_valores) if meses_valores and max(meses_valores) > Decimal("0.0") else Decimal("1.0")
    grafico_data = [{"label": l, "height": int((v / max_val) * 100)} for l, v in zip(meses_labels, meses_valores)]

    loans_activos = []
    for l in active_loans:
        loans_activos.append({
            "id": l.id,
            "client": l.client,
            "monto_principal": l.monto_original if l.monto_original else l.monto_principal,
            "moneda": l.moneda,
            "porcentaje_interes": l.porcentaje_interes,
            "fecha_creacion": l.fecha_creacion,
            "fecha_vencimiento": l.fecha_vencimiento,
            "vencido": utils.chequear_cuota_vencida(l),
        })

    promedio_prestamo: Decimal = (capital_prestado_usd / Decimal(str(total_activos))) if total_activos > 0 else Decimal("0.0")
    recaudacion_total: Decimal = db.query(func.sum(Transaction.monto)).join(Loan).join(Client).filter(
        Client.user_id == user.id,
        Transaction.tipo == 'pago_cuota'
    ).scalar() or Decimal("0.0")
    
    usd_count: int = sum(1 for l in active_loans if l.moneda == 'USD')
    ves_count: int = sum(1 for l in active_loans if l.moneda == 'VES')

    return templates.TemplateResponse("reportes-dashboard.html", {
        "request": request,
        "user": user,
        "total_activos": total_activos,
        "prestamos_vencidos": prestamos_vencidos,
        "capital_prestado_usd": capital_prestado_usd,
        "ganancias_reales": ganancias_reales,
        "ganancias_proyectadas": ganancias_proyectadas,
        "disponible_usd": disponible_usd,
        "disponible_ves": disponible_ves,
        "tasa_actual": tasa_actual,
        "grafico_data": grafico_data,
        "loans_activos": loans_activos,
        "unread_count": unread_count,
        "promedio_prestamo": promedio_prestamo,
        "recaudacion_total": recaudacion_total,
        "usd_count": usd_count,
        "ves_count": ves_count
    })