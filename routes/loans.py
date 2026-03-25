from fastapi import APIRouter, Depends, Request, Form, HTTPException, status, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload
from decimal import Decimal
import os
import shutil
from datetime import datetime
from typing import List

from database import get_db, User, Client, Loan, Transaction, LoanAttachment, Notification
import schemas
import utils
from core.shared import templates, require_user, generate_csrf_token, verify_csrf_token, crear_alerta, \
    UPLOAD_DIR, _IS_PRODUCTION, s3_client, AWS_STORAGE_BUCKET_NAME, AWS_REGION, AWS_S3_ENDPOINT_URL
from scraper import update_bcv_rate_if_needed

router = APIRouter(prefix="/loans")

@router.get("", response_class=HTMLResponse)
def loans_hub(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    active_loans = db.query(Loan).options(joinedload(Loan.transactions), joinedload(Loan.client))\
        .join(Client).filter(Client.user_id == current_user.id, Loan.estatus == 'activo').all()
    
    total_prestado = sum(utils.obtener_deuda_pendiente(l) for l in active_loans)
    vencidos = sum(1 for l in active_loans if utils.chequear_cuota_vencida(l))
    
    loan_list = []
    for l in active_loans:
        monto_display = l.monto_principal
        deuda_display = utils.obtener_deuda_pendiente(l)
        
        if l.moneda == 'VES':
            monto_display = float(l.monto_principal) * float(tasa_actual)
            deuda_display = float(deuda_display) * float(tasa_actual)

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
    return templates.TemplateResponse(request=request, name="centro-de-prestamos.html", context={
        "loans": loan_list,
        "total_prestado": total_prestado,
        "vencidos": vencidos,
        "total_activos": len(active_loans),
        "tasa_actual": tasa_actual,
        "unread_count": unread_count
    })

@router.get("/new", response_class=HTMLResponse)
def new_loan_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    clients = db.query(Client).filter(Client.user_id == current_user.id).all()
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="formulario-de-prestamo.html", context={
        "tasa_actual": tasa_actual, 
        "clients": clients, 
        "unread_count": unread_count, 
        "user": current_user, 
        "csrf_token": csrf_token
    })

