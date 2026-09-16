"""
Rider ride-planning flow: SCRUM-46, SCRUM-47, SCRUM-48, SCRUM-53, SCRUM-54, SCRUM-56,
SCRUM-68, SCRUM-69, SCRUM-84, SCRUM-85.

These are the mid-Sprint-2 stories that are actually reachable through the
frontend right now (SCRUM-127/128/129/130/132 are notification-service
stories with no UI to click through - those stay covered by the Postman
collection instead). Unlike test_ui_smoke.py, every screen here sits behind
RoleGuard/proxy.ts's session check, so these tests need a signed-in Rider,
not just a running frontend.

Needs everything up:

    .\\goride-dev.ps1 start identity
    .\\goride-dev.ps1 start trip
    .\\goride-dev.ps1 start frontend

Sign-in drives the real "Sign in" link on the landing page through to
Asgardeo and back - the same round trip test_sign_in_reaches_asgardeo
already proves works - rather than reusing grab_session_cookie.py's saved
cookie. That cookie is captured while sitting directly on the identity API's
own origin (https://localhost:7136), so it is scoped there; the frontend at
http://localhost:3000 checks a same-origin app_session cookie instead (see
proxy.ts), which only gets set when login happens through the frontend's own
/login rewrite. Signing in from APP is what makes the cookie land in the
right place.

Credentials come from GORIDE_USER / GORIDE_PASS if set - the same variables
grab_session_cookie.py reads - and default to the seeded Rider demo account
in src/lib/constants.ts (DEMO_ACCOUNTS / DEMO_PASSWORD) otherwise. If that
account's password has changed or picked up MFA, set the env vars to a
working Rider account before running this file.

Run just this file with:

    python -m pytest -v test_ride_planning.py

Sign-in defensive notes (read this if _sign_in starts failing again):

The first version of this file assumed Asgardeo's hosted login is one
combined form - both input[name='username'] and input[name='password']
present and interactable at the same time - copied from
grab_session_cookie.py's try_scripted_login. A live run proved that wrong:
every test errored inside the sign-in fixture with
ElementNotInteractableException on input[name='username']. That exception
means the element was FOUND in the DOM but could not be typed into right
then - typically because it belongs to a step that hasn't finished
transitioning in, or because Asgardeo actually splits sign-in into a
username step and a separate password step (a "Continue" button between
them), so the password field either does not exist yet or the username
field is mid-transition when a single find-and-fill pass reaches it.

_sign_in below no longer assumes either shape. It waits for each field to be
*visible* (not just present) before typing into it, advances through
whatever "Continue"/"Sign in" control is on screen after each field, and
tolerates both a one-step and a two-step form. If it still cannot get past
sign-in, it now saves a screenshot and the page source of whatever screen it
got stuck on to evidence/sign-in-stuck.png / .html before raising, so the
next failure comes with a picture of the actual login screen instead of
another guess.
"""

from __future__ import annotations

import os
import time

