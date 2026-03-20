# scripts/migrate_plain_passwords.py
# Ejecutar: python scripts/migrate_plain_passwords.py
import sys
import os
sys.path.append(os.getcwd())
from database import SessionLocal, User
from main import hash_password

db = SessionLocal()
users = db.query(User).filter(~User.hashed_password.startswith("$2b$")).all()
print(f"Usuarios con contraseña en texto plano: {len(users)}")
for user in users:
    print(f"  - {user.username}: requiere reset de contraseña")
    # Invalidar la contraseña para forzar reset (no podemos hashear sin saber el plain)
    user.hashed_password = "RESET_REQUIRED"
db.commit()
print("Hecho. Estos usuarios deben usar 'Olvidé mi contraseña'.")
db.close()
