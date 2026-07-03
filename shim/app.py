# JARVIS Garmin shim — Flask + garth. Authenticates from a token generated
# ONCE locally (get_garmin_token.py) and pasted into GARTH_TOKEN. garth then
# refreshes itself indefinitely without ever hitting Garmin's rate-limited
# login endpoint, so this token effectively never expires from normal use.
#
# Endpoints (all except /health require the X-Shim-Secret header):
#   GET /health                     — liveness + auth status (no auth)
#   GET /garmin/activities?limit=60 — native Garmin activity list JSON
#   GET /garmin/scheduled-runs      — upcoming coach/scheduled workouts

import os
from datetime import date

from flask import Flask, jsonify, request
import garth

app = Flask(__name__)
SHIM_SECRET = os.environ.get("GARMIN_SHIM_SECRET") or os.environ.get("SHIM_SECRET") or ""

_loaded = False
_err = None


def _client():
    global _loaded, _err
    if _loaded:
        return garth
    token = (os.environ.get("GARTH_TOKEN") or "").strip()
    if not token:
        _err = "GARTH_TOKEN not set — run shim/get_garmin_token.py locally and paste its output as GARTH_TOKEN"
        raise RuntimeError(_err)
    try:
        garth.client.loads(token)
        _loaded = True
        return garth
    except Exception as e:  # noqa: BLE001
        _err = f"could not load GARTH_TOKEN: {e}"
        raise RuntimeError(_err)


def _auth_ok():
    return SHIM_SECRET and request.headers.get("X-Shim-Secret") == SHIM_SECRET


@app.get("/health")
def health():
    try:
        _client()
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
        acts = _client().connectapi(
            "/activitylist-service/activities/search/activities",
            params={"start": 0, "limit": limit},
        )
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
        client = _client()
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
        return jsonify({"error": str(e)[:300]}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
