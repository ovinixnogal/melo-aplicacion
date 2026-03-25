from database import Loan, Transaction, Notification, Client, CapitalTransaction, get_now_vet, get_now_utc, utc_to_vet
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta

def calcular_interes_simple(monto: Decimal, porcentaje: Decimal) -> Decimal:
    return Decimal(str(monto)) * (Decimal(str(porcentaje)) / Decimal("100.0"))

def chequear_cuota_vencida(loan: Loan) -> bool:
    """Determina si el préstamo tiene una cuota vencida según su frecuencia, contemplando pagos."""
    if loan.estatus in ["pagado", "anulado"]:
        return False
    
    frecuencia_map = {
        "diario": lambda d, n: d + relativedelta(days=n),
        "semanal": lambda d, n: d + relativedelta(weeks=n),
        "quincenal": lambda d, n: d + relativedelta(days=15*n),
        "mensual": lambda d, n: d + relativedelta(months=n),
    }
    frecuencia = (loan.frecuencia_pagos or "mensual").lower()
    cuotas_totales = max(1, loan.cuotas_totales)
    fecha_inicio = loan.fecha_inicio or (loan.fecha_creacion.date() if hasattr(loan.fecha_creacion, 'date') else loan.fecha_creacion)
    
    # Usar date para comparación
    now_date = get_now_utc().date()

    # Calcular cuántas cuotas deberían estar vencidas a la fecha real
    cuotas_vencidas = 0
    for n in range(1, cuotas_totales + 1):
        if frecuencia in frecuencia_map:
            fecha_cuota = frecuencia_map[frecuencia](fecha_inicio, n)
        else:
            fecha_cuota = fecha_inicio + relativedelta(months=n)
            
        if now_date >= fecha_cuota:
            cuotas_vencidas += 1
        else:
            break

    if cuotas_vencidas == 0:
        return False

    interes = calcular_interes_simple(loan.monto_principal, loan.porcentaje_interes)
    deuda_total_usd = Decimal(str(loan.monto_principal)) + (interes * Decimal(str(cuotas_totales)))
    monto_por_cuota = deuda_total_usd / Decimal(str(cuotas_totales))
    deuda_exigible = Decimal(str(cuotas_vencidas)) * monto_por_cuota
    pagos_realizados = sum(Decimal(str(t.monto)) for t in loan.transactions if t.tipo == 'pago_cuota')

    if pagos_realizados >= (deuda_exigible - Decimal("1.0")):
        # Caso especial: préstamo vencido por completo
        if loan.fecha_vencimiento and now_date > loan.fecha_vencimiento:
            if pagos_realizados < (deuda_total_usd - Decimal("1.0")):
                return True
        return False
    return True

def obtener_deuda_pendiente(loan: Loan, en_bolivares: bool = False, tasa_actual: float = 1.0) -> float:
    # Deuda total = (Principal USD + Interés USD) - Pagos realizados USD
    interes = calcular_interes_simple(loan.monto_principal, loan.porcentaje_interes)
    deuda_total_usd = Decimal(str(loan.monto_principal)) + (interes * Decimal(str(loan.cuotas_totales or 1)))
    
    pagos_usd = sum(Decimal(str(t.monto)) for t in loan.transactions if t.tipo == 'pago_cuota')
    deuda_pendiente_usd = max(Decimal("0.0"), deuda_total_usd - pagos_usd)
    
    if en_bolivares and loan.moneda == "VES":
        return float(deuda_pendiente_usd) * tasa_actual
    return float(deuda_pendiente_usd)

def get_financial_stats(db: Session, user_id: int):
    """Calcula estadísticas financieras comunes para el dashboard y reportes."""
    # Préstamos activos
    active_loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client))\
        .join(Client).filter(Client.user_id == user_id, Loan.estatus == 'activo').all()
    
    total_activos = len(active_loans)
    prestamos_vencidos = sum(1 for l in active_loans if chequear_cuota_vencida(l))
    
    capital_prestado_usd = sum(
        max(Decimal("0.0"), Decimal(str(l.monto_principal)) - sum(Decimal(str(t.monto)) for t in l.transactions if t.tipo == 'pago_cuota')) 
        for l in active_loans
    )

    ganancias_proyectadas = sum(
        calcular_interes_simple(l.monto_principal, l.porcentaje_interes) * Decimal(str(l.cuotas_totales or 1))
        for l in active_loans
    )
    
    ganancias_reales = Decimal("0.0")
    all_user_loans = db.query(Loan).join(Client).filter(Client.user_id == user_id).all()
    for l in all_user_loans:
        pagos_usd = sum(Decimal(str(t.monto)) for t in l.transactions if t.tipo == 'pago_cuota')
        if pagos_usd > Decimal(str(l.monto_principal)):
            ganancias_reales += (pagos_usd - Decimal(str(l.monto_principal)))
            
    # Datos para gráfico (últimos 7 meses) - Usando datetime para el filtro pero mostrando labels
    hoy = datetime.now(timezone.utc)
    meses_labels = []
    meses_valores = []
    for i in range(6, -1, -1):
        # Moverse i meses atrás
        target_date = hoy - relativedelta(months=i)
        start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + relativedelta(months=1))
        
        meses_nombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
        meses_labels.append(meses_nombres[start.month - 1])

        sum_mes = db.query(func.sum(Transaction.monto)).join(Loan).join(Client).filter(
            Client.user_id == user_id,
            Transaction.tipo == 'pago_cuota',
            Transaction.fecha >= start,
            Transaction.fecha < end
        ).scalar() or Decimal("0.0")
        meses_valores.append(Decimal(str(sum_mes)))

    return {
        "active_loans": active_loans,
        "total_activos": total_activos,
        "prestamos_vencidos": prestamos_vencidos,
        "capital_prestado_usd": capital_prestado_usd,
        "ganancias_proyectadas": ganancias_proyectadas,
        "ganancias_reales": ganancias_reales,
        "meses_labels": meses_labels,
        "meses_valores": meses_valores
    }


