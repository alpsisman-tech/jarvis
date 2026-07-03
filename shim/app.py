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
import json
import os
from datetime import date

from flask import Flask, jsonify, request
import garth

app = Flask(__name__)
SHIM_SECRET = os.environ.get("GARMIN_SHIM_SECRET") or os.environ.get("SHIM_SECRET") or ""
TOKENDIR = os.path.expanduser(os.environ.get("GARMINTOKENS") or "/app/tokens")

_loaded = False
_load_error = None


def _b64(raw: str) -> bytes:
    """Padding-tolerant base64 decode (env vars sometimes lose '=')."""
    raw = "".join(raw.split())
    return base64.b64decode(raw + "=" * (-len(raw) % 4))


def _write_token_dir(data) -> None:
    """Reconstruct garth's oauth1/oauth2 json files from a decoded blob."""
    if isinstance(data, dict) and ("oauth1_token" in data or "oauth2" in data):
        o1 = data.get("oauth1_token") or data.get("oauth1")
        o2 = data.get("oauth2_token") or data.get("oauth2")
    elif isinstance(data, (list, tuple)) and len(data) >= 2:
        o1, o2 = data[0], data[1]
    else:
        raise RuntimeError(f"unrecognized token structure: {type(data).__name__}")
    os.makedirs(TOKENDIR, exist_ok=True)
    with open(os.path.join(TOKENDIR, "oauth1_token.json"), "w") as f:
        json.dump(o1, f)
    with open(os.path.join(TOKENDIR, "oauth2_token.json"), "w") as f:
        json.dump(o2, f)


def _ensure_client():
    """Load the Garmin session once, from whatever token form we were given."""
    global _loaded, _load_error
    if _loaded:
        return garth
    errors = []
    raw = (os.environ.get("GARMIN_TOKEN_B64") or os.environ.get("GARTH_TOKEN") or "").strip()

    # Preferred: GARMIN_TOKEN_B64 is base64(JSON) → rebuild token dir → resume
    if raw:
        try:
            data = json.loads(_b64(raw))
            _write_token_dir(data)
            garth.resume(TOKENDIR)
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"b64-json->resume: {e}")
        # Maybe it's raw JSON (not base64)
        try:
            data = json.loads(raw)
            _write_token_dir(data)
            garth.resume(TOKENDIR)
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"json->resume: {e}")
        # Maybe it's garth's own dumps() string
        try:
            garth.client.loads(raw)
            _loaded = True
            return garth
        except Exception as e:  # noqa: BLE001
            errors.append(f"garth.loads: {e}")

    # Token files already present on disk (GARMINTOKENS mounted)
    try:
        garth.resume(TOKENDIR)
        _loaded = True
        return garth
    except Exception as e:  # noqa: BLE001
        errors.append(f"resume({TOKENDIR}): {e}")

    _load_error = " | ".join(errors) or "no token available"
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


# Structure of the token blob (keys/types only, never values) — for debugging
# the token format without leaking the secret. Requires the shim secret.
@app.get("/debug/token")
def debug_token():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    raw = (os.environ.get("GARMIN_TOKEN_B64") or os.environ.get("GARTH_TOKEN") or "").strip()
    info = {"raw_len": len(raw), "raw_head": raw[:8]}
    try:
        dec = _b64(raw)
        info["b64_decoded_len"] = len(dec)
        try:
            j = json.loads(dec)
            info["json_type"] = type(j).__name__
            if isinstance(j, dict):
                info["keys"] = list(j.keys())
            elif isinstance(j, list):
                info["list_len"] = len(j)
                info["item_types"] = [type(x).__name__ for x in j[:4]]
        except Exception as e:  # noqa: BLE001
            info["decoded_head"] = dec[:60].decode("utf-8", "replace")
            info["json_error"] = str(e)
    except Exception as e:  # noqa: BLE001
        info["b64_error"] = str(e)
    return jsonify(info)


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