import pytest
from selenium import webdriver
from selenium.common.exceptions import (
    ElementNotInteractableException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import (CORE_VIEWPORTS, VIEWPORTS, APP, EVIDENCE, control_problems,
                      has_horizontal_overflow, is_touch_size, overflow_detail,
                      set_viewport, wait_settled)

RIDER_EMAIL = os.environ.get("GORIDE_USER", "rider@goride.lk")
RIDER_PASSWORD = os.environ.get("GORIDE_PASS", "goride123")
LOGIN_TIMEOUT = 300  # matches grab_session_cookie.py - real IdP round trip, MFA included

# From src/components/rider/location-search.tsx's RECENT_PLACES - used here
# because clicking one is the fastest reliable way to get both a pickup and a
# destination set without fighting the debounced address-search box.
RECENT_DESTINATION = "SLIIT Malabe Campus"
SEARCH_LANDMARK = "One Galle Face Mall"

PICKUP_SELECTOR = "input[placeholder='Add a pick-up location'], input[placeholder='Locating you…']"
DESTINATION_SELECTOR = "input[placeholder='Add a drop-off location']"

# The recent destinations RECENT_PLACES seeds the rider home page with. Used by
# the responsive checks to confirm each row is fully on screen and tappable,
# not just that the page as a whole doesn't scroll sideways.
RECENT_PLACES = ["SLIIT Malabe Campus", "One Galle Face Mall", "Colombo Fort Railway Station"]
RECENT_BUTTONS_XPATH = " | ".join(f"//button[.//span[text()='{p}']]" for p in RECENT_PLACES)


def _react_clear(field) -> None:
    """
    Empty a React-controlled text field in a way React actually notices.

    Selenium's element.clear() can reset the input's on-screen value without
    dispatching a genuine input event - fine for a plain HTML form, but the
    pickup/destination boxes here are React-controlled (SearchInput in
    location-search.tsx), so their own state only updates from a real event.
    ride-phases.tsx's SuggestionList decides whether to show "Use current
    location" from that React state (query.trim().length < 2), not from
    the DOM value, so a clear() that isn't observed leaves the field looking
    empty while the quick-action button never appears - which is exactly
    what made test_use_current_location_as_pickup time out: it clears and
    then only waits, with no keystroke afterwards to resync React's state.
    Select-all + Backspace are real key events, so React sees them either way.
    """
    field.send_keys(Keys.CONTROL, "a")
    field.send_keys(Keys.BACKSPACE)

# Exceptions that just mean "this step of the login isn't the one on screen
# right now" - not a real failure, keep polling.
_STEP_NOT_READY = (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    ElementNotInteractableException,
)


def _advance(driver) -> None:
    """Click whatever moves the current Asgardeo step forward.

    Covers a combined form's 'Sign in' submit and a split form's 'Continue'
    button with the same selector - Asgardeo's own submit control is a
    button[type='submit'] (occasionally input[type='submit']) either way.
    """
    try:
        driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']").click()
    except _STEP_NOT_READY:
        pass


def _visible(driver, css: str, timeout: float = 2.5):
    """WebDriverWait for *visible*, not just present - the bug in the first
    version was find_element (presence only) followed immediately by
    send_keys, which races Asgardeo's step transition/animation and throws
    ElementNotInteractableException when it loses."""
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, css))
    )


def _dump_stuck_state(driver, reason: str) -> None:
    """Best-effort screenshot + page source of wherever sign-in got stuck,
    so a failure here comes with evidence instead of just a timeout message."""
    try:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        driver.save_screenshot(str(EVIDENCE / "sign-in-stuck.png"))
        (EVIDENCE / "sign-in-stuck.html").write_text(driver.page_source, encoding="utf-8")
        (EVIDENCE / "sign-in-stuck.txt").write_text(
            f"{reason}\nstuck at: {driver.current_url}\n", encoding="utf-8"
        )
    except Exception:
        pass  # evidence-gathering must never mask the real failure


def _sign_in(driver) -> None:
    """Drive Sign in -> Asgardeo -> back on localhost:3000, the same way a real rider would.

    Handles both a combined username+password form and a split
    username-then-Continue-then-password form, since the real shape was not
    confirmed live before the first version shipped and turned out to be
    wrong (see module docstring).
    """
    driver.get(APP)
    links = driver.find_elements(By.PARTIAL_LINK_TEXT, "Sign in")
    assert links, "no 'Sign in' link on the landing page - can't authenticate"
    links[0].click()

    stage = "username"  # -> "password" -> "waiting"
    deadline = time.time() + LOGIN_TIMEOUT

    while time.time() < deadline:
        url = driver.current_url
        if url.startswith(("http://localhost:3000", "https://localhost:3000")) and "/login" not in url:
            return

        if stage == "username":
            try:
                username_box = _visible(driver, "input[name='username']")
                username_box.clear()
                username_box.send_keys(RIDER_EMAIL)
                # A combined form has the password field already on screen
                # too - fill it now and submit once, rather than advancing
                # to a "password" stage that will never see a fresh step.
                try:
                    password_box = driver.find_element(By.CSS_SELECTOR, "input[name='password']")
                    if password_box.is_displayed():
                        password_box.clear()
                        password_box.send_keys(RIDER_PASSWORD)
                        _advance(driver)
                        stage = "waiting"
                        time.sleep(1)
                        continue
                except _STEP_NOT_READY:
                    pass
                # Split form: username-only step, advance to the password step.
                _advance(driver)
                stage = "password"
            except _STEP_NOT_READY:
                pass  # username step not on screen yet (or already past it)

        elif stage == "password":
            try:
                password_box = _visible(driver, "input[name='password']")
                password_box.clear()
                password_box.send_keys(RIDER_PASSWORD)
                _advance(driver)
                stage = "waiting"
            except _STEP_NOT_READY:
                pass  # password step still transitioning in

        # stage == "waiting": nothing to do but keep polling for the app URL.
        time.sleep(1)

    _dump_stuck_state(
        driver,
        f"still not signed in as {RIDER_EMAIL} after {LOGIN_TIMEOUT}s, last stage={stage!r}",
    )
    raise TimeoutError(
        f"still not signed in as {RIDER_EMAIL} after {LOGIN_TIMEOUT}s (stuck at stage {stage!r}, "
        f"last url {driver.current_url}) - if this account needs MFA or its password changed, "
        "set GORIDE_USER / GORIDE_PASS to a working Rider account before running this file. "
        "A screenshot and the page source of the stuck screen were saved to "
        "evidence/sign-in-stuck.png / .html"
    )