@router.post("/new")
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
    
    try:
        user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
        
        if moneda == "USD":
            if user.capital_total_usd < monto_principal:
                return RedirectResponse(url="/loans/new?error-msg=Capital+insuficiente+en+USD", status_code=status.HTTP_303_SEE_OTHER)
            user.capital_total_usd -= monto_principal
        else:
            if user.capital_total_ves < monto_principal:
                return RedirectResponse(url="/loans/new?error-msg=Capital+insuficiente+en+VES", status_code=status.HTTP_303_SEE_OTHER)
            user.capital_total_ves -= monto_principal

        start_date = datetime.strptime(fecha_inicio, "%Y-%m-%d").date() if fecha_inicio else utils.get_now_vet().date()
        end_date = datetime.strptime(fecha_fin, "%Y-%m-%d").date() if fecha_fin else None

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
        for upload_file in archivos:
            if upload_file.filename:
                ext = os.path.splitext(upload_file.filename)[1].lower()
                if ext not in ALLOWED_EXTENSIONS: continue

                unique_filename = f"loan_{new_loan.id}_{int(datetime.now().timestamp())}{ext}"
                file_url = ""

                if s3_client:
                    try:
                        s_key = f"uploads/{unique_filename}"
                        s3_client.upload_fileobj(upload_file.file, AWS_STORAGE_BUCKET_NAME, s_key, ExtraArgs={"ContentType": upload_file.content_type})
                        file_url = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/{s_key}" if AWS_S3_ENDPOINT_URL else f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s_key}"
                    except Exception as e:
                        print(f"S3_ERROR: {e}")
                        if _IS_PRODUCTION: 
                            db.rollback()
                            return RedirectResponse(url="/loans/new?error-msg=Error+al+subir+archivos", status_code=status.HTTP_303_SEE_OTHER)
                
                if not file_url:
                    f_path = os.path.join(UPLOAD_DIR, unique_filename)
                    with open(f_path, "wb") as buffer:
                        upload_file.file.seek(0)
                        shutil.copyfileobj(upload_file.file, buffer)
                    file_url = f"/static/uploads/{unique_filename}"

                upload_file.file.seek(0, 2)
                f_size = upload_file.file.tell()
                db.add(LoanAttachment(loan_id=new_loan.id, file_path=file_url, file_size=f_size))

        monto_usd_egreso = monto_principal if moneda == "USD" else monto_base_db
        db.add(Transaction(
            loan_id=new_loan.id,
            tipo='egreso_capital',
            monto=monto_usd_egreso,
            monto_real=monto_principal,
            moneda=moneda
        ))

        db.commit()
        crear_alerta(db, current_user.id, "Préstamo Otorgado", f"Préstamo registrado para {client.nombre}.", "success")
        return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

    except Exception as e:
        db.rollback()
        print(f"❌ FALLO CRÍTICO EN PRÉSTAMO: {str(e)}")
        return RedirectResponse(url="/loans/new?error-msg=Fallo+técnico+al+procesar+el+préstamo", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/{loan_id}", response_class=HTMLResponse)
def loan_detail(request: Request, loan_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    loan = db.query(Loan).join(Client).filter(Loan.id == loan_id, Client.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    
    tasa_actual = update_bcv_rate_if_needed(db)
    deuda_pendiente = utils.obtener_deuda_pendiente(loan)
    
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="detalle-prestamo.html", context={
        "loan": loan,
        "tasa_actual": tasa_actual,
        "deuda_pendiente": deuda_pendiente,
        "unread_count": unread_count,
        "user": current_user
    })

@router.post("/{loan_id}/cancel")
def cancel_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    loan = db.query(Loan).join(Client).filter(Loan.id == loan_id, Client.user_id == current_user.id).first()
    if not loan or loan.estatus != 'activo':
        raise HTTPException(status_code=404, detail="Préstamo no encontrado o ya no está activo")
    
    pagos_usd = sum(t.monto for t in loan.transactions if t.tipo == 'pago_cuota')
    capital_por_recuperar = max(0.0, float(loan.monto_principal) - float(pagos_usd))
    
    if loan.moneda == "USD":
        db.query(User).filter(User.id == current_user.id).update({User.capital_total_usd: User.capital_total_usd + Decimal(str(capital_por_recuperar))})
    else:
        tasa = update_bcv_rate_if_needed(db)
        db.query(User).filter(User.id == current_user.id).update({User.capital_total_ves: User.capital_total_ves + (Decimal(str(capital_por_recuperar)) * tasa)})
    
    loan.estatus = 'anulado'
    
    reintegro_trans = Transaction(
        loan_id=loan.id,
        tipo='ingreso_extra',
        monto=capital_por_recuperar,
        monto_real=capital_por_recuperar if loan.moneda == "USD" else (capital_por_recuperar * float(update_bcv_rate_if_needed(db))),
        moneda=loan.moneda
    )
    db.add(reintegro_trans)
    db.commit()

    crear_alerta(db, current_user.id, "Préstamo Anulado", f"El préstamo de {loan.client.nombre} fue anulado. Capital devuelto al fondo.", "alert")
    return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/{loan_id}/pay")
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
    
    deuda_pendiente = utils.obtener_deuda_pendiente(loan, en_bolivares=(moneda_pago == "VES"), tasa_actual=float(tasa))
    if float(monto) > (float(deuda_pendiente) + 0.1):
        return RedirectResponse(url=f"/loans?error=pago_excesivo&max={deuda_pendiente}", status_code=status.HTTP_303_SEE_OTHER)
    
    monto_final_usd = monto
    if moneda_pago == "VES":
        monto_final_usd = monto / tasa

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
    
    deuda = utils.obtener_deuda_pendiente(loan, en_bolivares=True, tasa_actual=float(tasa))
    
    if deuda <= 0.5:
        loan.estatus = 'pagado'
        crear_alerta(db, current_user.id, "Préstamo Liquidado", f"El préstamo de {loan.client.nombre} ha sido pagado totalmente.", "success")
    else:
        crear_alerta(db, current_user.id, "Abono Recibido", f"Se registró un pago de {monto} {moneda_pago} de {loan.client.nombre}.", "info")
        
    db.commit()
    return RedirectResponse(url="/loans", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/", response_model=schemas.LoanResponse)
def create_loan_api(loan: schemas.LoanCreate, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    from sqlalchemy.exc import SQLAlchemyError
    client = db.query(Client).filter(Client.id == loan.client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=403, detail="No autorizado para este cliente")

    tasa = update_bcv_rate_if_needed(db)
    try:
        with db.begin():
            db_loan = Loan(
                **loan.model_dump(),
                tasa_bcv_snapshot=tasa,
                estatus='activo'
            )
            db.add(db_loan)
        db.refresh(db_loan)
        return db_loan
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear el préstamo")
