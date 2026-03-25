from fastapi import APIRouter, Depends, Request, Form, HTTPException, status, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
import os
import json
import base64

from database import get_db, User, SupportRequest, get_now_vet
import schemas
from core.shared import templates, signer, generate_csrf_token, verify_csrf_token, \
    RP_ID, RP_NAME, ORIGIN, require_user, \
    check_rate_limit, hash_password, verify_password, needs_rehash

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    PublicKeyCredentialDescriptor,
)

router = APIRouter()

@router.get("/login", response_class=HTMLResponse)
def login_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="login.html", context={"csrf_token": csrf_token})

@router.post("/login")
def login_post(
    request: Request,
    email: str = Form(""), 
    password: str = Form(""), 
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    if not check_rate_limit(request.client.host):
        return RedirectResponse(url="/login?error=too_many_requests", status_code=status.HTTP_303_SEE_OTHER)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)
    
    if not user.is_active:
        return RedirectResponse(url="/login?error=account_blocked", status_code=status.HTTP_303_SEE_OTHER)
    
    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(password)
        db.commit()
    
    token = signer.dumps(user.id)
    if user.is_admin:
        response = RedirectResponse(url="/admin/soporte", status_code=status.HTTP_303_SEE_OTHER)
    else:
        response = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    
    is_prod = os.environ.get("RAILWAY_ENVIRONMENT") == "production"
    response.set_cookie(
        key="session_token", 
        value=token, 
        path="/",
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=60 * 60 * 12
    )
    return response

@router.get("/signup", response_class=HTMLResponse)
def signup_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="sign-up.html", context={"csrf_token": csrf_token})

