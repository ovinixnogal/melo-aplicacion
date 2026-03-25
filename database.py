
import os
from sqlalchemy import create_engine, Column, Integer, String, Numeric, ForeignKey, DateTime, Date, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./loans.db"

# Corrección para SQLAlchemy 1.4+ y Supabase en Railway
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Asegurar modo SSL si es una base de datos remota
if "postgresql" in DATABASE_URL and "sslmode" not in DATABASE_URL:
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL += f"{separator}sslmode=require"

# Configuración del motor
if DATABASE_URL.startswith("sqlite"):
    print("DATABASE: Usando SQLite local.")
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    print(f"DATABASE: Conectando a {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'remoto'}")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class AdminActionLog(Base):
    __tablename__ = "admin_action_logs"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    detail = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: get_now_utc())

from datetime import datetime, timezone, timedelta

# Zona horaria de Venezuela (UTC-4, sin ajuste de horario de verano)
VET = timezone(timedelta(hours=-4))


def get_now_utc() -> datetime:
    """
    Retorna el datetime actual en UTC, con información de zona horaria.
    Usar esto para TODOS los timestamps almacenados en la base de datos.
    """
    return datetime.now(timezone.utc)


def get_now_vet() -> datetime:
    """
    Retorna el datetime actual en zona Venezuela (VET = UTC-4).
    SOLO usar para presentación. No almacenar en BD.
    Mantener por compatibilidad con código existente que lo llama.
    """
    return datetime.now(VET)


def utc_to_vet(dt: datetime) -> datetime:
    """
    Convierte un datetime UTC a Venezuela. Útil en templates o reportes.
    Si el datetime es naive (sin zona), asume UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(VET)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nombre = Column(String, nullable=True)
    apellido = Column(String, nullable=True)
    hashed_password = Column(String)
    capital_total_usd = Column(Numeric(precision=20, scale=4), default=0.0)
    capital_total_ves = Column(Numeric(precision=20, scale=4), default=0.0)
    created_at = Column(DateTime(timezone=True), default=get_now_utc)
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    webauthn_id = Column(String, unique=True, nullable=True) # Unico para cada usuario
    credentials = relationship("WebAuthnCredential", back_populates="user")
    push_subscriptions = relationship("PushSubscription", back_populates="user")

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    nombre = Column(String, index=True)
    telefono = Column(String)
    cedula = Column(String, nullable=True)
    direccion = Column(String)
    created_at = Column(DateTime(timezone=True), default=get_now_utc)
    updated_at = Column(DateTime(timezone=True), default=get_now_utc, onupdate=get_now_utc)
    
    user = relationship("User", backref="clients")
    loans = relationship("Loan", back_populates="client")

class Rate(Base):
    __tablename__ = "rates"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, unique=True, index=True)
    valor_bs_bcv = Column(Numeric(precision=20, scale=4))
    updated_at = Column(DateTime(timezone=True), default=get_now_utc, onupdate=get_now_utc)

class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), index=True)
    monto_principal = Column(Numeric(precision=20, scale=4)) 
    monto_original = Column(Numeric(precision=20, scale=4), nullable=True) 
    moneda = Column(String) # 'USD' o 'VES'
    tasa_bcv_snapshot = Column(Numeric(precision=20, scale=4))
    porcentaje_interes = Column(Numeric(precision=20, scale=4))
    frecuencia_pagos = Column(String, default="mensual") 
    cuotas_totales = Column(Integer, default=1)
    fecha_inicio = Column(Date, default=lambda: get_now_vet().date())
    fecha_vencimiento = Column(Date, nullable=True)
    estatus = Column(String, default="activo", index=True) 
    notas = Column(String, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), default=get_now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=get_now_utc, onupdate=get_now_utc)
    
    client = relationship("Client", back_populates="loans")
    transactions = relationship("Transaction", back_populates="loan")
    attachments = relationship("LoanAttachment", back_populates="loan")

class LoanAttachment(Base):
    __tablename__ = "loan_attachments"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), index=True)
    file_path = Column(String)
    file_size = Column(Integer, default=0) # Tamaño en bytes
    created_at = Column(DateTime(timezone=True), default=get_now_utc)
    
    loan = relationship("Loan", back_populates="attachments")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), index=True)
    tipo = Column(String) 
    monto = Column(Numeric(precision=20, scale=4)) 
    monto_real = Column(Numeric(precision=20, scale=4), nullable=True) 
    moneda = Column(String, default="USD") 
    fecha = Column(DateTime(timezone=True), default=get_now_utc, index=True)
    
    loan = relationship("Loan", back_populates="transactions")

class CapitalTransaction(Base):
    __tablename__ = "capital_transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tipo = Column(String) 
    monto = Column(Numeric(precision=20, scale=4))
    moneda = Column(String, default="USD") 
    fecha = Column(DateTime(timezone=True), default=get_now_utc)
    
    user = relationship("User", backref="capital_transactions")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    titulo = Column(String)
    mensaje = Column(String)
    fecha = Column(DateTime(timezone=True), default=get_now_utc)
    tipo = Column(String, default="info") 
    leida = Column(Boolean, default=False)
    
    user = relationship("User", backref="notifications")

class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    credential_id = Column(String, unique=True, index=True)
    public_key = Column(String)
    sign_count = Column(Integer, default=0)
    transports = Column(String, nullable=True) 
    
    user = relationship("User", back_populates="credentials")

class SupportRequest(Base):
    __tablename__ = "support_requests"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String)
    token = Column(String)
    fecha = Column(DateTime(timezone=True), default=get_now_utc)
    atendida = Column(Boolean, default=False)

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String, unique=True, index=True)
    auth_key = Column(String)
    p256dh_key = Column(String)
    browser = Column(String, nullable=True) # Para saber si es iPhone, Chrome, etc
    created_at = Column(DateTime(timezone=True), default=get_now_utc)
    
    user = relationship("User", back_populates="push_subscriptions")

def init_db():
    """
    Crea las tablas si no existen (solo para desarrollo inicial).
    En producción, las migraciones se manejan con Alembic:
        alembic upgrade head
    """
    if os.environ.get("RESET_DATABASE") == "true":
        print("DATABASE: Reseteando base de datos (RESET_DATABASE=true)...")
        Base.metadata.drop_all(bind=engine)
    
    Base.metadata.create_all(bind=engine)
    print("DATABASE: Schema verificado correctamente.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
