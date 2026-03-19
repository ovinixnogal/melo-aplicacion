import os
from sqlalchemy import create_engine, Column, Integer, String, Numeric, ForeignKey, DateTime, Date, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import zoneinfo

def get_now_vet():
    # Retorna la hora local en Venezuela (VET) sin información de zona (naive)
    return datetime.now(zoneinfo.ZoneInfo("America/Caracas")).replace(tzinfo=None)

# URL de la base de datos (Usa variable de entorno para la nube o SQLite local por defecto)
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./loans.db")

# Si la URL empieza con postgres:// (como en Render/Neon), cambiarla a postgresql:// para SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configuración del motor
if DATABASE_URL.startswith("sqlite"):
    print("DATABASE: Usando SQLite local.")
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    print(f"DATABASE: Conectando a {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'remoto'}")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) 
    nombre = Column(String, nullable=True)
    apellido = Column(String, nullable=True)
    hashed_password = Column(String)
    capital_total_usd = Column(Numeric(precision=20, scale=4), default=0.0)
    capital_total_ves = Column(Numeric(precision=20, scale=4), default=0.0)
    created_at = Column(DateTime, default=get_now_vet)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    webauthn_id = Column(String, unique=True, nullable=True) # Unico para cada usuario
    
    credentials = relationship("WebAuthnCredential", back_populates="user")
    push_subscriptions = relationship("PushSubscription", back_populates="user")

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    nombre = Column(String, index=True)
    telefono = Column(String)
    cedula = Column(String, nullable=True)
    direccion = Column(String)
    created_at = Column(DateTime, default=get_now_vet)
    updated_at = Column(DateTime, default=get_now_vet, onupdate=get_now_vet)
    
    user = relationship("User", backref="clients")
    loans = relationship("Loan", back_populates="client")

class Rate(Base):
    __tablename__ = "rates"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, unique=True, index=True)
    valor_bs_bcv = Column(Numeric(precision=20, scale=4))
    updated_at = Column(DateTime, default=get_now_vet, onupdate=get_now_vet)

class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    monto_principal = Column(Numeric(precision=20, scale=4)) 
    monto_original = Column(Numeric(precision=20, scale=4), nullable=True) 
    moneda = Column(String) # 'USD' o 'VES'
    tasa_bcv_snapshot = Column(Numeric(precision=20, scale=4))
    porcentaje_interes = Column(Numeric(precision=20, scale=4))
    frecuencia_pagos = Column(String, default="mensual") 
    cuotas_totales = Column(Integer, default=1)
    fecha_inicio = Column(Date, default=lambda: get_now_vet().date())
    fecha_vencimiento = Column(Date, nullable=True)
    estatus = Column(String, default="activo") 
    notas = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=get_now_vet)
    updated_at = Column(DateTime, default=get_now_vet, onupdate=get_now_vet)
    
    client = relationship("Client", back_populates="loans")
    transactions = relationship("Transaction", back_populates="loan")
    attachments = relationship("LoanAttachment", back_populates="loan")

class LoanAttachment(Base):
    __tablename__ = "loan_attachments"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    file_path = Column(String)
    file_size = Column(Integer, default=0) # Tamaño en bytes
    created_at = Column(DateTime, default=get_now_vet)
    
    loan = relationship("Loan", back_populates="attachments")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    tipo = Column(String) 
    monto = Column(Numeric(precision=20, scale=4)) 
    monto_real = Column(Numeric(precision=20, scale=4), nullable=True) 
    moneda = Column(String, default="USD") 
    fecha = Column(DateTime, default=get_now_vet)
    
    loan = relationship("Loan", back_populates="transactions")

class CapitalTransaction(Base):
    __tablename__ = "capital_transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tipo = Column(String) 
    monto = Column(Numeric(precision=20, scale=4))
    moneda = Column(String, default="USD") 
    fecha = Column(DateTime, default=get_now_vet)
    
    user = relationship("User", backref="capital_transactions")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    titulo = Column(String)
    mensaje = Column(String)
    fecha = Column(DateTime, default=get_now_vet)
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
    fecha = Column(DateTime, default=get_now_vet)
    atendida = Column(Boolean, default=False)

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String, unique=True, index=True)
    auth_key = Column(String)
    p256dh_key = Column(String)
    browser = Column(String, nullable=True) # Para saber si es iPhone, Chrome, etc
    created_at = Column(DateTime, default=get_now_vet)
    
    user = relationship("User", back_populates="push_subscriptions")

def init_db():
    if os.environ.get("RESET_DATABASE") == "true":
        print("DATABASE: Reseteando base de datos (RESET_DATABASE=true)...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Migración RADICAL para columnas nuevas si la tabla ya existe
    with engine.begin() as conn: # engine.begin maneja automáticamente la transacción (COMMIT)
        print("🛠️ MIGRACION RADICAL v2.4 INICIADA...")
        
        # Inyectar is_active en users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE"))
            print("DATABASE: ✅ Columna 'is_active' inyectada en 'users'.")
        except Exception as e:
            # Capturar el texto completo del error para verlo en Railway
            print(f"DATABASE ERROR DETECTED (User.is_active): {str(e)[:100]}")
            
        # Inyectar is_admin en users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))
            print("DATABASE: ✅ Columna 'is_admin' inyectada en 'users'.")
        except Exception as e:
            pass
            
        # Inyectar file_size en loan_attachments
        try:
            conn.execute(text("ALTER TABLE loan_attachments ADD COLUMN file_size INTEGER DEFAULT 0"))
            print("DATABASE: ✅ Columna 'file_size' inyectada.")
        except Exception:
            pass
            
        import sys
        sys.stdout.flush() 

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
