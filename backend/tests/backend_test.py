"""DigiWallet V2 backend API tests."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fintech-v2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "Admin@123"


def _rand_mobile():
    # 10-digit numeric mobile in 7xxxxxxxxx range
    return "7" + str(uuid.uuid4().int)[:9]


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"mobile_number": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_ctx(session):
    mobile = _rand_mobile()
    payload = {
        "full_name": "TEST User",
        "mobile_number": mobile,
        "password": "Test@123",
        "confirm_password": "Test@123",
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "mobile": mobile,
        "password": "Test@123",
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"},
    }


# ----------------------- Auth -----------------------
class TestAuth:
    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_register_duplicate_mobile(self, session, user_ctx):
        r = session.post(f"{API}/auth/register", json={
            "full_name": "Dup", "mobile_number": user_ctx["mobile"],
            "password": "Test@123", "confirm_password": "Test@123",
        })
        assert r.status_code == 400

    def test_register_password_mismatch(self, session):
        r = session.post(f"{API}/auth/register", json={
            "full_name": "Mismatch User", "mobile_number": _rand_mobile(),
            "password": "Test@123", "confirm_password": "Other@123",
        })
        assert r.status_code == 400

    def test_login_invalid_password(self, session, user_ctx):
        r = session.post(f"{API}/auth/login", json={
            "mobile_number": user_ctx["mobile"], "password": "wrong"})
        assert r.status_code == 401

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_valid_user(self, session, user_ctx):
        r = session.post(f"{API}/auth/login", json={
            "mobile_number": user_ctx["mobile"], "password": user_ctx["password"]})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and body["user"]["mobile_number"] == user_ctx["mobile"]

    def test_me(self, session, user_ctx):
        r = session.get(f"{API}/auth/me", headers=user_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["mobile_number"] == user_ctx["mobile"]

    def test_change_password_wrong_current(self, session, user_ctx):
        r = session.post(f"{API}/auth/change-password",
                         headers=user_ctx["headers"],
                         json={"current_password": "WRONG", "new_password": "NewPass@1"})
        assert r.status_code == 400

    def test_brute_force_lockout(self, session):
        # Use a fresh mobile that doesn't exist
        bad_mobile = _rand_mobile()
        statuses = []
        for _ in range(7):
            r = session.post(f"{API}/auth/login", json={"mobile_number": bad_mobile, "password": "bad"})
            statuses.append(r.status_code)
        # Expect at least one 429 after 5 failures
        assert 429 in statuses, f"No lockout triggered. Statuses: {statuses}"


# ----------------------- Wallet & Tx -----------------------
class TestWallet:
    def test_wallet_summary(self, session, user_ctx):
        r = session.get(f"{API}/wallet/summary", headers=user_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ["balance", "total_credits", "total_withdrawals", "pending_withdrawals_count", "pending_withdrawals_amount"]:
            assert k in d

    def test_transactions_filters(self, session, user_ctx):
        r = session.get(f"{API}/transactions?type=credit", headers=user_ctx["headers"])
        assert r.status_code == 200
        assert "items" in r.json() and "total" in r.json()


# ----------------------- API Key + Credit -----------------------
class TestCreditAPI:
    def test_get_seeded_api_key(self, session, admin_headers):
        r = session.get(f"{API}/admin/api-keys", headers=admin_headers)
        assert r.status_code == 200
        keys = r.json()
        assert len(keys) >= 1
        pytest.api_key = keys[0]["key"]
        pytest.api_key_id = keys[0]["id"]

    def test_credit_invalid_key(self, session, user_ctx):
        r = session.post(f"{API}/credit", json={
            "api_key": "INVALID_KEY", "user_id": user_ctx["user"]["id"],
            "amount": 10, "txn_id": "TEST_T1"})
        assert r.status_code == 401

    def test_credit_success(self, session, user_ctx):
        txn = f"TEST_TXN_{uuid.uuid4().hex[:8]}"
        r = session.post(f"{API}/credit", json={
            "api_key": pytest.api_key, "user_id": user_ctx["user"]["id"],
            "amount": 500.0, "txn_id": txn, "description": "TEST credit"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        pytest.test_txn_id = txn
        # Verify balance
        s = session.get(f"{API}/wallet/summary", headers=user_ctx["headers"])
        assert s.json()["balance"] >= 500.0

    def test_credit_duplicate(self, session, user_ctx):
        r = session.post(f"{API}/credit", json={
            "api_key": pytest.api_key, "user_id": user_ctx["user"]["id"],
            "amount": 500.0, "txn_id": pytest.test_txn_id})
        assert r.status_code == 409

    def test_credit_paused_key(self, session, admin_headers, user_ctx):
        # toggle
        r = session.patch(f"{API}/admin/api-keys/{pytest.api_key_id}/toggle", headers=admin_headers)
        assert r.status_code == 200
        try:
            r = session.post(f"{API}/credit", json={
                "api_key": pytest.api_key, "user_id": user_ctx["user"]["id"],
                "amount": 10, "txn_id": f"TEST_PAUSED_{uuid.uuid4().hex[:6]}"})
            assert r.status_code == 403
        finally:
            # toggle back to active
            session.patch(f"{API}/admin/api-keys/{pytest.api_key_id}/toggle", headers=admin_headers)


# ----------------------- Payment methods & withdrawal -----------------------
class TestPaymentAndWithdrawal:
    def test_add_upi_invalid(self, session, user_ctx):
        r = session.post(f"{API}/payment-methods",
                         headers=user_ctx["headers"],
                         json={"type": "upi", "upi_id": "noatsign"})
        assert r.status_code == 400

    def test_add_upi_ok(self, session, user_ctx):
        r = session.post(f"{API}/payment-methods",
                         headers=user_ctx["headers"],
                         json={"type": "upi", "upi_id": "test@upi"})
        assert r.status_code == 200
        pytest.pm_id = r.json()["id"]

    def test_list_pm(self, session, user_ctx):
        r = session.get(f"{API}/payment-methods", headers=user_ctx["headers"])
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_withdraw_insufficient(self, session, user_ctx):
        r = session.post(f"{API}/withdrawals",
                         headers=user_ctx["headers"],
                         json={"amount": 9999999, "payment_method_id": pytest.pm_id})
        assert r.status_code == 400

    def test_withdraw_success(self, session, user_ctx):
        r = session.post(f"{API}/withdrawals",
                         headers=user_ctx["headers"],
                         json={"amount": 100, "payment_method_id": pytest.pm_id})
        assert r.status_code == 200, r.text
        pytest.wd_id = r.json()["id"]

    def test_list_withdrawals(self, session, user_ctx):
        r = session.get(f"{API}/withdrawals", headers=user_ctx["headers"])
        assert r.status_code == 200 and len(r.json()) >= 1


# ----------------------- Notifications -----------------------
class TestNotifications:
    def test_list(self, session, user_ctx):
        r = session.get(f"{API}/notifications", headers=user_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "unread" in d

    def test_mark_read(self, session, user_ctx):
        r = session.post(f"{API}/notifications/read", headers=user_ctx["headers"])
        assert r.status_code == 200


# ----------------------- Admin -----------------------
class TestAdmin:
    def test_dashboard(self, session, admin_headers):
        r = session.get(f"{API}/admin/dashboard", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "active_users", "total_balance", "pending_withdrawals"]:
            assert k in d

    def test_users_list(self, session, admin_headers):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_user_detail(self, session, admin_headers, user_ctx):
        r = session.get(f"{API}/admin/users/{user_ctx['user']['id']}", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["id"] == user_ctx["user"]["id"]
        assert "login_history" in d and "sessions" in d and "recent_transactions" in d

    def test_patch_user(self, session, admin_headers, user_ctx):
        r = session.patch(f"{API}/admin/users/{user_ctx['user']['id']}",
                          headers=admin_headers,
                          json={"internal_notes": "TEST note"})
        assert r.status_code == 200

    def test_login_as(self, session, admin_headers, user_ctx):
        r = session.post(f"{API}/admin/users/{user_ctx['user']['id']}/login-as", headers=admin_headers)
        assert r.status_code == 200 and "token" in r.json()

    def test_force_logout(self, session, admin_headers, user_ctx):
        r = session.post(f"{API}/admin/users/{user_ctx['user']['id']}/force-logout", headers=admin_headers)
        assert r.status_code == 200

    def test_wallet_credit_debit_adjust(self, session, admin_headers, user_ctx):
        uid = user_ctx["user"]["id"]
        r = session.post(f"{API}/admin/wallet/credit", headers=admin_headers,
                         json={"user_id": uid, "amount": 200, "note": "TEST credit"})
        assert r.status_code == 200
        r = session.post(f"{API}/admin/wallet/debit", headers=admin_headers,
                         json={"user_id": uid, "amount": 50, "note": "TEST debit"})
        assert r.status_code == 200
        r = session.post(f"{API}/admin/wallet/adjust", headers=admin_headers,
                         json={"user_id": uid, "new_balance": 1000, "note": "TEST adjust"})
        assert r.status_code == 200

    def test_freeze_unfreeze(self, session, admin_headers, user_ctx):
        uid = user_ctx["user"]["id"]
        r = session.post(f"{API}/admin/wallet/{uid}/freeze", headers=admin_headers)
        assert r.status_code == 200
        r = session.post(f"{API}/admin/wallet/{uid}/unfreeze", headers=admin_headers)
        assert r.status_code == 200

    def test_reverse_credit_tx(self, session, admin_headers, user_ctx):
        # create a fresh credit, then reverse
        r = session.post(f"{API}/admin/wallet/credit", headers=admin_headers,
                         json={"user_id": user_ctx["user"]["id"], "amount": 11, "note": "to-rev"})
        tx_id = r.json()["txn_id"]
        r = session.post(f"{API}/admin/transactions/{tx_id}/reverse", headers=admin_headers)
        assert r.status_code == 200

    def test_withdrawals_admin_list(self, session, admin_headers):
        r = session.get(f"{API}/admin/withdrawals", headers=admin_headers)
        assert r.status_code == 200 and "items" in r.json()

    def test_withdrawals_approve_paid(self, session, admin_headers):
        wid = getattr(pytest, "wd_id", None)
        if not wid:
            pytest.skip("No withdrawal created")
        r = session.post(f"{API}/admin/withdrawals/{wid}/approve",
                         headers=admin_headers, json={"note": "TEST approve"})
        assert r.status_code == 200
        r = session.post(f"{API}/admin/withdrawals/{wid}/paid",
                         headers=admin_headers, json={"note": "TEST paid"})
        assert r.status_code == 200

    def test_withdrawals_reject_refund(self, session, admin_headers, user_ctx):
        # create new pm-based withdrawal and reject it; verify refund
        # ensure positive balance first
        session.post(f"{API}/admin/wallet/credit", headers=admin_headers,
                     json={"user_id": user_ctx["user"]["id"], "amount": 200})
        r = session.post(f"{API}/withdrawals", headers=user_ctx["headers"],
                         json={"amount": 50, "payment_method_id": pytest.pm_id})
        assert r.status_code == 200
        wid = r.json()["id"]
        before = session.get(f"{API}/wallet/summary", headers=user_ctx["headers"]).json()["balance"]
        r = session.post(f"{API}/admin/withdrawals/{wid}/reject",
                         headers=admin_headers, json={"note": "TEST reject"})
        assert r.status_code == 200
        after = session.get(f"{API}/wallet/summary", headers=user_ctx["headers"]).json()["balance"]
        assert after == before + 50

    def test_withdrawals_bulk_and_export(self, session, admin_headers):
        r = session.post(f"{API}/admin/withdrawals/bulk", headers=admin_headers,
                         json={"ids": [], "action": "approve"})
        assert r.status_code == 200
        r = session.get(f"{API}/admin/withdrawals/export", headers=admin_headers)
        assert r.status_code == 200
        assert "id,user_name" in r.text

    def test_api_keys_crud(self, session, admin_headers):
        r = session.post(f"{API}/admin/api-keys", headers=admin_headers,
                         json={"name": "TEST key", "ip_whitelist": []})
        assert r.status_code == 200
        kid = r.json()["id"]
        r = session.patch(f"{API}/admin/api-keys/{kid}/toggle", headers=admin_headers)
        assert r.status_code == 200
        r = session.delete(f"{API}/admin/api-keys/{kid}", headers=admin_headers)
        assert r.status_code == 200

    def test_api_logs(self, session, admin_headers):
        r = session.get(f"{API}/admin/api-logs", headers=admin_headers)
        assert r.status_code == 200

    def test_broadcast_all_and_selected(self, session, admin_headers, user_ctx):
        r = session.post(f"{API}/admin/notifications/broadcast",
                         headers=admin_headers,
                         json={"title": "TEST", "message": "Hello", "target": "all"})
        assert r.status_code == 200
        r = session.post(f"{API}/admin/notifications/broadcast",
                         headers=admin_headers,
                         json={"title": "TEST", "message": "Hi", "target": "selected",
                               "user_ids": [user_ctx["user"]["id"]]})
        assert r.status_code == 200

    def test_security_endpoints(self, session, admin_headers):
        r = session.get(f"{API}/admin/security/login-logs?success=false", headers=admin_headers)
        assert r.status_code == 200
        r = session.get(f"{API}/admin/security/sessions", headers=admin_headers)
        assert r.status_code == 200

    def test_settings(self, session, admin_headers):
        r = session.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        r = session.patch(f"{API}/admin/settings", headers=admin_headers,
                          json={"site_name": "DigiWallet V2"})
        assert r.status_code == 200
        r = session.post(f"{API}/admin/settings/telegram/test", headers=admin_headers)
        assert r.status_code == 200

    def test_non_admin_blocked(self, session, user_ctx):
        r = session.get(f"{API}/admin/dashboard", headers=user_ctx["headers"])
        assert r.status_code == 403