@pytest.fixture(scope="module")
def rider_driver():
    """
    One signed-in Chrome session shared by every test below.

    Module-scoped on purpose: signing in through the real Asgardeo flow is a
    genuine network round trip to a hosted login page, not something to pay
    for in every test. Ride-planning state is still reset per test (see
    fresh_ride) so tests never see each other's pickup/destination/selection.
    """
    opts = Options()
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument("--window-size=1440,900")
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    _sign_in(drv)
    yield drv
    drv.quit()


@pytest.fixture
def fresh_ride(rider_driver):
    """
    Clear only the ride-store's persisted state before each test.

    useRideStore persists pickup/destination/selection to sessionStorage
    under 'goride.ride' (see store/ride-store.ts). useAuthStore persists the
    signed-in session to the SAME sessionStorage under 'goride.session' -
    sessionStorage.clear() would silently log the rider back out for every
    test after the first one, so this removes only the ride key.
    """
    rider_driver.get(APP)
    rider_driver.execute_script("window.sessionStorage.removeItem('goride.ride');")
    return rider_driver


@pytest.fixture
def any_size(fresh_ride):
    """fresh_ride, but restores the desktop viewport afterward.

    rider_driver is module-scoped and shared by every test in this file
    (see its docstring) - unlike test_ui_smoke.py, where every test gets
    its own fresh browser. That means a viewport test that left the shared
    browser at phone size would corrupt every test that runs after it in
    this file. Only the viewport-parametrized tests below use this fixture;
    everything else relies on the desktop 1440x900 window rider_driver was
    created with.
    """
    yield fresh_ride
    set_viewport(fresh_ride, 1440, 900)


def test_open_ride_page_from_home(fresh_ride, shot):
    """SCRUM-46: picking a recent destination on the rider home page opens /rider/ride with it pre-filled."""
    driver = fresh_ride
    driver.get(f"{APP}/rider")
    wait_settled(driver)

    target = driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]")
    target.click()

    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)
    assert "/rider/ride" in driver.current_url, "clicking a recent destination did not open the ride page"
    shot(driver, "ride-page-opened")


def test_use_current_location_as_pickup(fresh_ride):
    """SCRUM-47: pickup auto-locates on arrival, and 'Use current location' re-locates it on demand."""
    driver = fresh_ride
    driver.get(f"{APP}/rider/ride")

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    # RiderRidePage's mount effect calls locate() automatically when there is
    # no pickup yet - wait that out before touching the field ourselves.
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")
    auto_value = pickup_input.get_attribute("value")
    assert auto_value, "pickup never auto-located on page load"

    pickup_input.click()
    _react_clear(pickup_input)
    quick = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[contains(., 'Use current location')]")
    )
    quick.click()

    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")
    assert pickup_input.get_attribute("value").strip(), "'Use current location' did not repopulate the pickup field"


def test_search_pickup_location_by_address(fresh_ride):
    """SCRUM-48: typing an address into the pickup field surfaces it as a pickable suggestion."""
    driver = fresh_ride
    driver.get(f"{APP}/rider/ride")

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    pickup_input.click()
    _react_clear(pickup_input)
    pickup_input.send_keys(SEARCH_LANDMARK[:12])  # partial query, like a real user mid-type

    suggestion = WebDriverWait(driver, 10).until(
        lambda d: d.find_element(By.XPATH, f"//button[contains(., '{SEARCH_LANDMARK}')]")
    )
    suggestion.click()

    WebDriverWait(driver, 5).until(lambda d: pickup_input.get_attribute("value") == SEARCH_LANDMARK)
    assert pickup_input.get_attribute("value") == SEARCH_LANDMARK, "picking a search suggestion did not fill the pickup field"