@router.post("/signup")
def signup_post(
    request: Request,
    nombre: str = Form(""), 
    apellido: str = Form(""), 
    email: str = Form(""), 
    password: str = Form(""), 
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    if not check_rate_limit(request.client.host):
        return RedirectResponse(url="/signup?error=too_many_requests", status_code=status.HTTP_303_SEE_OTHER)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return RedirectResponse(url="/signup?error=exists", status_code=status.HTTP_303_SEE_OTHER)
    user = User(
        email=email, 
        nombre=nombre, 
        apellido=apellido, 
        hashed_password=hash_password(password),
        capital_total_usd=0.0,
        capital_total_ves=0.0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = signer.dumps(user.id)
    response = RedirectResponse(url="/settings/capital", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="session_token", value=token, path="/",
        httponly=True, samesite="lax",
        max_age=60 * 60 * 24 * 30
    )
    return response

@router.get("/logout")
def logout():
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("session_token")
    return response

@router.get("/forgot-password", response_class=HTMLResponse)
def forgot_password_get(request: Request):
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="forgot-password.html", context={"csrf_token": csrf_token})

@router.post("/forgot-password")
def forgot_password_post(
    request: Request,
    email: str = Form(""),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        return templates.TemplateResponse(request=request, name="forgot-password.html", context={
            "error": "CSRF Token inválido",
            "csrf_token": generate_csrf_token(request)
        })
    
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = signer.dumps(user.email, salt='password-reset')
        reset_link = f"{request.base_url}reset-password/{token}"
        new_support = SupportRequest(email=email, token=token)
        db.add(new_support)
        db.commit()
        print(f"PASSWORD RESET LINK for {email}: {reset_link}")
        
    return templates.TemplateResponse(request=request, name="forgot-password.html", context={
        "success": True,
        "csrf_token": generate_csrf_token(request)
    })

@router.get("/reset-password/{token}", response_class=HTMLResponse)
def reset_password_get(request: Request, token: str):
    try:
        email = signer.loads(token, salt='password-reset', max_age=3600)
    except:
        return RedirectResponse(url="/forgot-password?error=token_invalid", status_code=status.HTTP_303_SEE_OTHER)
    
    csrf_token = generate_csrf_token(request)
    return templates.TemplateResponse(request=request, name="reset-password.html", context={
        "token": token, 
        "csrf_token": csrf_token
    })

@router.post("/reset-password/{token}")
def reset_password_post(
    request: Request,
    token: str,
    password: str = Form(...),
    confirm_password: str = Form(...),
    csrf_token: str = Form(""),
    db: Session = Depends(get_db)
):
    if not verify_csrf_token(csrf_token, request):
        raise HTTPException(status_code=403, detail="CSRF Token inválido")
    
    try:
        email = signer.loads(token, salt='password-reset', max_age=3600)
    except:
        return RedirectResponse(url="/forgot-password?error=token_expired", status_code=status.HTTP_303_SEE_OTHER)
    
    if password != confirm_password:
        return templates.TemplateResponse(request=request, name="reset-password.html", context={
            "token": token, 
            "error": "Las contraseñas no coinciden",
            "csrf_token": generate_csrf_token(request)
        })
    
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.hashed_password = hash_password(password)
        support_req = db.query(SupportRequest).filter(SupportRequest.token == token).first()
        if support_req:
            support_req.atendida = True
        db.commit()
    
    return RedirectResponse(url="/login?msg=password_reset_success", status_code=status.HTTP_303_SEE_OTHER)

# --- Endpoints de Biometría (WebAuthn) ---

@router.get("/auth/webauthn/register/options")
def webauthn_register_options(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    if not current_user.webauthn_id:
        current_user.webauthn_id = os.urandom(16).hex()
        db.commit()

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=bytes.fromhex(current_user.webauthn_id),
        user_name=current_user.email,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
    )
    
    json_options = options_to_json(options)
    res = Response(content=json_options, media_type="application/json")
    res.set_cookie("reg_options", signer.dumps(json_options), max_age=300, httponly=True, secure=True if RP_ID != "localhost" else False)
    return res

@router.post("/auth/webauthn/register/verify")
async def webauthn_register_verify(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    from database import WebAuthnCredential
    data = await request.json()
    options_cookie = request.cookies.get("reg_options")
    if not options_cookie:
        raise HTTPException(status_code=400, detail="Sesión de registro expirada")
    
    try:
        options_json = json.loads(signer.loads(options_cookie))
        registration_verification = verify_registration_response(
            credential=data,
            expected_challenge=base64.urlsafe_b64decode(options_json["challenge"] + "=="),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
        )
        
        new_cred = WebAuthnCredential(
            user_id=current_user.id,
            credential_id=registration_verification.credential_id.hex(),
            public_key=base64.b64encode(registration_verification.credential_public_key).decode('utf-8'),
            sign_count=registration_verification.sign_count,
        )
        db.add(new_cred)
        db.commit()
        return {"status": "ok", "message": "Biometría registrada correctamente"}
    except Exception as e:
        print(f"WEBAUTHN REG ERROR: {e}")
        raise HTTPException(status_code=400, detail="Error al verificar biometría")

@router.get("/auth/webauthn/login/options")
def webauthn_login_options(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == username).first()
    if not user or not user.credentials:
        raise HTTPException(status_code=404, detail="Usuario no tiene biometría configurada")

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=bytes.fromhex(c.credential_id), type="public-key")
            for c in user.credentials
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    
    json_options = options_to_json(options)
    res = Response(content=json_options, media_type="application/json")
    res.set_cookie("auth_options", signer.dumps(json_options), max_age=300, httponly=True, secure=True if RP_ID != "localhost" else False)
    res.set_cookie("auth_user", str(user.id), max_age=300, httponly=True)
    return res

@router.post("/auth/webauthn/login/verify")
async def webauthn_login_verify(request: Request, db: Session = Depends(get_db)):
    from database import WebAuthnCredential
    data = await request.json()
    options_cookie = request.cookies.get("auth_options")
    user_id_cookie = request.cookies.get("auth_user")
    
    if not options_cookie or not user_id_cookie:
        raise HTTPException(status_code=400, detail="Sesión biométrica expirada")
    
    user = db.query(User).filter(User.id == int(user_id_cookie)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    try:
        options_json = json.loads(signer.loads(options_cookie))
        cred_id_raw = data["rawId"]
        cred_id_bytes = base64.urlsafe_b64decode(cred_id_raw + "==")
        cred_id_hex = cred_id_bytes.hex()
        
        db_cred = db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == cred_id_hex).first()
        if not db_cred:
             raise HTTPException(status_code=404, detail="Credencial no reconocida")

        authentication_verification = verify_authentication_response(
            credential=data,
            expected_challenge=base64.urlsafe_b64decode(options_json["challenge"] + "=="),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            credential_public_key=base64.b64decode(db_cred.public_key),
            credential_current_sign_count=db_cred.sign_count,
        )
        
        db_cred.sign_count = authentication_verification.new_sign_count
        user.last_login = get_now_vet()
        db.commit()
        
        token = signer.dumps(user.id)
        res = Response(content=json.dumps({"status": "ok"}), media_type="application/json")
        res.set_cookie("session_token", token, max_age=60 * 60 * 24 * 30, httponly=True, secure=True if RP_ID != "localhost" else False)
        return res
    except Exception as e:
        print(f"WEBAUTHN LOGIN ERROR: {e}")
        raise HTTPException(status_code=400, detail="Firma biométrica inválida")
