from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, User, Client, Loan, LoanAttachment, SupportRequest
from core.shared import templates, require_user, log_admin_action

router = APIRouter(prefix="/admin")

@router.get("/soporte", response_class=HTMLResponse)
def support_admin_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.is_admin:
        return RedirectResponse(url="/dashboard?error=admin_only", status_code=status.HTTP_303_SEE_OTHER)
    
    recovery_requests = db.query(SupportRequest).order_by(SupportRequest.fecha.desc()).limit(20).all()
    users = db.query(User).order_by(User.created_at.desc()).all()
    user_ids = [u.id for u in users]

    client_counts = dict(db.query(Client.user_id, func.count(Client.id)).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())
    loan_counts = dict(db.query(Client.user_id, func.count(Loan.id)).join(Loan, Loan.client_id == Client.id).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())
    storage_bytes = dict(db.query(Client.user_id, func.coalesce(func.sum(LoanAttachment.file_size), 0)).join(Loan, Loan.client_id == Client.id).join(LoanAttachment, LoanAttachment.loan_id == Loan.id).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())

    users_data = []
    for u in users:
        uid = u.id
        storage_mb = round(storage_bytes.get(uid, 0) / (1024 * 1024), 2)
        users_data.append({
            "id": uid,
            "email": u.email,
            "nombre": f"{u.nombre} {u.apellido}",
            "fecha": u.created_at,
            "is_active": u.is_active,
            "storage": storage_mb,
            "clients": client_counts.get(uid, 0),
            "loans": loan_counts.get(uid, 0)
        })

    return templates.TemplateResponse(request=request, name="admin-soporte.html", context={
        "requests": recovery_requests,
        "users": users_data,
        "user": current_user
    })

@router.post("/toggle-user/{u_id}")
def toggle_user(request: Request, u_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    user = db.query(User).filter(User.id == u_id).first()
    if not user:
        return templates.TemplateResponse(request=request, name="fragments/feedback.html", context={"error": "Usuario no encontrado"})
    
    user.is_active = not user.is_active
    db.commit()
    log_admin_action(db, current_user.id, user.id, "toggle_active", f"Nuevo estado: {user.is_active}")
    
    # Recalcular datos para la tabla
    users = db.query(User).order_by(User.created_at.desc()).all()
    user_ids = [u.id for u in users]
    client_counts = dict(db.query(Client.user_id, func.count(Client.id)).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())
    loan_counts = dict(db.query(Client.user_id, func.count(Loan.id)).join(Loan, Loan.client_id == Client.id).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())
    storage_bytes = dict(db.query(Client.user_id, func.coalesce(func.sum(LoanAttachment.file_size), 0)).join(Loan, Loan.client_id == Client.id).join(LoanAttachment, LoanAttachment.loan_id == Loan.id).filter(Client.user_id.in_(user_ids)).group_by(Client.user_id).all())
    
    users_data = []
    for u in users:
        uid = u.id
        storage_mb = round(storage_bytes.get(uid, 0) / (1024 * 1024), 2)
        users_data.append({
            "id": uid,
            "email": u.email,
            "nombre": f"{u.nombre} {u.apellido}",
            "fecha": u.created_at,
            "is_active": u.is_active,
            "storage": storage_mb,
            "clients": client_counts.get(uid, 0),
            "loans": loan_counts.get(uid, 0)
        })
        
    response = templates.TemplateResponse(request=request, name="fragments/users-table.html", context={"users": users_data})
    response.headers["HX-Trigger"] = "users-updated"
    return response