def test_fare_and_vehicle_selection(fresh_ride, shot):
    """
    SCRUM-53/54: after Search, every vehicle type shows a real calculated fare.
    SCRUM-56: only Tuk Tuk is selectable this sprint - every other option must
    carry a genuine HTML disabled attribute (VehicleOption sets
    disabled={!isAvailable} in ride-bits.tsx), not just be styled to look
    unavailable. is_enabled() here is the automated form of hovering over the
    button to confirm it does not actually respond to a click.
    """
    driver = fresh_ride
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]").click()
    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    search_btn = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Search']")
    )
    search_btn.click()

    WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.XPATH, "//h2[text()='Choose a ride']"))
    shot(driver, "choose-a-ride")

    tuk = driver.find_element(By.XPATH, "//button[.//span[text()='Tuk Tuk']]")
    assert tuk.is_enabled(), "Tuk Tuk should be the one bookable vehicle type, but it is disabled"
    tuk_fare = tuk.find_element(By.XPATH, ".//span[contains(@class,'font-bold')]").text
    assert tuk_fare not in ("", "—"), f"Tuk Tuk has no calculated fare (SCRUM-53/54): got {tuk_fare!r}"

    unavailable = driver.find_elements(By.XPATH, "//button[.//span[text()='Unavailable']]")
    assert unavailable, "expected at least one non-Tuk-Tuk vehicle type marked Unavailable"
    for opt in unavailable:
        assert not opt.is_enabled(), (
            "a vehicle type marked Unavailable is still clickable - SCRUM-56 only allows "
            "Tuk Tuk to be selected right now, this one should carry a real disabled attribute"
        )
        fare = opt.find_element(By.XPATH, ".//span[contains(@class,'font-bold')]").text
        assert fare not in ("", "—"), f"an unavailable vehicle type should still show its real calculated fare, got {fare!r}"

    tuk.click()
    WebDriverWait(driver, 5).until(lambda d: tuk.get_attribute("aria-pressed") == "true")
    assert tuk.get_attribute("aria-pressed") == "true", "selecting Tuk Tuk did not mark it as selected"
    assert "/rider/ride" in driver.current_url, (
        "selecting a vehicle type should not navigate anywhere yet - "
        "continuing past this screen (trip booking) is not implemented"
    )


@pytest.fixture
def tracking_driver():
    """
    A dedicated, freshly-signed-in browser for the driver-tracking tests below.

    Unlike rider_driver (module-scoped, shared by every quick UI check in this
    file - see its docstring), these tests drive a real trip all the way
    through matching and simulated movement: they run much longer and leave
    real MockWorld state behind (an active trip). Sharing rider_driver would
    risk a later test resuming this leftover trip instead of starting from a
    clean slate, so this gets its own session and its own sign-in instead.
    """
    opts = Options()
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument("--window-size=1440,900")
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    _sign_in(drv)
    yield drv
    drv.quit()


def _book_a_tuk_tuk_ride(driver) -> None:
    """
    Drives the whole planning flow through to a confirmed request: pick a
    destination, let pickup auto-locate, search, pick Tuk Tuk, review, confirm.

    Shared setup for the driver-tracking tests below, which need an actual
    trip request in flight before there is anything to track.
    """
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]").click()
    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Search']")
    ).click()

    WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.XPATH, "//h2[text()='Choose a ride']"))
    driver.find_element(By.XPATH, "//button[.//span[text()='Tuk Tuk']]").click()

    continue_btn = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[starts-with(normalize-space(),'Continue')]")
    )
    WebDriverWait(driver, 5).until(lambda d: continue_btn.is_enabled())
    continue_btn.click()

    confirm_btn = WebDriverWait(driver, 10).until(
        lambda d: d.find_element(By.XPATH, "//button[starts-with(normalize-space(),'Confirm ride')]")
    )
    WebDriverWait(driver, 5).until(lambda d: confirm_btn.is_enabled())
    confirm_btn.click()


def _active_driver_location(driver):
    """
    Reads the live simulated driver location straight out of MockWorld's own
    persisted state (see world.ts's WORLD_KEY / commit()), rather than parsing
    rounded on-screen minute counts - a much more precise signal of whether
    the position broadcast (SCRUM-68/84) is actually moving, not just present.
    """
    return driver.execute_script(
        "const w = JSON.parse(localStorage.getItem('goride.mock.world.v3') || '{}');"
        "const entries = Object.values(w.locations || {}).filter(l => l && l.status === 'OnTrip');"
        "return entries[0] || null;"
    )


