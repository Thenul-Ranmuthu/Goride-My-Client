"""
UI smoke and responsive checks for the GoRide frontend.

These run without a signed-in session, so they need no cookies and no test
account. Run them with:

    pytest -v
    HEADLESS=0 pytest -v        # watch the browser drive itself
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from conftest import (VIEWPORTS, APP, control_problems, has_horizontal_overflow,
                      overflow_detail, set_viewport, wait_settled)


def test_landing_page_loads(driver, shot):
    """The marketing page renders and names the product."""
    driver.get(APP)
    wait_settled(driver)
    assert "GoRide" in driver.title or "GoRide" in driver.page_source
    shot(driver, "landing")


def test_sign_in_link_targets_the_identity_server(driver):
    """
    SCRUM-30: the app must hand login off to WSO2/Asgardeo, never collect a
    password itself. The link has to point at the API's /login with a returnUrl.
    """
    driver.get(APP)
    links = driver.find_elements(By.PARTIAL_LINK_TEXT, "Sign in")
    assert links, "no 'Sign in' link on the landing page"

    href = links[0].get_attribute("href")
    assert "/login" in href, f"Sign in does not go to /login: {href}"
    assert "returnUrl=" in href, f"Sign in does not carry a returnUrl: {href}"


def test_no_password_field_on_the_landing_page(driver):
    """The app must not have grown its own password box."""
    driver.get(APP)
    assert not driver.find_elements(By.CSS_SELECTOR, "input[type='password']"), (
        "the landing page collects a password - login must go through the identity server"
    )


def test_sign_in_reaches_asgardeo(driver, shot):
    """SCRUM-30: clicking Sign in ends up on the Asgardeo hosted login page."""
    driver.get(APP)
    driver.find_elements(By.PARTIAL_LINK_TEXT, "Sign in")[0].click()

    url = driver.current_url
    assert "asgardeo.io" in url or "/authenticationendpoint/" in url, (
        f"did not reach the identity provider, landed on {url}"
    )
    shot(driver, "asgardeo-login")


def _body_text_lower(driver) -> str:
    """driver.find_element(body).text, tolerant of the element going stale
    mid-read.

    /dashboard with no session gets redirected by proxy.ts's own server-side
    check (no app_session cookie -> a real 302 to Asgardeo) before any
    client JS runs - so the redirect is often a genuine browser navigation,
    not a client-side route change. If that navigation lands between
    find_element locating <body> and .text being read off it, the original
    <body> node is already gone and Selenium raises
    StaleElementReferenceException. That is not a real failure - it means
    the very redirect this test is checking for is in flight - so treat it
    as "not settled yet" and let the caller retry rather than erroring out.
    """
    try:
        return driver.find_element(By.TAG_NAME, "body").text.lower()
    except StaleElementReferenceException:
        return ""


def test_dashboard_is_not_readable_without_a_session(driver, shot):
    """A protected route must not render its contents to an anonymous visitor."""
    driver.get(f"{APP}/dashboard")
    # The guard may redirect server-side (a real navigation) or client-side,
    # so give it a moment before judging either way.
    try:
        WebDriverWait(driver, 15).until(
            lambda d: "asgardeo.io" in d.current_url
            or "/login" in d.current_url
            or "sign in" in _body_text_lower(d)
        )
    except TimeoutException:
        pass  # the assertion below reports it properly
    body = _body_text_lower(driver)

    left_the_app = "asgardeo.io" in driver.current_url or "/login" in driver.current_url
    shows_sign_in = "sign in" in body
    assert left_the_app or shows_sign_in, (
        "the dashboard rendered without a session - screenshot this, it is a defect"
    )
    shot(driver, "dashboard-anonymous")


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_landing_page_does_not_scroll_sideways(driver, shot, width, height, label):
    """
    A page wider than its viewport is the classic responsive bug and it is
    tedious to spot by eye. This catches it at three sizes.
    """
    set_viewport(driver, width, height)
    driver.get(APP)
    wait_settled(driver)
    shot(driver, f"landing-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the landing page scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_sign_in_stays_reachable_at_every_size(driver, width, height, label):
    """A control that falls off the layout on a phone is unusable, not just ugly.

    is_displayed() alone only answers "is it in the DOM and not hidden by CSS" -
    it happily returns True for a link sitting half off the right edge, or one
    a container has clipped. control_problems() also measures where it actually
    lands inside the viewport.
    """
    set_viewport(driver, width, height)
    driver.get(APP)
    wait_settled(driver)

    links = driver.find_elements(By.PARTIAL_LINK_TEXT, "Sign in")
    assert links, f"no 'Sign in' link at {width}x{height} ({label})"
    problems = control_problems(driver, links[:1])
    assert not problems, (
        f"'Sign in' is not usable at {width}x{height} ({label}):\n  - " + "\n  - ".join(problems)
    )


def test_page_has_no_console_errors(driver):
    """Uncaught JavaScript errors on the first page a user sees."""
    driver.get(APP)
    severe = [
        entry for entry in driver.get_log("browser")
        if entry.get("level") == "SEVERE"
        # the dev certificate on the API produces its own noise; not an app bug
        and "localhost:7136" not in entry.get("message", "")
        and "favicon" not in entry.get("message", "")
    ]
    assert not severe, "console errors on the landing page:\n" + "\n".join(
        e["message"] for e in severe
    )
