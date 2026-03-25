from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
import json

from database import get_db, User, Notification, PushSubscription
from core.shared import templates, require_user, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS
from pywebpush import webpush, WebPushException

router = APIRouter()

@router.get("/notifications", response_class=HTMLResponse)
def notifications_view(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.fecha.desc()).all()
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="notificaciones.html", context={
        "notifications": notifs, 
        "unread_count": unread_count, 
        "user": current_user
    })

@router.post("/notifications/read-all")
def notifications_read_all(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"leida": True})
    db.commit()
    return RedirectResponse(url="/notifications", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/push/subscribe")
async def push_subscribe(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    try:
        data = await request.json()
        existing = db.query(PushSubscription).filter(PushSubscription.endpoint == data["endpoint"]).first()
        if existing:
            return {"status": "ok", "message": "Ya suscrito"}
        
        new_sub = PushSubscription(
            user_id=current_user.id,
            endpoint=data["endpoint"],
            auth_key=data["keys"]["auth"],
            p256dh_key=data["keys"]["p256dh"],
            browser=request.headers.get("user-agent", "unknown")
        )
        db.add(new_sub)
        db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/push/test")
def push_test(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user or not current_user.push_subscriptions:
        return {"status": "error", "message": "No hay suscripciones activas en este dispositivo."}
    
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return {"status": "error", "message": "VAPID Keys no configuradas en el servidor."}

    sent_count: int = 0
    expired_count: int = 0
    for sub in current_user.push_subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"auth": sub.auth_key, "p256dh": sub.p256dh_key}
                },
                data=json.dumps({
                    "title": "Melo Finance 🚀",
                    "body": "¡Notificaciones push activadas correctamente!",
                    "url": "/dashboard"
                }),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            sent_count += 1
        except WebPushException as ex:
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                expired_count += 1
    
    db.commit()
    return {"status": "ok", "sent": sent_count, "deleted_expired": expired_count}