def test_driver_tracking_to_pickup_and_destination(tracking_driver, shot):
    """
    SCRUM-68: the assigned driver's simulated position is broadcast live while
    en route to the pickup point (MockWorld.moveAlong, driven by a 1s tick and
    pushed to every tab/listener via commit() -> BroadcastChannel).
    SCRUM-69: the route and ETA for that driver-to-pickup leg are genuinely
    calculated (ensureRoute() -> getRoute(), real OSRM routing with a geodesic
    fallback) rather than a placeholder, and shown to the rider.
    SCRUM-84: the same simulated-position broadcast continues for the
    pickup-to-destination leg once the trip starts.
    SCRUM-85: the route and ETA are recalculated for that second leg too.

    Drives a real request through matching to get an actual driver to track.
    MockWorld always resolves one eventually - it falls back to generating a
    driver after 3 search rounds (see generateRandomDriver in world.ts)
    instead of ever leaving a trip stuck at NO_DRIVER_FOUND - so this should
    only flake on timing, not on driver availability. Uses its own
    tracking_driver session rather than the shared rider_driver, since it
    leaves real trip state behind that would otherwise bleed into whichever
    test runs next (see that fixture's docstring).

    No JMeter coverage for these four stories: the route/ETA calculation here
    runs entirely client-side (lib/geo/providers.ts's getRoute() calls the
    public OSRM API directly from the browser) - there is no GoRide-owned
    backend behind this feature to load-test, and load-testing someone else's
    free public API would be inappropriate. See tests/jmeter/README.md.
    """
    driver = tracking_driver
    _book_a_tuk_tuk_ride(driver)

    # ---- Leg 1: driver -> pickup (SCRUM-68/69) ---------------------------
    # Matching can take up to 3 rounds * 7s before MockWorld generates a
    # fallback driver (see generateRandomDriver) - give it real headroom.
    WebDriverWait(driver, 45).until(
        lambda d: d.find_elements(By.XPATH, "//h2[contains(text(),'driver is on the way')]")
    )
    shot(driver, "driver-en-route-to-pickup")

    eta_p = "//h2[contains(text(),'driver is on the way')]/following-sibling::p"
    WebDriverWait(driver, 20).until(lambda d: "Calculating" not in d.find_element(By.XPATH, eta_p).text)
    assert "Arriving in about" in driver.find_element(By.XPATH, eta_p).text, (
        "no route/ETA shown for the driver-to-pickup leg (SCRUM-69)"
    )

    loc_1 = _active_driver_location(driver)
    assert loc_1, "no live driver location in MockWorld state while en route to pickup (SCRUM-68)"
    time.sleep(6)
    loc_2 = _active_driver_location(driver)
    still_en_route = bool(driver.find_elements(By.XPATH, "//h2[contains(text(),'driver is on the way')]"))
    assert loc_2 and (
        (loc_2["lat"], loc_2["lng"]) != (loc_1["lat"], loc_1["lng"]) or not still_en_route
    ), (
        "the driver's broadcast position did not move over 6s while en route to pickup (SCRUM-68) - "
        f"before={loc_1}, after={loc_2}"
    )

    # ---- Leg 2: pickup -> destination (SCRUM-84/85) -----------------------
    # The driver has to actually arrive (up to 80s move + an 8s wait) and the
    # trip auto-starts (NPC drivers don't wait on rider input) - the longest
    # leg in this whole flow, so this gets the most generous timeout.
    WebDriverWait(driver, 110).until(
        lambda d: d.find_elements(By.XPATH, "//h2[contains(text(),'Heading to')]")
    )
    shot(driver, "trip-in-progress-to-destination")

    eta_d = "//h2[contains(text(),'Heading to')]/following-sibling::p"
    WebDriverWait(driver, 20).until(lambda d: "On the way" not in d.find_element(By.XPATH, eta_d).text)
    assert "Arriving in about" in driver.find_element(By.XPATH, eta_d).text, (
        "no route/ETA shown for the pickup-to-destination leg (SCRUM-85)"
    )

    loc_3 = _active_driver_location(driver)
    assert loc_3, "no live driver location in MockWorld state while heading to destination (SCRUM-84)"
    time.sleep(6)
    loc_4 = _active_driver_location(driver)
    still_in_progress = bool(driver.find_elements(By.XPATH, "//h2[contains(text(),'Heading to')]"))
    assert loc_4 and (
        (loc_4["lat"], loc_4["lng"]) != (loc_3["lat"], loc_3["lng"]) or not still_in_progress
    ), (
        "the driver's broadcast position did not move over 6s while heading to destination (SCRUM-84) - "
        f"before={loc_3}, after={loc_4}"
    )


