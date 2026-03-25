"""
Configuración central de la aplicación FastAPI
"""

from pydantic import BaseSettings

class Settings(BaseSettings):
    # Agrega aquí tus variables de entorno/configuración
    APP_NAME: str = "Melo Aplicación"
    DEBUG: bool = True
    # ...otros parámetros...

settings = Settings()
