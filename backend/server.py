"""DigiWallet V2 - FastAPI Backend"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import secrets
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
import httpx
import json as _json
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption, PublicFormat
import base64
from pywebpush import webpush, WebPushException
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, status, Query
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, field_validator

# -------------------- Config --------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_MOBILE = os.environ.get("ADMIN_MOBILE", "9999999999")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Super Admin")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

JWT_ALG = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 1 day
REFRESH_TTL_DAYS = 7

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("digiwallet")

# -------------------- DB --------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# -------------------- App --------------------
app = FastAPI(title="DigiWallet V2 API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Helpers --------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, role: str, token_type: str = "access") -> str:
    if token_type == "access":
        exp = now_utc() + timedelta(minutes=ACCESS_TTL_MIN)
    else:
        exp = now_utc() + timedelta(days=REFRESH_TTL_DAYS)
    payload = {"sub": user_id, "role": role, "exp": exp, "type": token_type, "jti": uuid.uuid4().hex}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def gen_api_key() -> str:
    return "dwk_" + secrets.token_urlsafe(32)

def gen_id() -> str:
    return uuid.uuid4().hex

def fmt_when(dt: Optional[datetime] = None) -> str:
    """Short, human-friendly local time stamp for notifications."""
    d = dt or now_utc()
    return d.strftime("%b %d, %I:%M %p")

def gen_ref_id() -> str:
    """Generate user-friendly reference like digiwallet280785055101"""
    return "digiwallet" + str(secrets.randbelow(900000000000) + 100000000000)

# -------------------- Web Push (VAPID) --------------------
VAPID_KEY_FILE = ROOT_DIR / "vapid_private.pem"
VAPID_CONTACT = "mailto:admin@digiwallet.local"

def _load_or_create_vapid():
    if VAPID_KEY_FILE.exists():
        with open(VAPID_KEY_FILE, "rb") as f:
            priv = serialization.load_pem_private_key(f.read(), password=None)
    else:
        priv = ec.generate_private_key(ec.SECP256R1())
        with open(VAPID_KEY_FILE, "wb") as f:
            f.write(priv.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    pub_bytes = priv.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode("ascii")
    priv_pem = priv.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode("ascii")
    return priv_pem, pub_b64

VAPID_PRIVATE_PEM, VAPID_PUBLIC_KEY_B64 = _load_or_create_vapid()

async def send_web_push(user_id: str, title: str, body: str, url: str = "/app", tag: Optional[str] = None):
    """Send web push to ALL active subscriptions of a user. Best-effort."""
    subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(20)
    if not subs:
        return
    payload = _json.dumps({"title": title, "body": body, "url": url, "tag": tag or "digiwallet"})
    dead_ids = []
    for s in subs:
        sub_info = s.get("subscription")
        if not sub_info:
            continue
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_PEM,
                vapid_claims={"sub": VAPID_CONTACT},
            )
        except WebPushException as e:
            sc = getattr(getattr(e, "response", None), "status_code", None)
            if sc in (404, 410):
                dead_ids.append(s["_id"])
        except Exception:
            pass
    if dead_ids:
        await db.push_subscriptions.delete_many({"_id": {"$in": dead_ids}})

MOBILE_RE = re.compile(r"^[0-9]{10,15}$")

def clean_doc(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    d.pop("password_hash", None)
    return d

async def telegram_send(text: str, user_chat: Optional[str] = None):
    """Best-effort telegram alert send. Sends to admin chat (if enabled) and optionally to a user's personal chat."""
    settings = await db.settings.find_one({"_id": "system"}) or {}
    token = settings.get("telegram_bot_token") or TELEGRAM_BOT_TOKEN
    admin_chat = settings.get("telegram_chat_id") or TELEGRAM_CHAT_ID
    enabled = settings.get("telegram_enabled", False)
    if not (token and enabled):
        # If no global token/enabled, still try to send to user chat IF token exists
        if not token:
            return
    chats = []
    if enabled and admin_chat:
        chats.append(admin_chat)
    if user_chat and user_chat.strip():
        chats.append(user_chat.strip())
    if not chats:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as ac:
            for chat in chats:
                try:
                    await ac.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={"chat_id": chat, "text": text, "parse_mode": "HTML"},
                    )
                except Exception:
                    pass
    except Exception as e:
        log.warning(f"Telegram send failed: {e}")

# -------------------- Auth Dependency --------------------
bearer = HTTPBearer(auto_error=False)

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return clean_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_active_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Account banned")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    return user

