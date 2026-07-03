# JARVIS Garmin shim — Flask service that reads Garmin using the "DI"
# (Digital Identity) OAuth2 tokens the existing deployment already holds:
# GARMIN_TOKEN_B64 = base64(JSON) with di_token / di_refresh_token /
# di_client_id. We refresh the access token via Garmin's DI token endpoint
# (NOT the throttled SSO login) and call connectapi with a bearer header.
#
# Endpoints (all except /health require the X-Shim-Secret header):
#   GET /health                     — liveness + auth status (no auth)
#   GET /garmin/activities?limit=60 — native Garmin activity list JSON
#   GET /garmin/scheduled-runs      — upcoming coach/scheduled workouts
#   GET /debug/token, /debug/refresh — secret-gated diagnostics

import base64
import json
import os
import time
from datetime import date

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)
SHIM_SECRET = os.environ.get("GARMIN_SHIM_SECRET") or os.environ.get("SHIM_SECRET") or ""

CONNECTAPI = "https://connectapi.garmin.com"
DIAUTH_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token"
UA = "com.garmin.android.apps.connectmobile"

_access_token = None
_access_exp = 0.0
_refresh_token = None  # rotates; keep the newest in memory


def _b64(raw: str) -> bytes:
    raw = "".join(raw.split())
    return base64.b64decode(raw + "=" * (-len(raw) % 4))


def _creds():
    """(di_token, di_refresh_token, di_client_id) from the env blob."""
    raw = (os.environ.get("GARMIN_TOKEN_B64") or os.environ.get("GARTH_TOKEN") or "").strip()
    if not raw:
        raise RuntimeError("GARMIN_TOKEN_B64 not set")
    try:
        data = json.loads(_b64(raw))
    except Exception:
        data = json.loads(raw)  # maybe stored as plain JSON
    return data.get("di_token"), data.get("di_refresh_token"), data.get("di_client_id")


def _refresh():
    global _access_token, _access_exp, _refresh_token
    di_token, di_refresh, di_client = _creds()
    rt = _refresh_token or di_refresh
    resp = requests.post(
        DIAUTH_TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": rt, "client_id": di_client},
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        timeout=20,
    )
    resp.raise_for_status()
    j = resp.json()
    _access_token = j["access_token"]
    _access_exp = time.time() + float(j.get("expires_in", 3500)) - 60
    if j.get("refresh_token"):
        _refresh_token = j["refresh_token"]
    return _access_token


def _token():
    if _access_token and time.time() < _access_exp:
        return _access_token
    # Try the stored access token directly first (cheap; skips refresh if valid)
    di_token, _, _ = _creds()
    return _refresh() if not di_token else _try_stored_or_refresh(di_token)


def _try_stored_or_refresh(di_token):
    global _access_token, _access_exp
    # Probe the stored token; if it 401s it's expired → refresh
    r = requests.get(
        f"{CONNECTAPI}/userprofile-service/userprofile",
        headers={"Authorization": f"Bearer {di_token}", "User-Agent": UA, "Accept": "application/json"},
        timeout=15,
    )
    if r.status_code == 200:
        _access_token = di_token
        _access_exp = time.time() + 300  # unknown expiry; re-check soon
        return di_token
    return _refresh()


def _api(path, params=None):
    t = _token()
    headers = {"Authorization": f"Bearer {t}", "User-Agent": UA, "Accept": "application/json", "DI-Backend": "connectapi.garmin.com"}
    r = requests.get(CONNECTAPI + path, params=params, headers=headers, timeout=25)
    if r.status_code == 401:
        t = _refresh()
        headers["Authorization"] = f"Bearer {t}"
        r = requests.get(CONNECTAPI + path, params=params, headers=headers, timeout=25)
    r.raise_for_status()
    return r.json()


def _auth_ok():
    return SHIM_SECRET and request.headers.get("X-Shim-Secret") == SHIM_SECRET


@app.get("/health")
def health():
    try:
        _token()
        return jsonify({"ok": True, "authenticated": True})
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "authenticated": False, "error": str(e)[:300]}), 200


@app.get("/garmin/activities")
def activities():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    try:
        limit = min(int(request.args.get("limit", 60)), 200)
    except ValueError:
        limit = 60
    try:
        acts = _api("/activitylist-service/activities/search/activities", {"start": 0, "limit": limit})
        return jsonify({"activities": acts or []})
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": str(e)[:300]}), 502


@app.get("/garmin/scheduled-runs")
def scheduled_runs():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    today = date.today()
    runs = []
    try:
        for off in (0, 1):
            y = today.year + (today.month - 1 + off) // 12
            m = (today.month - 1 + off) % 12  # calendar-service months are 0-based
            cal = _api(f"/calendar-service/year/{y}/month/{m}") or {}
            for it in cal.get("calendarItems", []):
                if it.get("itemType") != "workout":
                    continue
                d = (it.get("date") or "")[:10]
                if not d or d < today.isoformat():
                    continue
                title = it.get("title") or "Workout"
                runs.append({
                    "date": d,
                    "sport": it.get("sportTypeKey") or "running",
                    "title": title,
                    "type": title,
                    "workoutUuid": str(it.get("workoutUuid") or it.get("id") or f"{d}-{title}"),
                })
        runs.sort(key=lambda r: r["date"])
        return jsonify({"runs": runs})
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": str(e)[:300]}), 502


@app.get("/debug/token")
def debug_token():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    raw = (os.environ.get("GARMIN_TOKEN_B64") or "").strip()
    info = {"raw_len": len(raw)}
    try:
        j = json.loads(_b64(raw))
        info["keys"] = list(j.keys()) if isinstance(j, dict) else type(j).__name__
    except Exception as e:  # noqa: BLE001
        info["error"] = str(e)[:200]
    return jsonify(info)


@app.get("/debug/refresh")
def debug_refresh():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    try:
        _, di_refresh, di_client = _creds()
        resp = requests.post(
            DIAUTH_TOKEN_URL,
            data={"grant_type": "refresh_token", "refresh_token": _refresh_token or di_refresh, "client_id": di_client},
            headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
            timeout=20,
        )
        return jsonify({"status": resp.status_code, "body_head": resp.text[:300]})
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": str(e)[:300]}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
