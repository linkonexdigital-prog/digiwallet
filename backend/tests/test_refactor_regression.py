"""Regression tests for the DigiWallet V2 big-bang refactor.

Covers:
  - Gateway credit endpoint /api/add_balance.php (split into _gw_* helpers)
  - Admin transactions filtering (_build_tx_filter / _enrich_tx_with_users)
  - Telegram test endpoint (split into _tg_* helpers)
"""
import os
import uuid
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fintech-v2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "Admin@123"


def _rand_mobile():
    return "7" + str(uuid.uuid4().int)[:9]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers(session):
    r = session.post(f"{API}/auth/login", json={"mobile_number": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def api_key(session, admin_headers):
    r = session.get(f"{API}/admin/api-keys", headers=admin_headers)
    assert r.status_code == 200, r.text
    keys = r.json()
    assert len(keys) > 0, "no seeded API key found"
    # Ensure we pick an active key
    active = [k for k in keys if k.get("status") == "active"]
    assert active, "no active API key"
    return active[0]["key"]


@pytest.fixture(scope="module")
def test_user(session):
    mobile = _rand_mobile()
    payload = {
        "full_name": "TEST GW User",
        "mobile_number": mobile,
        "password": "Test@123",
        "confirm_password": "Test@123",
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"mobile": mobile, "user_id": data["user"]["id"]}


# ===================== Gateway credit =====================
class TestGatewayCredit:
    """Refactor regression: _handle_gateway_credit + _gw_* helpers."""

    def test_missing_wallet_returns_error_400(self, session, api_key):
        # (a) missing wallet
        r = session.get(f"{API}/add_balance.php", params={"key": api_key, "amount": "10"})
        assert r.status_code == 400
        assert "ERROR" in r.text
        assert "wallet" in r.text.lower()

    def test_missing_key_returns_error_400(self, session, test_user):
        # (b) missing key
        r = session.get(f"{API}/add_balance.php", params={"paytm": test_user["mobile"], "amount": "10"})
        assert r.status_code == 400
        assert "ERROR" in r.text
        assert "key" in r.text.lower() or "api" in r.text.lower()

    def test_invalid_amount_returns_error_400(self, session, api_key, test_user):
        # (c) invalid amount
        r = session.get(
            f"{API}/add_balance.php",
            params={"key": api_key, "paytm": test_user["mobile"], "amount": "abc"},
        )
        assert r.status_code == 400
        assert "Invalid amount" in r.text

        # also zero/negative is invalid
        r2 = session.get(
            f"{API}/add_balance.php",
            params={"key": api_key, "paytm": test_user["mobile"], "amount": "0"},
        )
        assert r2.status_code == 400

    def test_invalid_api_key_returns_401(self, session, test_user):
        # (d) invalid api key
        r = session.get(
            f"{API}/add_balance.php",
            params={"key": "NOT_A_REAL_KEY", "paytm": test_user["mobile"], "amount": "10"},
        )
        assert r.status_code == 401
        assert "Invalid API key" in r.text

    def test_valid_credit_success_text(self, session, api_key, test_user):
        # (e) valid request — text/plain default
        order_id = f"ORD_{uuid.uuid4().hex[:10]}"
        r = session.get(
            f"{API}/add_balance.php",
            params={
                "key": api_key,
                "paytm": test_user["mobile"],
                "amount": "55.5",
                "comment": "TEST credit",
                "order_id": order_id,
            },
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("text/plain")
        assert r.text.startswith("SUCCESS"), r.text

        # also verify the credit landed by fetching wallet via admin
        # (we don't have user token here, just persist proof via duplicate retry)
        # save order_id for the duplicate test
        TestGatewayCredit._used_order_id = order_id

    def test_duplicate_detection_returns_409(self, session, api_key, test_user):
        # (f) same order_id twice -> 409
        order_id = getattr(TestGatewayCredit, "_used_order_id", None)
        assert order_id, "previous test must run first"
        r = session.get(
            f"{API}/add_balance.php",
            params={
                "key": api_key,
                "paytm": test_user["mobile"],
                "amount": "55.5",
                "comment": "TEST credit dup",
                "order_id": order_id,
            },
        )
        assert r.status_code == 409, r.text
        assert "Duplicate" in r.text

    def test_valid_credit_success_json(self, session, api_key, test_user):
        # (g) format=json returns JSON with ref_id, txn_id, new_balance
        order_id = f"ORD_{uuid.uuid4().hex[:10]}"
        r = session.get(
            f"{API}/add_balance.php",
            params={
                "key": api_key,
                "paytm": test_user["mobile"],
                "amount": "12.34",
                "comment": "TEST json credit",
                "order_id": order_id,
                "format": "json",
            },
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("application/json"), r.headers["content-type"]
        body = r.json()
        assert body["status"] == "SUCCESS"
        assert "txn_id" in body and isinstance(body["txn_id"], str)
        assert "ref_id" in body and isinstance(body["ref_id"], str)
        assert "new_balance" in body and float(body["new_balance"]) > 0
        assert body.get("order_id") == order_id

    def test_format_default_is_text(self, session, api_key, test_user):
        r = session.get(
            f"{API}/add_balance.php",
            params={"key": api_key, "paytm": test_user["mobile"], "amount": "1", "order_id": f"ORD_{uuid.uuid4().hex[:8]}"},
        )
        assert r.headers["content-type"].startswith("text/plain")


# ===================== Admin transactions filters =====================
class TestAdminTransactionsFilters:
    """Refactor regression: _build_tx_filter + _enrich_tx_with_users."""

    def test_basic_list_has_required_keys(self, session, admin_headers):
        r = session.get(f"{API}/admin/transactions", headers=admin_headers, params={"limit": 20})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert "total" in data and isinstance(data["total"], int)
        assert "summary" in data and isinstance(data["summary"], list)

    def test_filter_type_credit(self, session, admin_headers):
        r = session.get(f"{API}/admin/transactions", headers=admin_headers, params={"type": "credit", "limit": 50})
        assert r.status_code == 200
        items = r.json()["items"]
        # all items should be credit
        for it in items:
            assert it["type"] == "credit", it

    def test_filter_status_completed(self, session, admin_headers):
        r = session.get(f"{API}/admin/transactions", headers=admin_headers, params={"status": "completed", "limit": 50})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["status"] == "completed"

    def test_filter_amount_range(self, session, admin_headers):
        r = session.get(
            f"{API}/admin/transactions",
            headers=admin_headers,
            params={"min_amount": 50, "max_amount": 60, "limit": 50},
        )
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert 50 <= it["amount"] <= 60, it

    def test_filter_date_range(self, session, admin_headers):
        # Use a very wide window — we just want to check the endpoint accepts it
        r = session.get(
            f"{API}/admin/transactions",
            headers=admin_headers,
            params={"from_date": "2020-01-01", "to_date": "2099-12-31", "limit": 5},
        )
        assert r.status_code == 200

    def test_search_q_and_enrichment(self, session, admin_headers):
        # Get a tx, then search by its ref_id
        base = session.get(f"{API}/admin/transactions", headers=admin_headers, params={"type": "credit", "limit": 1}).json()
        assert base["items"], "need at least one credit tx in DB"
        sample = base["items"][0]
        # enrichment check
        assert "user_name" in sample, "missing user_name (enrichment)"
        assert "user_mobile" in sample, "missing user_mobile (enrichment)"
        # q search
        r = session.get(f"{API}/admin/transactions", headers=admin_headers, params={"q": sample["ref_id"]})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(it["ref_id"] == sample["ref_id"] for it in items)


# ===================== Telegram refactor =====================
class TestTelegramRefactor:
    def test_telegram_test_endpoint_returns_ok(self, session, admin_headers):
        r = session.post(f"{API}/admin/settings/telegram/test", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
