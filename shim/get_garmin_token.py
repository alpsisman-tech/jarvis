# Run ONCE, on your PC (not a server) — Garmin blocks logins from cloud IPs.
# Prints a garth token to paste into Railway as GARTH_TOKEN. After this, the
# shim refreshes itself forever without ever logging in again.
#
#   pip install garth==0.8.0
#   python get_garmin_token.py
#
# If you get HTTP 429 "Too Many Requests": Garmin is throttling logins. Stop
# all attempts, wait a few hours (overnight is safest), and try ONE more time
# — ideally from a different network (phone hotspot) in case it's IP-based.

from getpass import getpass

import garth


def main():
    email = input("Garmin email: ").strip()
    password = getpass("Garmin password (hidden): ")
    garth.login(email, password)  # prompts for an MFA code if your account has one
    token = garth.client.dumps()
    print("\n✅ Logged in. Copy EVERYTHING between the lines into Railway as GARTH_TOKEN:\n")
    print("-" * 60)
    print(token)
    print("-" * 60)
    print("\nThen in Railway (the 'agent' service) → Variables:")
    print("  • add GARTH_TOKEN = the string above")
    print("  • the old GARMIN_TOKEN_B64 can be deleted")


if __name__ == "__main__":
    main()
