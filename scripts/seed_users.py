import bcrypt
from database import SessionLocal, User, get_now_utc
from sqlalchemy.orm import Session


# Usuarios de ejemplo SOLO con email
USERS = [
    {
        "email": "admin@melofinance.com",
        "nombre": "Admin",
        "apellido": "Principal",
        "password": "admin123",
        "is_admin": True,
        "is_active": True
    },
    {
        "email": "juan@example.com",
        "nombre": "Juan",
        "apellido": "Pérez",
        "password": "usuario123",
        "is_admin": False,
        "is_active": True
    },
    {
        "email": "ana@example.com",
        "nombre": "Ana",
        "apellido": "García",
        "password": "usuario456",
        "is_admin": False,
        "is_active": True
    }
]

def reset_and_seed():
    from database import Base, engine
    # Crear todas las tablas si no existen
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    db.query(User).delete()
    db.commit()
    for u in USERS:
        hashed = bcrypt.hashpw(u["password"].encode(), bcrypt.gensalt()).decode()
        user = User(
            email=u["email"],
            nombre=u["nombre"],
            apellido=u["apellido"],
            hashed_password=hashed,
            is_admin=u["is_admin"],
            is_active=u["is_active"],
            created_at=get_now_utc()
        )
        db.add(user)
    db.commit()
    db.close()

if __name__ == "__main__":
    reset_and_seed()
    print("Usuarios de ejemplo insertados.")
