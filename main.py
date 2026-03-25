import os
import sys
import shutil
import base64
import json
import secrets
import time
import bcrypt
import traceback
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import List, Optional, Dict

import boto3
from botocore.exceptions import NoCredentialsError
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Request, Form, HTTPException, status, Response, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import engine, Base, get_db, init_db, get_now_vet, get_now_utc, utc_to_vet, \
    User, Client, Loan, Transaction, Rate, CapitalTransaction, Notification, \
    LoanAttachment, WebAuthnCredential, PushSubscription, SupportRequest, AdminActionLog
import schemas
from scraper import update_bcv_rate_if_needed
import utils

# Shared objects and logic
from core.shared import templates, signer, SECRET_KEY, RP_ID, RP_NAME, ORIGIN, \
    VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS, \
    format_datetime_vet, format_date_vet, \
    crear_alerta, log_admin_action, get_pagination_params, get_pagination_metadata, \
    get_current_user, require_user, generate_csrf_token, verify_csrf_token, \
    STATIC_DIR, UPLOAD_DIR, TEMPLATES_DIR, _IS_PRODUCTION, \
    check_rate_limit, hash_password, verify_password, needs_rehash

# Cargar variables de entorno desde .env si existe
load_dotenv()

# Inicialización de la app
app = FastAPI(title="Melo Préstamos - Bimoneda", description="App de gestión de préstamos USD/VES", version="1.0.0")

# Asegurar directorios
for d in [STATIC_DIR, UPLOAD_DIR, TEMPLATES_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

# Templates setup
def format_currency_filter(value):
    try:
        if value is None: return "0,00"
        d_val = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return "{:,.2f}".format(float(d_val)).replace(",", "X").replace(".", ",").replace("X", ".")
    except: return value

templates.env.cache = None
templates.env.filters["format_currency"] = format_currency_filter
templates.env.filters["format_datetime"] = format_datetime_vet
templates.env.filters["format_date"] = format_date_vet

# --- Manejo de Errores Globales ---
@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc: Exception):
    return templates.TemplateResponse(request=request, name="error.html", context={
        "code": 404, "message": "Página no encontrada",
        "details": "El enlace que seguiste podría estar roto o la página pudo haber sido movida."
    }, status_code=404)

@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    print(f"INTERNAL SERVER ERROR: {exc}")
    traceback.print_exc()
    return templates.TemplateResponse(request=request, name="error.html", context={
        "code": 500, "message": "Error del Servidor",
        "details": "Estamos experimentando dificultades técnicas. Nuestro equipo ha sido notificado."
    }, status_code=500)

# Scripts path and analytics
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts'))
try:
    import analytics_engine
except ImportError:
    print("WARNING: analytics_engine could not be imported.")

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
            's3', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION, endpoint_url=AWS_S3_ENDPOINT_URL
        )
    except Exception as e:
        print(f"STORAGE ERROR: Falló vinculación a S3 ({e}). Fallback local.")
else:
    print("STORAGE WARNING: Credenciales S3 faltantes. Usando almacenamiento local.")

# --- Apps events & Mounting ---
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        update_bcv_rate_if_needed(db)
        print("🚀 STARTUP: Sistema inicializado correctamente.")
    except Exception as e:
        print(f"🚀 STARTUP ERROR: {e}")
    finally:
        sys.stdout.flush()

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- Basic Routes ---
@app.get("/", response_class=RedirectResponse)
def index():
    return RedirectResponse(url="/login")

@app.get("/terminos", response_class=HTMLResponse)
def terminos_get(request: Request):
    return templates.TemplateResponse(request=request, name="terminos.html", context={})

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if current_user.capital_total_usd == 0 and current_user.capital_total_ves == 0:
        return RedirectResponse(url="/settings/capital")
        
    tasa_actual = update_bcv_rate_if_needed(db)
    stats = utils.get_financial_stats(db, current_user.id)
    
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    total_clientes = db.query(Client).filter(Client.user_id == current_user.id).count()

    trans_recientes = db.query(Transaction).join(Loan).join(Client).filter(Client.user_id == current_user.id).order_by(Transaction.fecha.desc()).limit(5).all()
    recientes = []
    for t in trans_recientes:
        desc = "Pago Recibido" if t.tipo == 'pago_cuota' else "Préstamo Otorgado"
        if t.tipo == 'ingreso_extra': desc = "Ajuste de Capital"
        recientes.append({
            "tipo": t.tipo, "descripcion": f"{desc}: {t.loan.client.nombre}" if t.loan else desc,
            "fecha": format_date_vet(t.fecha), "monto": t.monto_real or t.monto, "moneda": t.moneda
        })

    return templates.TemplateResponse(request=request, name="dashboard.html", context={
        "capital_total_usd": current_user.capital_total_usd, "capital_total_ves": current_user.capital_total_ves,
        "capital_prestado_usd": stats["capital_prestado_usd"], "prestamos_vencidos": stats["prestamos_vencidos"],
        "total_prestamos_activos": stats["total_activos"], "total_clientes": total_clientes,
        "recientes": recientes, "ganancias_proyectadas": stats["ganancias_proyectadas"],
        "ganancias_reales": stats["ganancias_reales"], "tasa_actual": tasa_actual,
        "unread_count": unread_count, "meses_labels": stats["meses_labels"],
        "meses_valores": [float(v) for v in stats["meses_valores"]], "user": current_user
    })

