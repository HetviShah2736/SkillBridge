"""Backend tests for analytics + admin endpoints."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://skill-bridge-271.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "hetvikshah14@gmail.com"
ADMIN_PASS = "admin1234"
NON_ADMIN_EMAIL = "test1@sb.dev"
NON_ADMIN_PASS = "test1234"


def _login_or_register(email, password, full_name):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code == 200:
        return r.json()
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "full_name": full_name}, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_auth():
    return _login_or_register(ADMIN_EMAIL, ADMIN_PASS, "Hetvik Shah")


@pytest.fixture(scope="module")
def user_auth():
    return _login_or_register(NON_ADMIN_EMAIL, NON_ADMIN_PASS, "Test User")


@pytest.fixture(scope="module")
def admin_headers(admin_auth):
    return {"Authorization": f"Bearer {admin_auth['token']}"}


@pytest.fixture(scope="module")
def user_headers(user_auth):
    return {"Authorization": f"Bearer {user_auth['token']}"}


# --- Auth returns is_admin correctly ---
def test_admin_login_is_admin_true(admin_auth):
    assert admin_auth["user"]["is_admin"] is True
    assert admin_auth["user"]["email"] == ADMIN_EMAIL


def test_non_admin_login_is_admin_false(user_auth):
    assert user_auth["user"]["is_admin"] is False


def test_me_reflects_is_admin(admin_headers, user_headers):
    r1 = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=10)
    assert r1.status_code == 200
    assert r1.json()["is_admin"] is True
    r2 = requests.get(f"{API}/auth/me", headers=user_headers, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["is_admin"] is False


# --- Register logs signup event and returns is_admin ---
def test_register_returns_is_admin_false_for_new_user():
    email = f"test_{uuid.uuid4().hex[:8]}@sb.dev"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "full_name": "Rand"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["user"]["is_admin"] is False


# --- Pageview endpoint ---
def test_pageview_anonymous():
    r = requests.post(f"{API}/events/pageview", json={
        "path": "/test-anon",
        "session_id": f"sess-{uuid.uuid4().hex[:8]}",
        "referrer": "https://google.com/search",
        "utm_source": "", "utm_medium": "", "utm_campaign": "",
        "title": "Anon Test",
    }, timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_pageview_authenticated(user_headers):
    r = requests.post(f"{API}/events/pageview", headers=user_headers, json={
        "path": "/dashboard",
        "session_id": f"sess-{uuid.uuid4().hex[:8]}",
        "referrer": "", "utm_source": "twitter", "title": "Dash",
    }, timeout=10)
    assert r.status_code == 200


# --- Admin auth guards ---
def test_admin_endpoints_401_without_token():
    for path in ["/admin/overview", "/admin/timeseries", "/admin/top-pages",
                 "/admin/traffic-sources", "/admin/recent-activity", "/admin/users"]:
        r = requests.get(f"{API}{path}", timeout=10)
        assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"


def test_admin_endpoints_403_for_non_admin(user_headers):
    for path in ["/admin/overview", "/admin/timeseries", "/admin/top-pages",
                 "/admin/traffic-sources", "/admin/recent-activity", "/admin/users"]:
        r = requests.get(f"{API}{path}", headers=user_headers, timeout=10)
        assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"


# --- Admin overview ---
def test_admin_overview(admin_headers):
    r = requests.get(f"{API}/admin/overview", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_users", "dau", "wau", "mau", "signups_24h", "signups_7d",
              "logins_24h", "logins_7d", "pageviews_24h", "pageviews_7d", "unique_visitors_24h"]:
        assert k in d, f"missing {k}"
        assert isinstance(d[k], int)
    assert d["total_users"] >= 1


def test_admin_timeseries(admin_headers):
    r = requests.get(f"{API}/admin/timeseries?days=14", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) == 14
    for row in arr:
        for k in ["date", "signups", "logins", "pageviews", "sessions", "active_users"]:
            assert k in row


def test_admin_top_pages(admin_headers):
    r = requests.get(f"{API}/admin/top-pages", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    if arr:
        assert "path" in arr[0] and "views" in arr[0]


def test_admin_traffic_sources(admin_headers):
    # Seed a pageview with a known referrer
    requests.post(f"{API}/events/pageview", json={
        "path": "/x", "session_id": f"s-{uuid.uuid4().hex[:6]}",
        "referrer": "https://www.google.com/", "utm_source": "", "utm_medium": "", "utm_campaign": "", "title": "",
    }, timeout=10)
    r = requests.get(f"{API}/admin/traffic-sources", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    if arr:
        sources = [row["source"] for row in arr]
        # At least one of these classifiers should be present
        assert any(s in ("google", "direct") or s.startswith("utm:") or s.startswith("ref:") for s in sources)


def test_admin_recent_activity(admin_headers):
    r = requests.get(f"{API}/admin/recent-activity?limit=10", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)


def test_admin_users_no_password_hash(admin_headers):
    r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1
    for u in arr:
        assert "password_hash" not in u
        assert "id" in u and "email" in u and "is_admin" in u
        assert "last_active" in u and "event_count" in u
    # admin user must have is_admin=True
    admin_row = next((u for u in arr if u["email"] == ADMIN_EMAIL), None)
    assert admin_row and admin_row["is_admin"] is True
