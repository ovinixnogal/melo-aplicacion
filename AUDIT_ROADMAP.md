# 🗺️ Hoja de Ruta de Estabilidad y Seguridad: Melo Finance

Este documento cataloga los fallos críticos identificados por la auditoría y su estado de resolución.

---

## 🚫 Fallos Críticos de la Auditoría

### 1. Riesgo de ZeroDivisionError en Conversión de Divisa
- **Problema**: El scraper de tasas podía retornar `0.0`. Al dividir el monto por esta tasa, el sistema crasheaba con un Error 500 irrecuperable.
- **Solución**: Se implementó una constante `DEFAULT_FALLBACK_RATE` y lógica de seguridad en `scraper.py` para asegurar que nunca se retorne 0.
- [x] **Estado**: Solucionado.

### 2. Seguridad por Oscuridad (Backdoor de Admin)
- **Problema**: El acceso administrativo dependía de un secreto en la URL (`?secret=...`). Cualquiera con el historial del navegador o acceso a logs de red podía entrar.
- **Solución**: Se implementó un sistema de roles real (`is_admin`). Ahora el acceso está restringido a usuarios autenticados con permisos específicos.
- [x] **Estado**: Solucionado.

### 3. Falta de Redirección Inteligente
- **Problema**: Los administradores tenían que entrar manualmente por una URL especial en lugar de usar el flujo de login estándar.
- **Solución**: El endpoint de login ahora detecta el rol del usuario. Si eres Admin, vas directo al Panel HQ. Si eres Usuario, vas al Dashboard común.
- [x] **Estado**: Solucionado.

### 4. Precisión Financiera (Floats vs Decimals)
- **Problema**: El uso de `float` causaba errores de redondeo acumulativos.
- **Solución**: Se han migrado todos los modelos SQLAlchemy, esquemas Pydantic, utilidades de cálculo y dashboards (Reportes y General) a usar `Decimal`.
- [x] **Estado**: Solucionado.

### 5. Falta de Atomicidad en Transacciones
- **Problema**: Si el sistema falla entre la deducción de capital y la creación del préstamo, el capital se pierde del fondo del usuario sin que el préstamo quede registrado.
- **Solución**: Envolver las operaciones de capital y creación de préstamos en bloques de transacción (`db.begin()`).
- [ ] **Estado**: Pendiente.

### 6. Persistencia Efímera de Documentos
- **Problema**: Al usar almacenamiento local como respaldo, los despliegues en plataformas como Railway borran todos los contratos y fotos subidas.
- **Solución**: Forzar el uso exclusivo de S3 o Supabase Storage para todos los adjuntos en producción.
- [ ] **Estado**: Pendiente.

### 7. Lógica de Mora Simplista
- **Problema**: El cálculo de cuotas vencidas asume meses de 30 días parejos, fallando en meses de 31 o febrero.
- **Solución**: Refactorizar para usar fechas reales de vencimiento y calendarios de pagos específicos.
- [ ] **Estado**: Pendiente.

### 8. Error Crítico en Login (Regression Bug)
- **Problema**: Tras la última actualización, la variable `token` no estaba definida.
- **Solución**: Restaurada la generación del token de sesión.
- [x] **Estado**: Solucionado.

### 9. Vulnerabilidad Masiva de CSRF
- **Problema**: La gran mayoría de los endpoints `POST` (crear préstamos, registrar pagos, ajustes de capital) no están verificando el token CSRF. Un atacante podría realizar operaciones a nombre del usuario.
- **Solución**: Aplicar el helper `verify_csrf_token` de forma consistente en todos los formularios sensibles.
- [ ] **Estado**: Pendiente.

### 10. Desfase de Zonas Horarias (UTC vs VET)
- **Problema**: El sistema mezcla `datetime.utcnow()` con `get_now_vet()`, lo que causa que los reportes mensuales tengan discrepancias de hasta un día dependiendo de la hora del registro.
- **Solución**: Estandarizar toda la aplicación para usar `timezone.utc` u objetos `datetime` con zona horaria explícita.
- [ ] **Estado**: Pendiente.

### 11. Riesgo de Spam en Registro
- **Problema**: El endpoint de `/signup` no tiene límite de tasa (rate limiting), permitiendo ataques de creación masiva de cuentas.
- **Solución**: Aplicar `check_rate_limit` también en el registro de usuarios.
- [ ] **Estado**: Pendiente.

### 12. Rendimiento (N+1 Queries) en Panel Admin
- **Problema**: El panel de administración carga todos los usuarios y luego realiza consultas individuales para contar sus registros y archivos. Con muchos usuarios, la página se volverá extremadamente lenta.
- **Solución**: Usar `subqueryload` o JOINS con agregaciones para obtener todos los conteos en una sola consulta.
- [ ] **Estado**: Pendiente.

---

## 🛠️ Panel de Administración Profesional
El panel ha sido migrado a `/admin/soporte` y ahora requiere autenticación real.
- [x] Protección de rutas por rol.
- [x] Eliminación de parámetros por URL (secretos).
- [x] Integración con el flujo de login universal.