@app.get("/reports", response_class=HTMLResponse)
def reports_dashboard(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    stats = utils.get_financial_stats(db, current_user.id)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    
    loans_activos = []
    for l in stats["active_loans"]:
        loans_activos.append({
            "id": l.id, "client": l.client, "monto_principal": l.monto_original or l.monto_principal,
            "moneda": l.moneda, "porcentaje_interes": l.porcentaje_interes, "fecha_creacion": l.fecha_creacion,
            "fecha_vencimiento": l.fecha_vencimiento, "vencido": utils.chequear_cuota_vencida(l),
        })

    promedio = (stats["capital_prestado_usd"] / Decimal(str(stats["total_activos"]))) if stats["total_activos"] > 0 else Decimal("0.0")
    recaudacion = db.query(func.sum(Transaction.monto)).join(Loan).join(Client).filter(
        Client.user_id == current_user.id, Transaction.tipo == 'pago_cuota'
    ).scalar() or Decimal("0.0")
    
    capital_prestado_ves = sum(
        max(Decimal("0.0"), (l.monto_original or l.monto_principal * (l.tasa_bcv_snapshot or tasa_actual)) - sum(Decimal(str(t.monto_real or t.monto)) for t in l.transactions if t.tipo == 'pago_cuota')) 
        for l in stats["active_loans"] if l.moneda == 'VES'
    )

    return templates.TemplateResponse(request=request, name="reportes-dashboard.html", context={
        "user": current_user, "prestamos_activos": stats["total_activos"], "prestamos_vencidos": stats["prestamos_vencidos"],
        "capital_prestado_usd": stats["capital_prestado_usd"], "capital_prestado_ves": capital_prestado_ves,
        "ganancias_reales": stats["ganancias_reales"], "ganancias_proyectadas": stats["ganancias_proyectadas"],
        "ingresos_usd": recaudacion, "disponible_usd": current_user.capital_total_usd, "disponible_ves": current_user.capital_total_ves,
        "tasa_actual": tasa_actual, "meses_labels": stats["meses_labels"], "meses_valores": [float(v) for v in stats["meses_valores"]],
        "loans_activos": loans_activos, "unread_count": unread_count, "promedio_prestamo": promedio, "recaudacion_total": recaudacion,
        "usd_count": sum(1 for l in stats["active_loans"] if l.moneda == 'USD'),
        "ves_count": sum(1 for l in stats["active_loans"] if l.moneda == 'VES')
    })

@app.get("/history/movements", response_class=HTMLResponse)
def movements_history_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    loan_trans = db.query(Transaction).join(Loan).join(Client).filter(Client.user_id == current_user.id).all()
    cap_trans = db.query(CapitalTransaction).filter(CapitalTransaction.user_id == current_user.id).all()
    movements = []
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
            "fecha": t.fecha, "titulo": titulo, "monto": t.monto_real or t.monto,
            "moneda": t.moneda, "tipo_ui": tipo_mov, "categoria": "Préstamo"
        })
    for t in cap_trans:
        movements.append({
            "fecha": t.fecha, "titulo": "Ajuste de Capital", "monto": t.monto, "moneda": t.moneda,
            "tipo_ui": "entrada" if t.tipo in ["inversion", "ajuste_directo"] else "salida", "categoria": "Capital"
        })
    movements.sort(key=lambda x: x["fecha"], reverse=True)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="historial-movimientos.html", context={"movements": movements, "unread_count": unread_count, "user": current_user})

@app.get("/history/loans", response_class=HTMLResponse)
def loans_history_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client)).join(Client).filter(Client.user_id == current_user.id).order_by(Loan.fecha_creacion.desc()).all()
    formatted_loans = []
    for l in loans:
        monto_display = l.monto_principal
        if l.moneda == 'VES': monto_display = float(l.monto_principal) * float(l.tasa_bcv_snapshot or tasa_actual)
        formatted_loans.append({
            "id": l.id, "client": l.client, "cliente_id": l.client.id, "monto_principal": monto_display,
            "moneda": l.moneda, "fecha_creacion": l.fecha_creacion, "estatus": l.estatus, "porcentaje_interes": l.porcentaje_interes
        })
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="historial-prestamos.html", context={"loans": formatted_loans, "unread_count": unread_count, "user": current_user})

# --- Include Routers ---
from routes import auth, admin, loans, clients, settings, notifications
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(loans.router)
app.include_router(clients.router)
app.include_router(settings.router)
app.include_router(notifications.router)

print("🚀 MELO FINANCE PRO v2.6 - FULLY MODULARIZED & STABLE")
sys.stdout.flush()