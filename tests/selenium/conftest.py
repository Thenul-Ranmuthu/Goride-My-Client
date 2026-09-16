"""Shared fixtures for the GoRide Selenium suite."""

from __future__ import annotations

import os
import socket
import time
from pathlib import Path
from urllib.parse import urlparse

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

APP = os.environ.get("GORIDE_APP", "http://localhost:3000")
API = os.environ.get("GORIDE_API", "https://localhost:7136")

EVIDENCE = Path(os.environ.get("GORIDE_EVIDENCE", Path(__file__).resolve().parent / "evidence"))

# width, height, label - every size the responsive checks run at. Shared
# between test_ui_smoke.py and test_ride_planning.py so both suites test the
# same sizes instead of drifting apart.
#
# These sit either side of the Tailwind breakpoints the app actually uses
# (sm 640, md 768, lg 1024, xl 1280), because a layout that breaks does it
# just above or below a breakpoint, not in the middle of one:
#   320x568   the narrowest phone still in real use - worst case for anything
#             with a fixed width or a long unbroken string
#   390x844   the phone size most people are carrying
#   414x896   a large phone, still under the sm breakpoint
#   844x390   the same phone turned sideways: wide enough to get the desktop
#             layout but only 390px tall, which is where stacked panels and
#             bottom sheets run out of room
#   768x1024  exactly on the md breakpoint - the tablet layout's first pixel
#   1024x768  exactly on the lg breakpoint - a small laptop
#   1440x900  the size the design was drawn at
#   1920x1080 a full HD monitor - catches layouts that stop growing or centre badly
VIEWPORTS = [
    (320, 568, "small-phone"),
    (390, 844, "phone"),
    (414, 896, "large-phone"),
    (844, 390, "phone-landscape"),
    (768, 1024, "tablet"),
    (1024, 768, "small-laptop"),
    (1440, 900, "desktop"),
    (1920, 1080, "wide-desktop"),
]

# The subset worth paying for when a test drives a whole flow at every size
# rather than just loading one page. Running an eight-step flow eight times
# over turns a two minute suite into a ten minute one for very little extra
# coverage, so the expensive checks use these three and the cheap
# page-load checks use all of VIEWPORTS.
CORE_VIEWPORTS = [vp for vp in VIEWPORTS if vp[2] in ("phone", "tablet", "desktop")]

# Apple's Human Interface Guidelines minimum for anything a finger has to hit.
# WCAG 2.2's own floor (success criterion 2.5.8) is a more forgiving 24px, so
# a control between the two is uncomfortable rather than inaccessible.
TAP_TARGET_MIN = 44


def _listening(url: str) -> bool:
    parsed = urlparse(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    with socket.socket() as sock:
        sock.settimeout(2)
        return sock.connect_ex((parsed.hostname or "localhost", port)) == 0


@pytest.fixture(scope="session", autouse=True)
def services_up():
    """Fail loudly and early rather than 30 confusing test failures."""
    missing = []
    if not _listening(APP):
        missing.append(f"frontend at {APP}  (npm run dev in goride-frontend)")
    if not _listening(API):
        missing.append(f"API at {API}  (dotnet run --launch-profile https in src)")
    if missing:
        pytest.exit("Not running:\n  - " + "\n  - ".join(missing), returncode=1)


@pytest.fixture
def driver():
    opts = Options()
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument("--window-size=1440,900")
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    # Do NOT add excludeSwitches=["enable-automation"] here: on Chrome 152 it makes
    # the browser exit at startup in windowed mode (SessionNotCreatedException).
    # Needed for driver.get_log("browser") in the console-error test.
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture
def shot(request):
    """shot(driver, 'name') -> saves a screenshot named after the test."""
    EVIDENCE.mkdir(parents=True, exist_ok=True)

    def take(drv, label: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in label)
        path = EVIDENCE / f"{request.node.name}__{safe}.png"
        drv.save_screenshot(str(path))
        return path

    return take


def wait_settled(drv, timeout: float = 12.0) -> None:
    """
    Wait for the page to stop moving before measuring it.

    Next.js hydrates and loads images well after readyState=complete, and the
    layout keeps growing while it does. Two matching readings are not enough:
    the page sits at its correct width for a moment BEFORE the overflowing
    element mounts, so an early pair of equal reads reports a clean layout on a
    page that is actually broken. Require the width to hold steady for a full
    second before believing it.
    """
    deadline = time.time() + timeout

    while time.time() < deadline:
        if drv.execute_script("return document.readyState") == "complete":
            break
        time.sleep(0.2)

    STABLE_READS = 4      # 4 x 0.25s = 1s of no change
    last, steady = None, 0
    while time.time() < deadline:
        width = drv.execute_script("return document.documentElement.scrollWidth")
        steady = steady + 1 if width == last else 0
        last = width
        if steady >= STABLE_READS:
            return
        time.sleep(0.25)


def is_touch_size(width: int, height: int) -> bool:
    """
    True for the viewports a fingertip, not a mouse pointer, will be using.

    Measured on the SHORTER side so a phone held sideways (844x390) still
    counts as a phone - going by width alone would call it a laptop.
    """
    return min(width, height) < 768


def set_viewport(drv, width: int, height: int, mobile: bool | None = None) -> None:
    """
    Set the exact CSS viewport.

    driver.set_window_size() sizes the OS window, not the viewport - at
    390x844 it left a 512px viewport, so the test was not measuring the width
    its own label claimed. Emulation.setDeviceMetricsOverride is exact.

    `mobile` decides whether Chrome emulates a touch device, which changes how
    the page's own meta viewport tag is applied. Left unset it follows
    is_touch_size(), so a rotated phone is still emulated as a phone.
    """
    if mobile is None:
        mobile = is_touch_size(width, height)
    drv.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": mobile,
    })