# ---------------------------------------------------------------------------
# Responsive checks, signed in - SCRUM-46/47/48/53/54/56's own screens, not
# just the anonymous landing page test_ui_smoke.py already covers.
#
# Each test asks two different questions at every size, because passing the
# first does not imply the second:
#
#   1. does the PAGE hold together - no sideways scroll (has_horizontal_overflow)
#   2. are the CONTROLS on it actually usable - fully on screen, not collapsed,
#      and on a phone big enough to hit with a thumb (control_problems)
#
# The overflow check only asks whether the document is wider than the screen,
# so a control clipped by a container that hides its own overflow, squashed to
# a sliver, or shrunk below a fingertip sails straight past it. That is the gap
# the second check closes.
#
# The two cheap page-load tests run at all eight VIEWPORTS. The choose-a-ride
# test has to drive the whole flow (open a destination, wait for the pickup to
# locate, Search, wait for live fares from trip-matching) before it can measure
# anything, so it runs at CORE_VIEWPORTS - the three sizes that actually
# represent different layouts - rather than paying for that flow eight times.
#
# Every test here takes any_size, not fresh_ride, so the shared browser's
# viewport gets put back to desktop afterwards - see any_size's docstring.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_rider_home_layout_holds_at_every_size(any_size, shot, width, height, label):
    """The signed-in rider home page: no sideways scroll, and every recent
    destination fully on screen and big enough to tap."""
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    shot(driver, f"rider-home-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the rider home page scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )

    recents = driver.find_elements(By.XPATH, RECENT_BUTTONS_XPATH)
    assert recents, f"no recent destinations rendered at all at {width}x{height} ({label})"
    problems = control_problems(driver, recents, touch=is_touch_size(width, height))
    assert not problems, (
        f"recent destinations are not usable at {width}x{height} ({label}):\n  - "
        + "\n  - ".join(problems)
    )


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_ride_planning_layout_holds_at_every_size(any_size, shot, width, height, label):
    """The pickup/destination screen: no sideways scroll, and both address
    fields reachable and tappable. This is the screen with the map and the
    panel competing for width, so it is the one most likely to squeeze a
    field down to nothing rather than overflow outright."""
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider/ride")
    wait_settled(driver)
    shot(driver, f"ride-planning-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the ride planning page scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )

    fields = driver.find_elements(By.CSS_SELECTOR, f"{PICKUP_SELECTOR}, {DESTINATION_SELECTOR}")
    assert len(fields) >= 2, (
        f"expected a pickup and a drop-off field at {width}x{height} ({label}), found {len(fields)}"
    )
    problems = control_problems(driver, fields, touch=is_touch_size(width, height))
    assert not problems, (
        f"the address fields are not usable at {width}x{height} ({label}):\n  - "
        + "\n  - ".join(problems)
    )


@pytest.mark.parametrize("width,height,label", CORE_VIEWPORTS)
def test_choose_a_ride_layout_holds_at_every_size(any_size, shot, width, height, label):
    """
    SCRUM-53/54/56's vehicle-selection cards are the densest layout in the
    flow - a row per vehicle type, each carrying an icon, a name, an ETA and a
    fare - so it is both the most likely to overflow and the most likely to
    squash a card below a tappable size on a phone.
    """
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]").click()
    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    search_btn = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Search']")
    )
    # The Search button is the one control that has to survive every size: if
    # it is off screen or squashed there is no way past this step at all.
    problems = control_problems(driver, [search_btn], touch=is_touch_size(width, height))
    assert not problems, (
        f"the Search button is not usable at {width}x{height} ({label}):\n  - "
        + "\n  - ".join(problems)
    )
    search_btn.click()

    WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.XPATH, "//h2[text()='Choose a ride']"))
    wait_settled(driver)
    shot(driver, f"choose-a-ride-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the choose-a-ride screen scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )

    cards = driver.find_elements(By.XPATH, "//button[.//span[text()='Tuk Tuk']] | //button[.//span[text()='Unavailable']]")
    assert cards, f"no vehicle options rendered at {width}x{height} ({label})"
    problems = control_problems(driver, cards, touch=is_touch_size(width, height))
    assert not problems, (
        f"the vehicle cards are not usable at {width}x{height} ({label}):\n  - "
        + "\n  - ".join(problems)
    )
