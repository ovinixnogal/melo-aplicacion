from fastapi import APIRouter, Depends, Request, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from decimal import Decimal

from database import get_db, User, CapitalTransaction, Notification
from core.shared import templates, require_user, generate_csrf_token, verify_csrf_token, crear_alerta, \
    VAPID_PUBLIC_KEY, hash_password
from scraper import update_bcv_rate_if_needed

router = APIRouter(prefix="/settings")

@router.get("", response_class=HTMLResponse)
def settings_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    return RedirectResponse(url="/settings/profile", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/capital", response_class=HTMLResponse)
def capital_settings_get(request: Request, current_user: User = Depends(require_user)):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="capital_settings.html", context={
        "user": current_user, 
        "csrf_token": csrf_token
    })

@router.post("/capital")
def capital_settings_post(
    request: Request,
    capital_usd: Decimal = Form(None), 
    capital_ves: Decimal = Form(None), 
    ajuste_usd: Decimal = Form(Decimal("0.0")),
    ajuste_ves: Decimal = Form(Decimal("0.0")),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_user)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    user = current_user
    changes_made = False
    
    try:
        if ajuste_usd != 0:
            user.capital_total_usd += ajuste_usd
            ct = CapitalTransaction(
                user_id=user.id, 
                tipo="inversion" if ajuste_usd > 0 else "retiro", 
                monto=abs(ajuste_usd), 
                moneda="USD"
            )
            db.add(ct)
            changes_made = True

        if ajuste_ves != 0:
            user.capital_total_ves += ajuste_ves
            ct = CapitalTransaction(
                user_id=user.id, 
                tipo="inversion" if ajuste_ves > 0 else "retiro", 
                monto=abs(ajuste_ves), 
                moneda="VES"
            )
            db.add(ct)
            changes_made = True

        if capital_usd is not None and ajuste_usd == 0:
            dif_usd = capital_usd - user.capital_total_usd
            if dif_usd != 0:
                ct = CapitalTransaction(user_id=user.id, tipo="ajuste_directo", monto=abs(dif_usd), moneda="USD")
                db.add(ct)
                user.capital_total_usd = capital_usd
                changes_made = True

        if capital_ves is not None and ajuste_ves == 0:
            dif_ves = capital_ves - user.capital_total_ves
            if dif_ves != 0:
                ct = CapitalTransaction(user_id=user.id, tipo="ajuste_directo", monto=abs(dif_ves), moneda="VES")
                db.add(ct)
                user.capital_total_ves = capital_ves
                changes_made = True

        if changes_made:
            db.commit()
            crear_alerta(db, user.id, "Capital Actualizado", "Tus ajustes de capital han sido guardados.", "success")
        
    except Exception as e:
        db.rollback()
        return RedirectResponse(url="/settings/capital?error=transaccion_fallida", status_code=status.HTTP_303_SEE_OTHER)

    return RedirectResponse(url="/dashboard?msg=Capital+actualizado+exitosamente", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/profile", response_class=HTMLResponse)
def profile_settings_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    tasa_actual = update_bcv_rate_if_needed(db)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="perfil-usuario.html", context={
        "user": current_user, 
        "unread_count": unread_count,
        "tasa_actual": tasa_actual,
        "vapid_public_key": VAPID_PUBLIC_KEY
    })

@router.post("/profile")
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
