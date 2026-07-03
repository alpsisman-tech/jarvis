# JARVIS Garmin shim

Small Flask+garth service giving the JARVIS app reliable Garmin access
(activities + coach schedule) from a token generated on your own machine —
because Garmin blocks direct logins from cloud IPs.

## Deploy (Railway, ~10 min)

1. **Token (on your PC):**
   ```
   pip install garth
   python get_garmin_token.py
   ```
   Log in (MFA prompt appears if enabled) → copy the long token it prints.

2. **Railway:** New → Deploy from GitHub repo → pick `alpsisman-tech/jarvis`
   → after it appears, open the service → Settings:
   - **Root Directory**: `shim`
   - Variables: `SHIM_SECRET` = any long random string, `GARTH_TOKEN` = the token from step 1
   - Networking → Generate Domain → copy the URL

3. **Netlify (the app):** set `GARMIN_SHIM_URL` = that URL and
   `GARMIN_SHIM_SECRET` = the same secret → Trigger deploy.

4. **Test:** app → Settings → Garmin → Sync now → expect
   `coach_runs_planned` and `shim_activities` counts.

The token lasts ~1 year (garth refreshes the short-lived part itself).
If Garmin ever invalidates it, re-run step 1 and update `GARTH_TOKEN`.
