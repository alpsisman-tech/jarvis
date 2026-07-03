# One-time, run on YOUR PC (not a server): logs into Garmin and prints the
# session token to paste into Railway as GARTH_TOKEN. Garmin blocks logins
# from cloud IPs, which is why this step is local.
#
#   pip install garth
#   python get_garmin_token.py

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


if __name__ == "__main__":
    main()
