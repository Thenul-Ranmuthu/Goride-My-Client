"""
Sign in through the real Asgardeo flow and print the Cookie header that Postman,
JMeter and curl all need.

The session cookie is HttpOnly, so it cannot be read from the page with
JavaScript. WebDriver can read it, which is the whole point of this script.

    python grab_session_cookie.py --role driver
    python grab_session_cookie.py --role admin
    python grab_session_cookie.py --role rider

Each role gets its own Chrome profile directory, so signing in as the admin does
not destroy the driver session the way it does in one browser window.

By default you sign in by hand in the window that opens. To script it instead,
set the credentials as environment variables first (never put them in this file):

    $env:GORIDE_USER = "driver@example.com"
    $env:GORIDE_PASS = "..."

The result is written to .sessions/<role>.txt beside this script and printed to the terminal.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

API = os.environ.get("GORIDE_API", "https://localhost:7136")

ROOT = Path(__file__).resolve().parent
SESSIONS = ROOT / ".sessions"
PROFILES = ROOT / ".chrome-profiles"

LOGIN_TIMEOUT = 300  # five minutes to sign in by hand, MFA included


def _chrome(profile_dir: Path, headless: bool) -> webdriver.Chrome:
    opts = Options()
    # The API runs on the .NET developer certificate; without these Chrome shows
    # an interstitial that the driver cannot click past.
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument(f"--user-data-dir={profile_dir}")
    opts.add_argument("--window-size=1280,900")
    if headless:
        opts.add_argument("--headless=new")
    # Do NOT add excludeSwitches=["enable-automation"] here: on Chrome 152 it makes
    # the browser exit at startup in windowed mode (SessionNotCreatedException).
    # Selenium Manager downloads the matching chromedriver on first run.
    return webdriver.Chrome(options=opts)


def build_driver(role: str, headless: bool) -> webdriver.Chrome:
    """
    Start Chrome on this role's own profile.

    A Chrome that died badly keeps a lock on its profile directory, and every
    later run against that directory fails with "Chrome failed to start:
    crashed". Rather than hunting down the stale process - it may be sitting
    among the user's real browser windows - fall back to a fresh directory.
    """
    preferred = PROFILES / role
    try:
        return _chrome(preferred, headless)
    except WebDriverException as first_error:
        spare = PROFILES / f"{role}-{int(time.time())}"
        print(f"  the '{preferred.name}' profile is locked by a stale Chrome; "
              f"using '{spare.name}' instead")
        try:
            return _chrome(spare, headless)
        except WebDriverException:
            raise first_error


def try_scripted_login(driver: webdriver.Chrome) -> bool:
    """Fill the Asgardeo form when credentials are in the environment."""
    user = os.environ.get("GORIDE_USER")
    password = os.environ.get("GORIDE_PASS")
    if not (user and password):
        return False

    for _ in range(30):
        try:
            username_box = driver.find_element(By.CSS_SELECTOR, "input[name='username']")
            password_box = driver.find_element(By.CSS_SELECTOR, "input[name='password']")
            username_box.clear()
            username_box.send_keys(user)
            password_box.clear()
            password_box.send_keys(password)
            driver.find_element(
                By.CSS_SELECTOR, "button[type='submit'], input[type='submit']"
            ).click()
            print("  submitted the sign-in form from GORIDE_USER / GORIDE_PASS")
            return True
        except NoSuchElementException:
            time.sleep(1)

    print("  could not find the sign-in form - finish signing in by hand")
    return False


def wait_for_return(driver: webdriver.Chrome) -> str:
    """
    Wait for the identity provider to hand control back.

    This must NOT navigate. While you are typing into the Asgardeo form, any
    driver.get() here would throw the login away and you could never finish.
    """
    deadline = time.time() + LOGIN_TIMEOUT
    announced = False

    while time.time() < deadline:
        try:
            url = driver.current_url
        except WebDriverException:
            raise RuntimeError("the browser window was closed before sign-in finished")

        back_on_our_app = url.startswith(("http://localhost", "https://localhost"))
        still_handing_off = "/login" in url or "/signin-oidc" in url

        if back_on_our_app and not still_handing_off:
            return url

        if not announced and not back_on_our_app:
            print("  sign in in the Chrome window - nothing here will touch it until you are done")
            announced = True
        time.sleep(1)

    raise TimeoutError(f"still not signed in after {LOGIN_TIMEOUT}s")


def read_identity(driver: webdriver.Chrome) -> dict:
    """Now that the session exists, read it from /api/me."""
    last = ""
    for _ in range(8):
        try:
            driver.get(f"{API}/api/me")
            last = (driver.execute_script("return document.body.innerText;") or "").strip()
            payload = json.loads(last)
            if isinstance(payload, dict) and payload.get("userId"):
                return payload
        except (json.JSONDecodeError, WebDriverException):
            pass
        time.sleep(2)

    raise RuntimeError(
        "the browser came back from the identity provider but /api/me still refuses the "
        f"session.\n  Last response: {last[:200] or '(empty - most likely a 401 page)'}"
    )


def cookie_header(driver: webdriver.Chrome) -> str:
    """Assemble the full Cookie header, chunks in the order ASP.NET expects."""
    parts = [c for c in driver.get_cookies() if c["name"].startswith("app_session")]
    if not parts:
        raise RuntimeError("no app_session cookie found - did the sign-in complete?")

    def order(cookie: dict) -> tuple[int, str]:
        # app_session first, then app_sessionC1, C2, ...
        return (0, "") if cookie["name"] == "app_session" else (1, cookie["name"])

    parts.sort(key=order)
    return "; ".join(f"{c['name']}={c['value']}" for c in parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--role", default="driver", choices=["driver", "admin", "rider"])
    ap.add_argument("--headless", action="store_true",
                    help="only works with GORIDE_USER / GORIDE_PASS set")
    args = ap.parse_args()

    SESSIONS.mkdir(exist_ok=True)
    PROFILES.mkdir(exist_ok=True)

    print(f"\nCapturing a {args.role.upper()} session from {API}")
    driver = build_driver(args.role, args.headless)

    try:
        # Land back on /api/me rather than the frontend: the JSON is proof the
        # session works, and nothing here needs localhost:3000 to be running.
        driver.get(f"{API}/login?returnUrl={API}/api/me")
        try_scripted_login(driver)
        landed = wait_for_return(driver)
        print(f"  back on {landed}")
        identity = read_identity(driver)
        header = cookie_header(driver)
    finally:
        driver.quit()

    roles = identity.get("roles") or []
    expected = args.role.capitalize()

    print("\n  userId :", identity.get("userId"))
    print("  email  :", identity.get("email"))
    print("  roles  :", ", ".join(roles) if roles else "(none)")
    if expected not in roles:
        print(f"\n  WARNING: this account has no {expected} role.")
        if expected == "Driver":
            print("  Call POST /api/onboarding/select-role with {\"role\":\"Driver\"}, "
                  "then sign out and in again.")
        elif expected == "Admin":
            print("  Assign the Admin role in the Asgardeo console, then sign out and in again.")

    out = SESSIONS / f"{args.role}.txt"
    out.write_text(header, encoding="utf-8")

    print("\n  Cookie header (paste into Postman / JMeter):\n")
    print(header)
    print(f"\n  also written to {out}")
    print(f"  chunks captured: {header.count('app_session')}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