def widest_offender(drv):
    """The element sticking out furthest past the right edge, for the bug report."""
    return drv.execute_script("""
        const de = document.documentElement;
        let worst = null;
        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > de.clientWidth + 1) {
                if (!worst || r.right > worst.right) {
                    worst = {tag: el.tagName.toLowerCase(),
                             cls: (el.className || '').toString().slice(0, 90),
                             right: Math.round(r.right)};
                }
            }
        });
        return worst;
    """)


def has_horizontal_overflow(drv) -> bool:
    """
    True when the page scrolls sideways - always a responsive-layout bug.

    Compare against documentElement.clientWidth, NOT window.innerWidth: under
    mobile emulation innerWidth reports the scrollable width, so an overflowing
    phone layout compares equal to itself and the check silently passes.
    """
    return drv.execute_script(
        "const e = document.documentElement;"
        "return e.scrollWidth > e.clientWidth + 1;"
    )


def overflow_detail(drv) -> str:
    """' - widest offender: <div class="..."> reaches 512px', or '' if nothing overflows.

    A ready-to-append suffix for an overflow assertion message, factored out
    so every responsive test reports the same way instead of re-deriving it.
    """
    culprit = widest_offender(drv)
    if not culprit:
        return ""
    return (f" - widest offender: <{culprit['tag']} class=\"{culprit['cls']}\"> "
            f"reaches {culprit['right']}px")


def _describe(el) -> str:
    """A short human name for a control, so a failure message says which one."""
    for attr in ("aria-label", "placeholder", "value"):
        value = (el.get_attribute(attr) or "").strip()
        if value:
            return value[:40]
    text = (el.text or "").strip()
    if text:
        return text.splitlines()[0][:40]
    return el.tag_name


def control_problems(drv, elements, touch: bool = False, min_tap: int = TAP_TARGET_MIN):
    """
    Everything wrong with these controls at the CURRENT viewport, as a list of
    sentences ready to drop straight into an assertion message.

    A page can pass the horizontal-overflow check and still be unusable - the
    overflow check only asks whether the DOCUMENT is wider than the screen, so
    a button clipped by a container that hides its own overflow, or squashed to
    a sliver, or shrunk below a fingertip, all slip past it. This asks the
    narrower question the overflow check can't: can someone actually use this
    control at this size?

    In order of how badly each one breaks the screen:
      - not rendered at all, or collapsed to nothing
      - cut off by the left or right edge, so part of it can never be reached
        (vertical overflow is deliberately not a failure - pages scroll down)
      - on a touch-sized screen, smaller than a fingertip

    Returns an empty list when every control is usable, so callers can assert
    on it directly and still get a message naming the offender.
    """
    client_width = drv.execute_script("return document.documentElement.clientWidth")
    problems = []

    for el in elements:
        name = _describe(el)

        if not el.is_displayed():
            problems.append(f"{name!r} is not visible")
            continue

        box = drv.execute_script(
            "const r = arguments[0].getBoundingClientRect();"
            "return {left: r.left, right: r.right, width: r.width, height: r.height};",
            el,
        )

        if box["width"] < 1 or box["height"] < 1:
            problems.append(
                f"{name!r} has collapsed to {round(box['width'])}x{round(box['height'])}px"
            )
            continue

        if box["left"] < -1 or box["right"] > client_width + 1:
            problems.append(
                f"{name!r} is cut off horizontally - it spans {round(box['left'])}px to "
                f"{round(box['right'])}px inside a {client_width}px viewport"
            )

        if touch and (box["width"] < min_tap or box["height"] < min_tap):
            problems.append(
                f"{name!r} is {round(box['width'])}x{round(box['height'])}px, under the "
                f"{min_tap}px minimum tap target"
            )

    return problems