# -------------------- Schemas --------------------
class RegisterReq(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    mobile_number: str
    password: str = Field(min_length=6, max_length=72)
    confirm_password: str

    @field_validator("mobile_number")
    @classmethod
    def _m(cls, v: str) -> str:
        v = v.strip()
        if not MOBILE_RE.match(v):
            raise ValueError("Mobile must be 10-15 digits")
        return v

class LoginReq(BaseModel):
    mobile_number: str
    password: str

class ChangePwReq(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=72)

class PaymentMethodReq(BaseModel):
    type: Literal["upi", "bank"]
    upi_id: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    bank_name: Optional[str] = None

class WithdrawalReq(BaseModel):
    amount: float = Field(gt=0)
    payment_method_id: str

class CreditApiReq(BaseModel):
    api_key: str
    user_id: str
    amount: float
    txn_id: str
    description: Optional[str] = None

# Admin
class AdminCreditReq(BaseModel):
    user_id: str
    amount: float = Field(gt=0)
    note: Optional[str] = None

class AdminDebitReq(BaseModel):
    user_id: str
    amount: float = Field(gt=0)
    note: Optional[str] = None

class AdminAdjustReq(BaseModel):
    user_id: str
    new_balance: float = Field(ge=0)
    note: Optional[str] = None

class AdminWithdrawalActionReq(BaseModel):
    note: Optional[str] = None

class BulkWithdrawalReq(BaseModel):
    ids: List[str]
    action: Literal["approve", "reject", "paid"]
    note: Optional[str] = None

class ApiKeyCreateReq(BaseModel):
    name: str
    ip_whitelist: List[str] = []

class BroadcastReq(BaseModel):
    title: str
    message: str
    target: Literal["all", "selected"] = "all"
    user_ids: List[str] = []

class SettingsReq(BaseModel):
    site_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_enabled: Optional[bool] = None
    telegram_events: Optional[dict] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    maintenance_mode: Optional[bool] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    theme: Optional[str] = None
    color_theme: Optional[Literal["monochrome", "emerald", "cobalt"]] = None

class AdminUserUpdateReq(BaseModel):
    full_name: Optional[str] = None
    status: Optional[Literal["active", "suspended", "banned"]] = None
    wallet_frozen: Optional[bool] = None
    internal_notes: Optional[str] = None
    new_password: Optional[str] = None

# -------------------- Startup --------------------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("mobile_number", unique=True)
    await db.users.create_index("id", unique=True)
    await db.transactions.create_index("id", unique=True)
    await db.transactions.create_index("user_id")
    await db.transactions.create_index([("created_at", -1)])
    await db.transactions.create_index([("external_txn_id", 1), ("api_key_id", 1)], unique=True, sparse=True)
    await db.withdrawals.create_index("user_id")
    await db.withdrawals.create_index([("created_at", -1)])
    await db.payment_methods.create_index("user_id")
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("created_at", -1)])
    await db.api_keys.create_index("key", unique=True)
    await db.api_logs.create_index([("created_at", -1)])
    await db.login_logs.create_index("user_id")
    await db.login_logs.create_index([("created_at", -1)])
    await db.sessions.create_index("user_id")
    await db.login_attempts.create_index("identifier")

    # Seed admin
    existing = await db.users.find_one({"mobile_number": ADMIN_MOBILE})
    if not existing:
        await db.users.insert_one({
            "id": gen_id(),
            "full_name": ADMIN_NAME,
            "mobile_number": ADMIN_MOBILE,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "status": "active",
            "wallet_frozen": False,
            "balance": 0.0,
            "internal_notes": "",
            "created_at": iso(now_utc()),
            "last_login_at": None,
        })
        log.info(f"Admin user seeded: {ADMIN_MOBILE}")
    else:
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"mobile_number": ADMIN_MOBILE},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin"}},
            )
            log.info("Admin password reset to .env value")

    # Seed default settings
    if not await db.settings.find_one({"_id": "system"}):
        await db.settings.insert_one({
            "_id": "system",
            "site_name": "DigiWallet V2",
            "logo_url": "",
            "favicon_url": "",
            "telegram_bot_token": "",
            "telegram_chat_id": "",
            "telegram_enabled": False,
            "telegram_events": {
                "new_credit": True, "new_withdrawal": True, "withdrawal_approved": True,
                "withdrawal_paid": True, "api_error": True, "security_alert": True,
            },
            "smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_password": "",
            "maintenance_mode": False,
            "seo_title": "DigiWallet V2 - Premium Digital Wallet",
            "seo_description": "Secure digital wallet for instant credits and withdrawals.",
            "theme": "dark",
            "color_theme": "monochrome",
            "created_at": iso(now_utc()),
        })

    # Seed default API key for demo
    if not await db.api_keys.find_one({}):
        await db.api_keys.insert_one({
            "id": gen_id(),
            "key": gen_api_key(),
            "name": "Default Integration Key",
            "status": "active",
            "ip_whitelist": [],
            "requests_today": 0,
            "created_at": iso(now_utc()),
            "last_used_at": None,
        })

@app.on_event("shutdown")
async def shutdown():
    client.close()

