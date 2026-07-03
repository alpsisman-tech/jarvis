# JARVIS Garmin shim — tiny Flask service that talks to Garmin Connect via
# garth. Deployed somewhere with a residential-friendly reputation (Railway)
# because Garmin blocks logins from most cloud IPs; auth happens ONCE locally
# (get_garmin_token.py) and the resulting token is supplied as GARTH_TOKEN.
#
# Endpoints (all require the X-Shim-Secret header):
#   GET /health                     — liveness, no auth
#   GET /garmin/activities?limit=60 — native Garmin activity list JSON
#   GET /garmin/scheduled-runs      — upcoming coach/scheduled workouts

import os
from datetime import date

from flask import Flask, jsonify, request
import garth

app = Flask(__name__)
SHIM_SECRET = os.environ.get("SHIM_SECRET", "")

_loaded = False


def _client():
    global _loaded
    if not _loaded:
        token = os.environ.get("GARTH_TOKEN", "")
        if not token:
            raise RuntimeError("GARTH_TOKEN env var is not set")
        garth.client.loads(token)
        _loaded = True
    return garth


def _unauthorized():
    return jsonify({"error": "unauthorized"}), 401


@app.get("/health")
def health():
    return jsonify({"ok": True, "token_loaded": _loaded})


@app.get("/garmin/activities")
def activities():
    if not SHIM_SECRET or request.headers.get("X-Shim-Secret") != SHIM_SECRET:
        return _unauthorized()
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
    except Exception as e:  # surface the real error for debugging
        return jsonify({"error": str(e)}), 502


@app.get("/garmin/scheduled-runs")
def scheduled_runs():
    if not SHIM_SECRET or request.headers.get("X-Shim-Secret") != SHIM_SECRET:
        return _unauthorized()
    today = date.today()
    runs = []
    try:
        for off in (0, 1):
            # calendar-service months are 0-based (January = 0)
            y = today.year + (today.month - 1 + off) // 12
            m = (today.month - 1 + off) % 12
            cal = _client().connectapi(f"/calendar-service/year/{y}/month/{m}") or {}
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
    except Exception as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
