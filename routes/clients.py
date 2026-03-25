from fastapi import APIRouter, Depends, Request, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db, User, Client, Loan, Notification
import schemas
import utils
from core.shared import templates, require_user, generate_csrf_token, verify_csrf_token, crear_alerta, \
    get_pagination_params, get_pagination_metadata

router = APIRouter(prefix="/clients")

@router.get("", response_class=HTMLResponse)
def clients_list(request: Request, page: int = 1, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    offset, limit = get_pagination_params(page)
    total_count = db.query(Client).filter(Client.user_id == current_user.id).count()
    clients = db.query(Client).options(joinedload(Client.loans).joinedload(Loan.transactions))\
        .filter(Client.user_id == current_user.id).order_by(Client.nombre).offset(offset).limit(limit).all()
    
    client_data = []
    for c in clients:
        deuda = sum(utils.obtener_deuda_pendiente(l) for l in c.loans if l.estatus == 'activo')
        client_data.append({
            "id": c.id,
            "nombre": c.nombre,
            "deuda": deuda,
            "tiene_atraso": any(utils.chequear_cuota_vencida(l) for l in c.loans if l.estatus == 'activo')
        })
    
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    pagination = get_pagination_metadata(total_count, page, limit)
    
    return templates.TemplateResponse(request=request, name="directorio-de-clientes.html", context={
        "clients": client_data, 
        "unread_count": unread_count, 
        "user": current_user,
        "pagination": pagination
    })

@router.get("/new", response_class=HTMLResponse)
def new_client_get(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="nuevo-cliente.html", context={
        "unread_count": unread_count, 
        "csrf_token": csrf_token, 
        "user": current_user
    })

@router.post("/new")
def new_client_post(
    request: Request,
    nombre: str = Form(...),
    cedula: str = Form(None),
    telefono: str = Form(None),
    direccion: str = Form(None),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    db_client = Client(
        nombre=nombre, 
        cedula=cedula or "", 
        telefono=telefono or "", 
        direccion=direccion or "", 
        user_id=current_user.id
    )
    db.add(db_client)
    db.commit()
    return RedirectResponse(url="/clients", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/{client_id}", response_class=HTMLResponse)
def client_detail(request: Request, client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).options(joinedload(Client.loans).joinedload(Loan.transactions))\
        .filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    active_loans = []
    for l in client.loans:
        if l.estatus == 'activo':
            deuda = utils.obtener_deuda_pendiente(l)
            active_loans.append({
                "id": l.id,
                "monto_principal": l.monto_original if l.monto_original else l.monto_principal,
                "moneda": l.moneda,
                "porcentaje_interes": l.porcentaje_interes,
                "fecha_creacion": l.fecha_creacion,
                "deuda_pendiente": deuda
            })
            
    total_deuda = sum(l['deuda_pendiente'] for l in active_loans)
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="detalle-cliente.html", context={
        "client": client,
        "active_loans": active_loans,
        "total_deuda": total_deuda,
        "unread_count": unread_count,
        "user": current_user
    })

@router.get("/{client_id}/edit", response_class=HTMLResponse)
def edit_client_get(request: Request, client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.leida == False).count()
    return templates.TemplateResponse(request=request, name="editar-cliente.html", context={
        "client": client, 
        "unread_count": unread_count, 
        "user": current_user
    })

@router.post("/{client_id}/edit")
def edit_client_post(
    client_id: int,
    nombre: str = Form(...),
    cedula: str = Form(None),
    telefono: str = Form(None),
    direccion: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    client.nombre = nombre
    client.cedula = cedula or ""
    client.telefono = telefono or ""
    client.direccion = direccion or ""
    db.commit()
    
    crear_alerta(db, current_user.id, "Cliente Actualizado", f"Los datos de {nombre} han sido modificados.", "info")
    return RedirectResponse(url=f"/clients/{client_id}", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/{client_id}/delete")
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    db.delete(client)
    db.commit()
    
    crear_alerta(db, current_user.id, "Cliente Eliminado", f"Se ha borrado el registro del cliente.", "alert")
    return RedirectResponse(url="/clients", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/", response_model=schemas.ClientResponse)
def create_client_api(
    request: Request,
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token or not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    nombre = client.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre del cliente es requerido")
    
    db_client = Client(
        nombre=nombre,
        cedula=client.cedula.strip() if client.cedula else "",
        telefono=client.telefono.strip() if client.telefono else "",
        direccion=client.direccion.strip() if client.direccion else "",
        user_id=current_user.id
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client