# -------------------- Notifications helper --------------------
async def push_notification(user_id: Optional[str], title: str, message: str, ntype: str = "info"):
    doc = {
        "id": gen_id(),
        "user_id": user_id,  # None = broadcast
        "title": title,
        "message": message,
        "type": ntype,
        "read": False,
        "created_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)
    # Fire Web Push in parallel (best-effort)
    if user_id:
        try:
            await send_web_push(user_id, title, message, url="/app/notifications", tag=f"dw-{ntype}")
        except Exception:
            pass
    else:
        # broadcast: send to all subscribed users
        try:
            subs = await db.push_subscriptions.find({}, {"user_id": 1}).to_list(2000)
            seen = set()
            for s in subs:
                uid = s.get("user_id")
                if uid and uid not in seen:
                    seen.add(uid)
                    try:
                        await send_web_push(uid, title, message, url="/app", tag=f"dw-{ntype}")
                    except Exception:
                        pass
        except Exception:
            pass

# -------------------- Brute Force --------------------
async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if not rec:
        return
    locked_until = rec.get("locked_until")
    if locked_until and datetime.fromisoformat(locked_until) > now_utc():
        remaining = int((datetime.fromisoformat(locked_until) - now_utc()).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {remaining} minutes.")

async def record_attempt(identifier: str, success: bool):
    if success:
        await db.login_attempts.delete_one({"identifier": identifier})
        return
    rec = await db.login_attempts.find_one({"identifier": identifier})
    attempts = (rec.get("attempts", 0) if rec else 0) + 1
    update = {"identifier": identifier, "attempts": attempts, "updated_at": iso(now_utc())}
    if attempts >= 5:
        update["locked_until"] = iso(now_utc() + timedelta(minutes=15))
        update["attempts"] = 0
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)

# ==========================================================
# AUTH ROUTES
# ==========================================================
@api.get("/")
async def root():
    return {"service": "DigiWallet V2", "version": "2.0", "status": "ok"}

@api.get("/health")
async def health():
    return {"ok": True}

@api.post("/auth/register")
async def register(body: RegisterReq, response: Response):
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    existing = await db.users.find_one({"mobile_number": body.mobile_number})
    if existing:
        raise HTTPException(status_code=400, detail="Mobile number already registered")
    user = {
        "id": gen_id(),
        "full_name": body.full_name.strip(),
        "mobile_number": body.mobile_number,
        "password_hash": hash_password(body.password),
        "role": "user",
        "status": "active",
        "wallet_frozen": False,
        "balance": 0.0,
        "internal_notes": "",
        "created_at": iso(now_utc()),
        "last_login_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], "user")
    await push_notification(user["id"], "Welcome to DigiWallet V2", "Your wallet is ready to use.", "success")
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"token": token, "user": clean_doc(user)}

@api.post("/auth/login")
async def login(body: LoginReq, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    identifier = f"{ip}:{body.mobile_number}"
    await check_lockout(identifier)
    user = await db.users.find_one({"mobile_number": body.mobile_number})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await record_attempt(identifier, False)
        await db.login_logs.insert_one({
            "id": gen_id(), "user_id": user.get("id") if user else None,
            "mobile_number": body.mobile_number, "ip": ip, "user_agent": ua,
            "success": False, "created_at": iso(now_utc()),
        })
        raise HTTPException(status_code=401, detail="Invalid mobile or password")
    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Your account has been banned")
    await record_attempt(identifier, True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": iso(now_utc())}})
    await db.login_logs.insert_one({
        "id": gen_id(), "user_id": user["id"], "mobile_number": body.mobile_number,
        "ip": ip, "user_agent": ua, "success": True, "created_at": iso(now_utc()),
    })
    await db.sessions.insert_one({
        "id": gen_id(), "user_id": user["id"], "ip": ip, "user_agent": ua,
        "created_at": iso(now_utc()), "last_seen": iso(now_utc()), "active": True,
    })
    token = create_token(user["id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"token": token, "user": clean_doc(user)}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await db.sessions.update_many({"user_id": user["id"], "active": True}, {"$set": {"active": False}})
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/change-password")
async def change_password(body: ChangePwReq, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

class TelegramConfigReq(BaseModel):
    telegram_chat_id: str = ""

@api.post("/auth/telegram")
async def set_telegram(body: TelegramConfigReq, user: dict = Depends(get_current_user)):
    chat = (body.telegram_chat_id or "").strip()
    await db.users.update_one({"id": user["id"]}, {"$set": {"telegram_chat_id": chat}})
    return {"ok": True}

@api.post("/auth/telegram/test")
async def test_user_telegram(user: dict = Depends(get_current_user)):
    fresh = await db.users.find_one({"id": user["id"]})
    chat = (fresh or {}).get("telegram_chat_id", "").strip()
    if not chat:
        raise HTTPException(status_code=400, detail="No Telegram chat ID configured")
    settings = await db.settings.find_one({"_id": "system"}) or {}
    token = settings.get("telegram_bot_token") or TELEGRAM_BOT_TOKEN
    if not token:
        raise HTTPException(status_code=400, detail="Telegram bot not configured by admin")
    try:
        async with httpx.AsyncClient(timeout=5.0) as ac:
            r = await ac.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat,
                      "text": f"<b>🎉 Hello {fresh['full_name']}!</b>\nDigiWallet alerts are now <b>active</b> on this chat. You will receive instant notifications for credits, withdrawals and approvals.",
                      "parse_mode": "HTML"},
            )
            if r.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Telegram error: {r.text[:120]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send: {e}")
    return {"ok": True}

# -------- Web Push --------
class PushSubscribeReq(BaseModel):
    subscription: dict
    user_agent: Optional[str] = ""

@api.get("/push/public-key")
async def push_public_key():
    return {"public_key": VAPID_PUBLIC_KEY_B64}

@api.post("/push/subscribe")
async def push_subscribe(body: PushSubscribeReq, user: dict = Depends(get_current_user)):
    endpoint = (body.subscription or {}).get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    # Upsert by endpoint (so re-subscribe doesn't duplicate)
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {
            "user_id": user["id"],
            "endpoint": endpoint,
            "subscription": body.subscription,
            "user_agent": body.user_agent or "",
            "created_at": iso(now_utc()),
        }},
        upsert=True,
    )
    return {"ok": True}

@api.post("/push/unsubscribe")
async def push_unsubscribe(body: PushSubscribeReq, user: dict = Depends(get_current_user)):
    endpoint = (body.subscription or {}).get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["id"]})
    return {"ok": True}

@api.post("/push/test")
async def push_test(user: dict = Depends(get_current_user)):
    await send_web_push(user["id"], "🔔 DigiWallet Test", "Push notifications are working! You'll see real-time alerts even when the wallet tab is closed.", url="/app", tag="push-test")
    return {"ok": True}

# ==========================================================
# USER ROUTES
# ==========================================================
@api.get("/wallet/summary")
async def wallet_summary(user: dict = Depends(require_active_user)):
    uid = user["id"]
    pipeline_credit = [{"$match": {"user_id": uid, "type": "credit"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    pipeline_withdraw = [{"$match": {"user_id": uid, "type": "withdrawal", "status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    cred = await db.transactions.aggregate(pipeline_credit).to_list(1)
    wdr = await db.transactions.aggregate(pipeline_withdraw).to_list(1)
    pending = await db.withdrawals.count_documents({"user_id": uid, "status": {"$in": ["pending", "approved"]}})
    pending_amt = await db.withdrawals.aggregate([
        {"$match": {"user_id": uid, "status": {"$in": ["pending", "approved"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    fresh = await db.users.find_one({"id": uid})
    return {
        "balance": fresh.get("balance", 0.0),
        "wallet_frozen": fresh.get("wallet_frozen", False),
        "total_credits": (cred[0]["total"] if cred else 0.0),
        "total_withdrawals": (wdr[0]["total"] if wdr else 0.0),
        "pending_withdrawals_count": pending,
        "pending_withdrawals_amount": (pending_amt[0]["total"] if pending_amt else 0.0),
    }

@api.get("/transactions")
async def list_transactions(user: dict = Depends(require_active_user),
                            q: Optional[str] = None,
                            type: Optional[str] = None,
                            status: Optional[str] = None,
                            limit: int = 50, skip: int = 0):
    filt = {"user_id": user["id"]}
    if type:
        filt["type"] = type
    if status:
        filt["status"] = status
    if q:
        filt["$or"] = [{"description": {"$regex": q, "$options": "i"}}, {"id": {"$regex": q, "$options": "i"}}, {"external_txn_id": {"$regex": q, "$options": "i"}}]
    items = await db.transactions.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(filt)
    return {"items": items, "total": total}

# Payment methods
@api.get("/payment-methods")
async def list_pm(user: dict = Depends(require_active_user)):
    items = await db.payment_methods.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return items

@api.post("/payment-methods")
async def add_pm(body: PaymentMethodReq, user: dict = Depends(require_active_user)):
    if body.type == "upi":
        if not body.upi_id or "@" not in body.upi_id:
            raise HTTPException(status_code=400, detail="Valid UPI ID required (e.g. name@bank)")
    else:
        if not (body.account_holder and body.account_number and body.ifsc):
            raise HTTPException(status_code=400, detail="Account holder, number and IFSC are required")
    pm = {"id": gen_id(), "user_id": user["id"], **body.model_dump(), "created_at": iso(now_utc())}
    await db.payment_methods.insert_one(pm)
    pm.pop("_id", None)
    return pm

@api.delete("/payment-methods/{pm_id}")
async def del_pm(pm_id: str, user: dict = Depends(require_active_user)):
    res = await db.payment_methods.delete_one({"id": pm_id, "user_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

# Withdrawals
@api.post("/withdrawals")
async def submit_withdrawal(body: WithdrawalReq, user: dict = Depends(require_active_user)):
    if user.get("wallet_frozen"):
        raise HTTPException(status_code=403, detail="Wallet is frozen")
    fresh = await db.users.find_one({"id": user["id"]})
    if body.amount > fresh.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    if body.amount < 1:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is 1")
    pm = await db.payment_methods.find_one({"id": body.payment_method_id, "user_id": user["id"]})
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    # Lock funds: deduct now, refund on reject
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -body.amount}})
    wd = {
        "id": gen_id(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "user_mobile": user["mobile_number"],
        "amount": body.amount,
        "method": pm["type"],
        "payment_details": {k: v for k, v in pm.items() if k != "_id"},
        "status": "pending",
        "note": "",
        "created_at": iso(now_utc()),
        "processed_at": None,
        "processed_by": None,
    }
    await db.withdrawals.insert_one(wd)
    # Also a transaction
    tx = {
        "id": gen_id(),
        "ref_id": gen_ref_id(),
        "user_id": user["id"],
        "type": "withdrawal",
        "amount": body.amount,
        "status": "pending",
        "description": f"Withdrawal via {pm['type'].upper()}",
        "related_id": wd["id"],
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(tx)
    await push_notification(user["id"], "Withdrawal Submitted", f"₹{body.amount} · withdrawal requested via {pm['type'].upper()} · {fmt_when()}", "info")
    await telegram_send(
        f"<b>📤 Withdrawal Submitted</b>\nAmount: <b>₹{body.amount}</b>\nMethod: {pm['type'].upper()}\nRef: {tx['ref_id']}\nStatus: Pending review",
        user_chat=user.get("telegram_chat_id"),
    )
    wd.pop("_id", None)
    return wd

@api.get("/withdrawals")
async def list_withdrawals(user: dict = Depends(require_active_user),
                           status: Optional[str] = None,
                           limit: int = 50, skip: int = 0):
    filt = {"user_id": user["id"]}
    if status:
        filt["status"] = status
    items = await db.withdrawals.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return items

# Notifications
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user), limit: int = 50):
    items = await db.notifications.find(
        {"$or": [{"user_id": user["id"]}, {"user_id": None}]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({
        "$or": [{"user_id": user["id"]}, {"user_id": None}],
        "read": False,
    })
    return {"items": items, "unread": unread}

@api.post("/notifications/read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"$or": [{"user_id": user["id"]}, {"user_id": None}], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}

@api.post("/notifications/{nid}/read")
async def mark_one_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}

# Public settings (for branding)
@api.get("/public/settings")
async def public_settings():
    s = await db.settings.find_one({"_id": "system"}) or {}
    return {
        "site_name": s.get("site_name", "DigiWallet V2"),
        "logo_url": s.get("logo_url", ""),
        "favicon_url": s.get("favicon_url", ""),
        "seo_title": s.get("seo_title", ""),
        "seo_description": s.get("seo_description", ""),
        "maintenance_mode": s.get("maintenance_mode", False),
        "theme": s.get("theme", "dark"),
        "color_theme": s.get("color_theme", "monochrome"),
    }

# ==========================================================
# WALLET CREDIT API (external integration)
# ==========================================================
@api.post("/credit")
async def credit_api(body: CreditApiReq, request: Request):
    ip = request.client.host if request.client else "unknown"
    log_doc = {
        "id": gen_id(),
        "endpoint": "/api/credit",
        "request": body.model_dump(),
        "ip": ip,
        "status": "pending",
        "error": None,
        "created_at": iso(now_utc()),
    }

    async def fail(code: int, msg: str, etype: str = "error"):
        log_doc["status"] = "failed"
        log_doc["error"] = msg
        log_doc["error_type"] = etype
        await db.api_logs.insert_one(log_doc)
        await telegram_send(f"<b>API {etype.upper()}</b>: {msg}\nIP: {ip}\nKey: {body.api_key[:8]}...")
        raise HTTPException(status_code=code, detail=msg)

    api_key = await db.api_keys.find_one({"key": body.api_key})
    if not api_key:
        await fail(401, "Invalid API key", "invalid_key")
    if api_key["status"] != "active":
        await fail(403, "API key is paused", "paused_key")
    if api_key.get("ip_whitelist") and ip not in api_key["ip_whitelist"]:
        await fail(403, f"IP {ip} not whitelisted", "ip_blocked")
    log_doc["api_key_id"] = api_key["id"]

    user = await db.users.find_one({"id": body.user_id})
    if not user:
        await fail(404, f"User {body.user_id} not found", "user_not_found")
    if user.get("status") == "banned":
        await fail(403, "User is banned", "user_banned")
    if user.get("wallet_frozen"):
        await fail(403, "Wallet is frozen", "wallet_frozen")
    if body.amount <= 0:
        await fail(400, "Amount must be > 0", "invalid_amount")

    dup = await db.transactions.find_one({"external_txn_id": body.txn_id, "api_key_id": api_key["id"]})
    if dup:
        log_doc["status"] = "duplicate"
        log_doc["error"] = "Duplicate transaction"
        log_doc["error_type"] = "duplicate"
        await db.api_logs.insert_one(log_doc)
        raise HTTPException(status_code=409, detail="Duplicate transaction")

    # Credit the wallet
    await db.users.update_one({"id": body.user_id}, {"$inc": {"balance": body.amount}})
    tx = {
        "id": gen_id(),
        "ref_id": gen_ref_id(),
        "user_id": body.user_id,
        "type": "credit",
        "amount": body.amount,
        "status": "completed",
        "description": body.description or f"API Credit - TXN {body.txn_id}",
        "external_txn_id": body.txn_id,
        "api_key_id": api_key["id"],
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(tx)
    await db.api_keys.update_one({"id": api_key["id"]}, {"$inc": {"requests_today": 1}, "$set": {"last_used_at": iso(now_utc())}})

    log_doc["status"] = "success"
    log_doc["txn_id"] = tx["id"]
    await db.api_logs.insert_one(log_doc)

    await push_notification(body.user_id, "Money Credited", f"₹{body.amount} · credited for {(body.description or body.txn_id)[:60]} · {fmt_when()}", "success")
    await telegram_send(
        f"<b>💰 Money Credited!</b>\nAmount: <b>₹{body.amount}</b>\nRef: <code>{tx['ref_id']}</code>\nTXN: {body.txn_id}",
        user_chat=user.get("telegram_chat_id"),
    )

    return {"success": True, "txn_id": tx["id"], "ref_id": tx["ref_id"], "external_txn_id": body.txn_id, "new_balance": user.get("balance", 0) + body.amount}

# ==========================================================
# GATEWAY COMPATIBILITY ENDPOINT
# Supports both formats:
#   Format A (legacy add_balance.php):
#     GET /api/add_balance.php?key=XXX&numbe={paytm}&amount={amo}&comment={com}&order_id={order_id}
#   Format B (modern gateway):
#     GET /api/gateway?guid=XXX&paytm={wallet_number}&amount={amount}&comment={comment}&order_id={order_id}
#
# All param names are case-insensitive and accept aliases:
#   API key       : key | guid | api_key | apikey | token
#   Wallet/User   : numbe | paytm | wallet_number | wallet_no | wallet | mobile | mobile_number | number
#   Amount        : amount | amo | amt
#   Comment       : comment | com | note | description | desc
#   Order ID      : order_id | orderid | order | txnid | txn_id | transaction_id
# Output format  : ?format=text (default) or ?format=json
# ==========================================================
def _first_param(params: dict, names: list, default=None):
    for n in names:
        for k, v in params.items():
            if k.lower() == n.lower() and v not in (None, ""):
                return v
    return default

async def _handle_gateway_credit(request: Request, endpoint_label: str):
    params = dict(request.query_params)
    # Also merge POST form/json if present
    if request.method == "POST":
        try:
            ctype = request.headers.get("content-type", "")
            if "application/json" in ctype:
                body = await request.json()
                if isinstance(body, dict):
                    for k, v in body.items():
                        params.setdefault(k, str(v))
            else:
                form = await request.form()
                for k, v in form.items():
                    params.setdefault(k, str(v))
        except Exception:
            pass

    key = _first_param(params, ["key", "guid", "api_key", "apikey", "token", "auth", "secret"])
    wallet = _first_param(params, [
        "numbe", "paytm", "wallet_number", "walletnumber", "wallet_no", "walletno",
        "wallet", "wallet_id", "walletid", "digiwallet", "digi_wallet",
        "user", "user_id", "userid", "username",
        "mobile", "mobile_number", "mobilenumber", "number", "phone",
        "account", "acc", "account_no", "accountnumber",
        "to", "receiver", "beneficiary", "customer", "customer_id"
    ])
    amount_raw = _first_param(params, ["amount", "amo", "amt", "value", "sum", "rs"])
    comment = _first_param(params, ["comment", "com", "note", "description", "desc", "remark", "remarks", "msg", "message"], "")
    order_id = _first_param(params, ["order_id", "orderid", "order", "txnid", "txn_id", "transaction_id", "ref", "reference", "ref_id", "utr"], "")
    out_format = (_first_param(params, ["format"], "text") or "text").lower()

    ip = request.client.host if request.client else "unknown"
    log_doc = {
        "id": gen_id(),
        "endpoint": endpoint_label,
        "request": {
            "key": (key[:8] + "...") if key else None,
            "wallet": wallet, "amount": amount_raw,
            "comment": comment, "order_id": order_id,
        },
        "ip": ip,
        "status": "pending",
        "error": None,
        "created_at": iso(now_utc()),
    }

    def respond(ok: bool, msg: str, http: int = 200, extra: Optional[dict] = None):
        if out_format == "json":
            import json as _json
            payload = {"status": "SUCCESS" if ok else "ERROR", "message": msg}
            if extra: payload.update(extra)
            return Response(content=_json.dumps(payload), media_type="application/json", status_code=http)
        body = f"SUCCESS: {msg}" if ok else f"ERROR: {msg}"
        return Response(content=body, media_type="text/plain", status_code=http)

    if not key:
        log_doc["status"] = "failed"; log_doc["error"] = "Missing API key"; log_doc["error_type"] = "missing_key"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "Missing API key (key/guid)", 400)
    if not wallet:
        log_doc["status"] = "failed"; log_doc["error"] = "Missing wallet number"; log_doc["error_type"] = "missing_wallet"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "Missing wallet number (paytm/numbe/wallet_number)", 400)

    # Parse amount
    try:
        amt = float(amount_raw)
        if amt <= 0: raise ValueError
    except Exception:
        log_doc["status"] = "failed"; log_doc["error"] = "Invalid amount"; log_doc["error_type"] = "invalid_amount"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "Invalid amount", 400)

    # Validate API key
    api_key = await db.api_keys.find_one({"key": key})
    if not api_key:
        log_doc["status"] = "failed"; log_doc["error"] = "Invalid API key"; log_doc["error_type"] = "invalid_key"
        await db.api_logs.insert_one(log_doc)
        await telegram_send(f"<b>API INVALID_KEY</b>\nEndpoint: {endpoint_label}\nIP: {ip}\nKey: {key[:8]}...")
        return respond(False, "Invalid API key", 401)
    if api_key["status"] != "active":
        log_doc["status"] = "failed"; log_doc["error"] = "API key paused"; log_doc["error_type"] = "paused_key"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "API key is paused", 403)
    if api_key.get("ip_whitelist") and ip not in api_key["ip_whitelist"]:
        log_doc["status"] = "failed"; log_doc["error"] = f"IP {ip} not whitelisted"; log_doc["error_type"] = "ip_blocked"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "IP not whitelisted", 403)
    log_doc["api_key_id"] = api_key["id"]

    # Resolve user by mobile/wallet number
    wallet = str(wallet).strip()
    user = await db.users.find_one({"mobile_number": wallet})
    if not user:
        log_doc["status"] = "failed"; log_doc["error"] = f"Wallet {wallet} not found"; log_doc["error_type"] = "user_not_found"
        await db.api_logs.insert_one(log_doc)
        return respond(False, f"Wallet {wallet} not found", 404)
    if user.get("status") == "banned":
        log_doc["status"] = "failed"; log_doc["error"] = "User banned"; log_doc["error_type"] = "user_banned"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "User is banned", 403)
    if user.get("wallet_frozen"):
        log_doc["status"] = "failed"; log_doc["error"] = "Wallet frozen"; log_doc["error_type"] = "wallet_frozen"
        await db.api_logs.insert_one(log_doc)
        return respond(False, "Wallet is frozen", 403)

    # Duplicate detection: prefer order_id, else fallback to comment
    dup_key = (str(order_id) or str(comment) or "").strip()
    if dup_key:
        dup = await db.transactions.find_one({"external_txn_id": dup_key, "api_key_id": api_key["id"]})
        if dup:
            log_doc["status"] = "duplicate"; log_doc["error"] = "Duplicate order_id"; log_doc["error_type"] = "duplicate"
            await db.api_logs.insert_one(log_doc)
            return respond(False, "Duplicate transaction", 409, {"order_id": dup_key})

    # Credit wallet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": amt}})
    tx = {
        "id": gen_id(),
        "ref_id": gen_ref_id(),
        "user_id": user["id"],
        "type": "credit",
        "amount": amt,
        "status": "completed",
        "description": comment or "Gateway credit",
        "external_txn_id": dup_key or None,
        "order_id": dup_key or None,
        "api_key_id": api_key["id"],
        "gateway_endpoint": endpoint_label,
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(tx)
    await db.api_keys.update_one({"id": api_key["id"]}, {"$inc": {"requests_today": 1}, "$set": {"last_used_at": iso(now_utc())}})
    log_doc["status"] = "success"; log_doc["txn_id"] = tx["id"]
    await db.api_logs.insert_one(log_doc)

    new_bal = user.get("balance", 0) + amt
    await push_notification(user["id"], "Money Credited", f"₹{amt} · credited for {(comment or 'Gateway credit')[:60]} · {fmt_when()}", "success")
    await telegram_send(
        f"<b>💰 Money Credited!</b>\nAmount: <b>₹{amt}</b>\nRef: <code>{tx['ref_id']}</code>\nComment: {comment or '—'}",
        user_chat=user.get("telegram_chat_id"),
    )

    return respond(True, f"Credited {amt} to {wallet}", 200, {
        "txn_id": tx["id"], "ref_id": tx["ref_id"], "order_id": dup_key, "new_balance": new_bal, "user_id": user["id"]
    })


# Single gateway endpoint matching the exact reference format:
# https://your-domain/api/add_balance.php?key=XXX&numbe={paytm}&amount={amo}&comment={com}
@api.get("/add_balance.php")
@api.post("/add_balance.php")
async def gateway_add_balance(request: Request):
    return await _handle_gateway_credit(request, "/api/add_balance.php")


# ==========================================================
# ADMIN ROUTES
# ==========================================================
admin_router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

@admin_router.get("/dashboard")
async def admin_dashboard():
    total_users = await db.users.count_documents({"role": "user"})
    active_users = await db.users.count_documents({"role": "user", "status": "active"})
    bal_agg = await db.users.aggregate([{"$match": {"role": "user"}}, {"$group": {"_id": None, "total": {"$sum": "$balance"}}}]).to_list(1)
    total_balance = bal_agg[0]["total"] if bal_agg else 0
    total_credits = await db.transactions.aggregate([{"$match": {"type": "credit"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    total_withdrawals = await db.transactions.aggregate([{"$match": {"type": "withdrawal", "status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    today = now_utc().date().isoformat()
    today_tx = await db.transactions.count_documents({"created_at": {"$gte": today}})
    api_today = await db.api_logs.count_documents({"created_at": {"$gte": today}})
    recent_tx = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    recent_wd = await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)

    # 7-day chart data
    chart = []
    for i in range(6, -1, -1):
        day = (now_utc() - timedelta(days=i)).date().isoformat()
        next_day = (now_utc() - timedelta(days=i - 1)).date().isoformat()
        c = await db.transactions.aggregate([
            {"$match": {"type": "credit", "created_at": {"$gte": day, "$lt": next_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]).to_list(1)
        w = await db.transactions.aggregate([
            {"$match": {"type": "withdrawal", "status": "paid", "created_at": {"$gte": day, "$lt": next_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]).to_list(1)
        chart.append({
            "day": day,
            "credits": (c[0]["total"] if c else 0),
            "withdrawals": (w[0]["total"] if w else 0),
            "credit_count": (c[0]["count"] if c else 0),
            "withdrawal_count": (w[0]["count"] if w else 0),
        })

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_balance": total_balance,
        "total_credits": total_credits[0]["total"] if total_credits else 0,
        "total_withdrawals": total_withdrawals[0]["total"] if total_withdrawals else 0,
        "pending_withdrawals": pending_withdrawals,
        "today_activity": today_tx,
        "api_requests_today": api_today,
        "recent_transactions": recent_tx,
        "recent_withdrawals": recent_wd,
        "chart_7d": chart,
    }

# Users
@admin_router.get("/users")
async def admin_users(q: Optional[str] = None, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    filt = {"role": "user"}
    if status:
        filt["status"] = status
    if q:
        filt["$or"] = [{"full_name": {"$regex": q, "$options": "i"}}, {"mobile_number": {"$regex": q, "$options": "i"}}, {"id": q}]
    items = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(filt)
    return {"items": items, "total": total}

@admin_router.get("/users/{user_id}")
async def admin_user_detail(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    logins = await db.login_logs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    sessions = await db.sessions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    txs = await db.transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"user": user, "login_history": logins, "sessions": sessions, "recent_transactions": txs}

@admin_router.patch("/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdateReq):
    data = {k: v for k, v in body.model_dump().items() if v is not None and k != "new_password"}
    if body.new_password:
        data["password_hash"] = hash_password(body.new_password)
    if not data:
        raise HTTPException(status_code=400, detail="No changes")
    await db.users.update_one({"id": user_id}, {"$set": data})
    return {"ok": True}

@admin_router.post("/users/{user_id}/login-as")
async def admin_login_as(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": clean_doc(user)}

@admin_router.post("/users/{user_id}/force-logout")
async def admin_force_logout(user_id: str):
    await db.sessions.update_many({"user_id": user_id, "active": True}, {"$set": {"active": False}})
    return {"ok": True}

# Wallet management
@admin_router.post("/wallet/credit")
async def admin_wallet_credit(body: AdminCreditReq, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": body.user_id}, {"$inc": {"balance": body.amount}})
    tx = {"id": gen_id(), "ref_id": gen_ref_id(), "user_id": body.user_id, "type": "credit", "amount": body.amount,
          "status": "completed", "description": f"Manual credit by admin. {body.note or ''}".strip(),
          "admin_id": admin["id"], "created_at": iso(now_utc())}
    await db.transactions.insert_one(tx)
    await push_notification(body.user_id, "Manual Credit", f"₹{body.amount} · credited for {(body.note or 'Manual credit by admin')[:60]} · {fmt_when()}", "success")
    await telegram_send(
        f"<b>💰 Manual Credit</b>\nAmount: <b>₹{body.amount}</b>\nRef: <code>{tx['ref_id']}</code>\nBy admin",
        user_chat=user.get("telegram_chat_id"),
    )
    return {"ok": True, "txn_id": tx["id"], "ref_id": tx["ref_id"]}

@admin_router.post("/wallet/debit")
async def admin_wallet_debit(body: AdminDebitReq, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("balance", 0) < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    await db.users.update_one({"id": body.user_id}, {"$inc": {"balance": -body.amount}})
    tx = {"id": gen_id(), "ref_id": gen_ref_id(), "user_id": body.user_id, "type": "debit", "amount": body.amount,
          "status": "completed", "description": f"Manual debit by admin. {body.note or ''}".strip(),
          "admin_id": admin["id"], "created_at": iso(now_utc())}
    await db.transactions.insert_one(tx)
    await push_notification(body.user_id, "Manual Debit", f"₹{body.amount} · debited for {(body.note or 'Manual debit by admin')[:60]} · {fmt_when()}", "warning")
    await telegram_send(
        f"<b>📤 Manual Debit</b>\nAmount: <b>₹{body.amount}</b>\nRef: <code>{tx['ref_id']}</code>",
        user_chat=user.get("telegram_chat_id"),
    )
    return {"ok": True, "txn_id": tx["id"], "ref_id": tx["ref_id"]}

@admin_router.post("/wallet/adjust")
async def admin_wallet_adjust(body: AdminAdjustReq, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    delta = body.new_balance - user.get("balance", 0)
    await db.users.update_one({"id": body.user_id}, {"$set": {"balance": body.new_balance}})
    tx = {"id": gen_id(), "ref_id": gen_ref_id(), "user_id": body.user_id, "type": "adjustment", "amount": delta,
          "status": "completed", "description": f"Balance adjusted. {body.note or ''}".strip(),
          "admin_id": admin["id"], "created_at": iso(now_utc())}
    await db.transactions.insert_one(tx)
    return {"ok": True, "ref_id": tx["ref_id"]}

@admin_router.post("/wallet/{user_id}/freeze")
async def admin_freeze(user_id: str):
    await db.users.update_one({"id": user_id}, {"$set": {"wallet_frozen": True}})
    return {"ok": True}

@admin_router.post("/wallet/{user_id}/unfreeze")
async def admin_unfreeze(user_id: str):
    await db.users.update_one({"id": user_id}, {"$set": {"wallet_frozen": False}})
    return {"ok": True}

@admin_router.post("/transactions/{tx_id}/reverse")
async def admin_reverse_tx(tx_id: str, admin: dict = Depends(require_admin)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Not found")
    if tx.get("reversed"):
        raise HTTPException(status_code=400, detail="Already reversed")
    if tx["type"] == "credit":
        await db.users.update_one({"id": tx["user_id"]}, {"$inc": {"balance": -tx["amount"]}})
    elif tx["type"] == "debit":
        await db.users.update_one({"id": tx["user_id"]}, {"$inc": {"balance": tx["amount"]}})
    else:
        raise HTTPException(status_code=400, detail="Only credit/debit can be reversed")
    await db.transactions.update_one({"id": tx_id}, {"$set": {"reversed": True}})
    rev = {"id": gen_id(), "ref_id": gen_ref_id(), "user_id": tx["user_id"], "type": "reversal",
           "amount": tx["amount"], "status": "completed",
           "description": f"Reversal of {tx_id}", "admin_id": admin["id"],
           "created_at": iso(now_utc())}
    await db.transactions.insert_one(rev)
    return {"ok": True}

# Withdrawals admin
@admin_router.get("/withdrawals")
async def admin_withdrawals(status: Optional[str] = None, q: Optional[str] = None, limit: int = 100, skip: int = 0):
    filt = {}
    if status:
        filt["status"] = status
    if q:
        filt["$or"] = [{"user_name": {"$regex": q, "$options": "i"}}, {"user_mobile": {"$regex": q, "$options": "i"}}, {"id": q}]
    items = await db.withdrawals.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.withdrawals.count_documents(filt)
    return {"items": items, "total": total}

async def _process_wd(wid: str, action: str, note: str, admin_id: str):
    wd = await db.withdrawals.find_one({"id": wid})
    if not wd:
        return None
    new_status = wd["status"]
    if action == "approve" and wd["status"] == "pending":
        new_status = "approved"
    elif action == "reject" and wd["status"] in ("pending", "approved"):
        # refund
        await db.users.update_one({"id": wd["user_id"]}, {"$inc": {"balance": wd["amount"]}})
        new_status = "rejected"
    elif action == "paid" and wd["status"] in ("pending", "approved"):
        new_status = "paid"
    else:
        return wd
    await db.withdrawals.update_one({"id": wid}, {"$set": {
        "status": new_status, "note": note or wd.get("note", ""),
        "processed_at": iso(now_utc()), "processed_by": admin_id,
    }})
    await db.transactions.update_many({"related_id": wid}, {"$set": {"status": new_status}})
    title_map = {"approved": "Withdrawal Approved", "rejected": "Withdrawal Rejected", "paid": "Withdrawal Paid"}
    verb_map = {"approved": "approved for", "rejected": "rejected for", "paid": "paid via"}
    nt_map = {"approved": "info", "rejected": "warning", "paid": "success"}
    emoji_map = {"approved": "✅", "rejected": "❌", "paid": "💸"}
    user_doc = await db.users.find_one({"id": wd["user_id"]})
    if new_status in title_map:
        verb = verb_map.get(new_status, new_status)
        method = wd.get("method", "").upper()
        suffix = f" · {note}" if note else ""
        await push_notification(wd["user_id"], title_map[new_status],
                                f"₹{wd['amount']} · {verb} {method}{suffix} · {fmt_when()}", nt_map[new_status])
    await telegram_send(
        f"<b>{emoji_map.get(new_status, '')} Withdrawal {new_status.upper()}</b>\nAmount: <b>₹{wd['amount']}</b>\nMethod: {wd.get('method', '').upper()}",
        user_chat=(user_doc or {}).get("telegram_chat_id"),
    )
    return await db.withdrawals.find_one({"id": wid}, {"_id": 0})

@admin_router.post("/withdrawals/{wid}/approve")
async def admin_approve(wid: str, body: AdminWithdrawalActionReq, admin: dict = Depends(require_admin)):
    r = await _process_wd(wid, "approve", body.note or "", admin["id"])
    if not r: raise HTTPException(status_code=404, detail="Not found")
    return r

@admin_router.post("/withdrawals/{wid}/reject")
async def admin_reject(wid: str, body: AdminWithdrawalActionReq, admin: dict = Depends(require_admin)):
    r = await _process_wd(wid, "reject", body.note or "", admin["id"])
    if not r: raise HTTPException(status_code=404, detail="Not found")
    return r

@admin_router.post("/withdrawals/{wid}/paid")
async def admin_paid(wid: str, body: AdminWithdrawalActionReq, admin: dict = Depends(require_admin)):
    r = await _process_wd(wid, "paid", body.note or "", admin["id"])
    if not r: raise HTTPException(status_code=404, detail="Not found")
    return r

@admin_router.post("/withdrawals/bulk")
async def admin_bulk(body: BulkWithdrawalReq, admin: dict = Depends(require_admin)):
    results = []
    for wid in body.ids:
        r = await _process_wd(wid, body.action, body.note or "", admin["id"])
        if r: results.append(r["id"])
    return {"ok": True, "processed": results}

@admin_router.get("/withdrawals/export")
async def admin_wd_export(status: Optional[str] = None):
    filt = {}
    if status:
        filt["status"] = status
    items = await db.withdrawals.find(filt, {"_id": 0}).sort("created_at", -1).to_list(10000)
    # Simple CSV-like response
    import io, csv
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["id", "user_name", "user_mobile", "amount", "method", "status", "created_at", "processed_at"])
    for it in items:
        w.writerow([it.get("id"), it.get("user_name"), it.get("user_mobile"),
                    it.get("amount"), it.get("method"), it.get("status"),
                    it.get("created_at"), it.get("processed_at")])
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=withdrawals.csv"})

# API Keys
@admin_router.get("/api-keys")
async def admin_api_keys():
    items = await db.api_keys.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@admin_router.post("/api-keys")
async def admin_create_key(body: ApiKeyCreateReq):
    rec = {"id": gen_id(), "key": gen_api_key(), "name": body.name,
           "status": "active", "ip_whitelist": body.ip_whitelist, "requests_today": 0,
           "created_at": iso(now_utc()), "last_used_at": None}
    await db.api_keys.insert_one(rec)
    rec.pop("_id", None)
    return rec

@admin_router.patch("/api-keys/{kid}/toggle")
async def admin_toggle_key(kid: str):
    k = await db.api_keys.find_one({"id": kid})
    if not k: raise HTTPException(status_code=404, detail="Not found")
    new_status = "paused" if k["status"] == "active" else "active"
    await db.api_keys.update_one({"id": kid}, {"$set": {"status": new_status}})
    return {"ok": True, "status": new_status}

@admin_router.patch("/api-keys/{kid}/whitelist")
async def admin_key_whitelist(kid: str, body: ApiKeyCreateReq):
    await db.api_keys.update_one({"id": kid}, {"$set": {"ip_whitelist": body.ip_whitelist}})
    return {"ok": True}

@admin_router.delete("/api-keys/{kid}")
async def admin_delete_key(kid: str):
    await db.api_keys.delete_one({"id": kid})
    return {"ok": True}

@admin_router.get("/api-logs")
async def admin_api_logs(q: Optional[str] = None, status: Optional[str] = None, limit: int = 100):
    filt = {}
    if status:
        filt["status"] = status
    if q:
        filt["$or"] = [{"error": {"$regex": q, "$options": "i"}}, {"ip": q}]
    items = await db.api_logs.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

# Notifications admin
@admin_router.post("/notifications/broadcast")
async def admin_broadcast(body: BroadcastReq):
    if body.target == "all":
        await push_notification(None, body.title, body.message, "announcement")
    else:
        for uid in body.user_ids:
            await push_notification(uid, body.title, body.message, "announcement")
    return {"ok": True}

# Announcements
@admin_router.get("/announcements")
async def admin_announcements():
    items = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@admin_router.post("/announcements")
async def admin_create_ann(body: BroadcastReq):
    rec = {"id": gen_id(), "title": body.title, "message": body.message,
           "type": "announcement", "active": True, "created_at": iso(now_utc())}
    await db.announcements.insert_one(rec)
    rec.pop("_id", None)
    return rec

# Security
@admin_router.get("/security/login-logs")
async def admin_login_logs(success: Optional[bool] = None, limit: int = 200):
    filt = {}
    if success is not None:
        filt["success"] = success
    items = await db.login_logs.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

@admin_router.get("/security/sessions")
async def admin_sessions(limit: int = 200):
    items = await db.sessions.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

@admin_router.post("/security/force-logout-all")
async def admin_force_logout_all():
    await db.sessions.update_many({"active": True, "user_id": {"$ne": None}}, {"$set": {"active": False}})
    return {"ok": True}

# Settings
@admin_router.get("/settings")
async def admin_get_settings():
    s = await db.settings.find_one({"_id": "system"}, {"_id": 0}) or {}
    s.pop("smtp_password", None)  # mask
    return s

@admin_router.patch("/settings")
async def admin_update_settings(body: SettingsReq):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if data:
        await db.settings.update_one({"_id": "system"}, {"$set": data}, upsert=True)
    return {"ok": True}

@admin_router.post("/settings/telegram/test")
async def admin_telegram_test():
    await telegram_send("<b>Test Alert</b>\nDigiWallet V2 Telegram integration is working ✅")
    return {"ok": True}

@admin_router.get("/transactions")
async def admin_transactions(
    q: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    filt = {}
    if type: filt["type"] = type
    if status: filt["status"] = status
    if user_id: filt["user_id"] = user_id
    if min_amount is not None or max_amount is not None:
        a = {}
        if min_amount is not None: a["$gte"] = min_amount
        if max_amount is not None: a["$lte"] = max_amount
        filt["amount"] = a
    if from_date or to_date:
        d = {}
        if from_date: d["$gte"] = from_date
        if to_date: d["$lte"] = to_date
        filt["created_at"] = d
    if q:
        filt["$or"] = [
            {"description": {"$regex": q, "$options": "i"}},
            {"ref_id": {"$regex": q, "$options": "i"}},
            {"external_txn_id": {"$regex": q, "$options": "i"}},
            {"id": q},
        ]
    items = await db.transactions.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Enrich with user info
    uids = list({i["user_id"] for i in items if i.get("user_id")})
    users = await db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "full_name": 1, "mobile_number": 1}).to_list(len(uids))
    umap = {u["id"]: u for u in users}
    for it in items:
        u = umap.get(it.get("user_id"))
        if u:
            it["user_name"] = u["full_name"]
            it["user_mobile"] = u["mobile_number"]
    total = await db.transactions.count_documents(filt)
    # Summary stats
    summary = await db.transactions.aggregate([
        {"$match": filt},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(50)
    return {"items": items, "total": total, "summary": summary}

@admin_router.get("/transactions/{tx_id}")
async def admin_transaction_detail(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Not found")
    user = await db.users.find_one({"id": tx.get("user_id")}, {"_id": 0, "password_hash": 0})
    # related api log
    log = None
    if tx.get("external_txn_id"):
        log = await db.api_logs.find_one({"txn_id": tx["id"]}, {"_id": 0})
    related_wd = None
    if tx.get("related_id"):
        related_wd = await db.withdrawals.find_one({"id": tx["related_id"]}, {"_id": 0})
    admin_user = None
    if tx.get("admin_id"):
        au = await db.users.find_one({"id": tx["admin_id"]}, {"_id": 0, "full_name": 1, "mobile_number": 1})
        admin_user = au
    return {"transaction": tx, "user": user, "api_log": log, "related_withdrawal": related_wd, "admin": admin_user}

@admin_router.get("/transactions/export")
async def admin_transactions_export(
    type: Optional[str] = None, status: Optional[str] = None,
    from_date: Optional[str] = None, to_date: Optional[str] = None,
):
    filt = {}
    if type: filt["type"] = type
    if status: filt["status"] = status
    if from_date or to_date:
        d = {}
        if from_date: d["$gte"] = from_date
        if to_date: d["$lte"] = to_date
        filt["created_at"] = d
    items = await db.transactions.find(filt, {"_id": 0}).sort("created_at", -1).to_list(50000)
    import io, csv
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["ref_id", "id", "user_id", "type", "amount", "status", "description", "external_txn_id", "created_at"])
    for it in items:
        w.writerow([it.get("ref_id"), it.get("id"), it.get("user_id"), it.get("type"),
                    it.get("amount"), it.get("status"), it.get("description"),
                    it.get("external_txn_id"), it.get("created_at")])
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=transactions.csv"})

class TxUpdateReq(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    flagged: Optional[bool] = None
    admin_note: Optional[str] = None

@admin_router.patch("/transactions/{tx_id}")
async def admin_update_transaction(tx_id: str, body: TxUpdateReq, admin: dict = Depends(require_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No changes")
    await db.transactions.update_one({"id": tx_id}, {"$set": data})
    return {"ok": True}


# Register routers
api.include_router(admin_router)
app.include_router(api)
