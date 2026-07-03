# JARVIS Garmin shim — tiny Flask service that talks to Garmin Connect via
# garth, authenticating from a token generated ONCE (Garmin blocks logins from
# most cloud IPs). Reuses the token an existing deployment already holds:
# reads GARMIN_TOKEN_B64 (garth dumps() base64) or GARTH_TOKEN, or the token
# directory GARMINTOKENS.
#
# Endpoints (all except /health require the X-Shim-Secret header):
#   GET /health                     — liveness + token status (no auth)
#   GET /garmin/activities?limit=60 — native Garmin activity list JSON
#   GET /garmin/scheduled-runs      — upcoming coach/scheduled workouts

import base64
import os
from datetime import date

from flask import Flask, jsonify, request
import garth

app = Flask(__name__)
SHIM_SECRET = os.environ.get("GARMIN_SHIM_SECRET") or os.environ.get("SHIM_SECRET") or ""

_loaded = False
_load_error = None


def _ensure_client():
    """Load the Garmin session once. Tries every token format we might have."""
    global _loaded, _load_error
    if _loaded:
        return garth
    errors = []

    raw = os.environ.get("GARMIN_TOKEN_B64") or os.environ.get("GARTH_TOKEN")
    if raw:
        raw = raw.strip()
        # 1) garth dumps() base64 string, loaded directly
        try:
            garth.client.loads(raw)
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"loads(raw): {e}")
        # 2) base64 of a garth dumps() string (double-encoded)
        try:
            garth.client.loads(base64.b64decode(raw).decode())
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"loads(b64decode): {e}")

    # 3) a token directory on disk (GARMINTOKENS)
    tokendir = os.environ.get("GARMINTOKENS")
    if tokendir:
        try:
            garth.resume(os.path.expanduser(tokendir))
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"resume({tokendir}): {e}")

    _load_error = " | ".join(errors) or "no token env var set (GARMIN_TOKEN_B64 / GARTH_TOKEN / GARMINTOKENS)"
    raise RuntimeError(_load_error)


def _auth_ok():
    return SHIM_SECRET and request.headers.get("X-Shim-Secret") == SHIM_SECRET


@app.get("/health")
def health():
    try:
        _ensure_client()
        return jsonify({"ok": True, "token_loaded": True})
    except Exception:  # noqa: BLE001
        return jsonify({"ok": False, "token_loaded": False, "error": _load_error}), 200


@app.get("/garmin/activities")
def activities():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    try:
        limit = min(int(request.args.get("limit", 60)), 200)
    except ValueError:
        limit = 60
    try:
        acts = _ensure_client().connectapi(
            "/activitylist-service/activities/search/activities",
            params={"start": 0, "limit": limit},
        )
        return jsonify({"activities": acts or []})
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": str(e)}), 502


@app.get("/garmin/scheduled-runs")
def scheduled_runs():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    today = date.today()
    runs = []
    try:
        client = _ensure_client()
        for off in (0, 1):
            y = today.year + (today.month - 1 + off) // 12
            m = (today.month - 1 + off) % 12  # calendar-service months are 0-based
            cal = client.connectapi(f"/calendar-service/year/{y}/month/{m}") or {}
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
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
