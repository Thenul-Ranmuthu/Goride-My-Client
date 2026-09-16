# Selenium UI tests

Browser tests for the GoRide frontend, run with Selenium WebDriver and pytest in
Chrome.

Two files, two different trust levels: `test_ui_smoke.py` needs no signed in
session, so no test account or cookie is required. `test_ride_planning.py`
covers screens behind RoleGuard/proxy.ts's session check, so it signs in as a
real Rider first (see "Signed-in tests" below) — allow it more time to run.

## `test_ui_smoke.py` — anonymous checks

| Test | Story | Checks |
| --- | --- | --- |
| `test_landing_page_loads` | Smoke | The app serves and names the product |
| `test_sign_in_link_targets_the_identity_server` | SCRUM-30 | Sign in points at the API `/login` with a `returnUrl` |
| `test_no_password_field_on_the_landing_page` | SCRUM-30 | The app never collects a password itself |
| `test_sign_in_reaches_asgardeo` | SCRUM-30 | Clicking Sign in lands on the Asgardeo hosted login |
| `test_dashboard_is_not_readable_without_a_session` | SCRUM-36 | An anonymous visit to `/dashboard` is sent to sign in |
| `test_landing_page_does_not_scroll_sideways` | UI | No horizontal overflow at all eight widths |
| `test_sign_in_stays_reachable_at_every_size` | UI | Sign in stays visible and fully inside the viewport at every width |
| `test_page_has_no_console_errors` | UI | No uncaught JavaScript on the landing page |

The overflow test was written when the landing page scrolled sideways at every
width (SCRUM-874): a decorative element sat past the right edge of a container
that did not clip its overflow. Commit 48bcc98 added `overflow-hidden` to that
container, so the test now guards against the defect returning. If it fails, the
message names the element that sticks out and how far it reaches.

## `test_ride_planning.py` — signed-in Rider checks (Sprint 2)

| Test | Story | Checks |
| --- | --- | --- |
| `test_open_ride_page_from_home` | SCRUM-46 | A recent destination on the rider home page opens `/rider/ride` with it pre-filled |
| `test_use_current_location_as_pickup` | SCRUM-47 | Pickup auto-locates on arrival, and "Use current location" re-locates it on demand |
| `test_search_pickup_location_by_address` | SCRUM-48 | Typing an address surfaces it as a pickable suggestion |
| `test_fare_and_vehicle_selection` | SCRUM-53/54/56 | Every vehicle type shows a real calculated fare; only Tuk Tuk is genuinely enabled (real `disabled` attribute, not just styling) and selecting it does not navigate anywhere, since trip booking isn't implemented yet |
| `test_rider_home_layout_holds_at_every_size` | UI | Rider home: no horizontal overflow, and every recent destination fully on screen and tappable, at all eight sizes |
| `test_ride_planning_layout_holds_at_every_size` | UI | Pickup/destination screen (map and panel competing for width): no overflow, and both address fields reachable and tappable, at all eight sizes |
| `test_choose_a_ride_layout_holds_at_every_size` | UI | Vehicle cards after Search: Search itself usable, no overflow, and every card on screen and tappable. Phone/tablet/desktop only — see "Window sizes" below |

The remaining implemented Sprint 2 stories (SCRUM-127/128/129/130/132) are
notification-service triggers with no UI to click through — they stay covered
by the Postman collection in `../../postman-qa/` (trip-matching) and the
notification repo's own collection, not by Selenium.

### Signed-in tests

`test_ride_planning.py` signs in through the real "Sign in" → Asgardeo → back
round trip, the same flow `test_sign_in_reaches_asgardeo` already proves
works, rather than reusing a `grab_session_cookie.py` cookie — that cookie is
captured on the identity API's own origin (`https://localhost:7136`) and
won't authenticate the frontend at `http://localhost:3000`, which checks its
own same-origin `app_session` cookie instead.

Needs `identity-auth` and `trip-matching` running too, not just the frontend:

```powershell
.\goride-dev.ps1 start identity
.\goride-dev.ps1 start trip
.\goride-dev.ps1 start frontend
```

Credentials come from `GORIDE_USER` / `GORIDE_PASS` — same variables
`grab_session_cookie.py` reads — and default to the seeded Rider demo account
(`DEMO_ACCOUNTS` / `DEMO_PASSWORD` in `src/lib/constants.ts`) if unset. If
that account's password has changed or picked up MFA, set both env vars to a
working Rider account first.

Sign-in handles both a combined username+password Asgardeo form and a split
username-then-Continue-then-password one, and waits for each field to be
*visible* before typing into it rather than just present in the DOM — an
earlier version assumed a combined form and typing into it failed with
`ElementNotInteractableException` on a real run. If sign-in still can't get
through, it now saves a screenshot and the page HTML of wherever it got
stuck to `evidence/sign-in-stuck.png` / `.html` before failing, so a report
of a new failure can include those two files.

The three responsive tests reuse `VIEWPORTS` from `conftest.py` (the same
sizes `test_ui_smoke.py` checks) via an `any_size`
fixture, not `fresh_ride` directly - `rider_driver` is one Chrome session
shared by every test in this file, so a viewport test that left it resized
would corrupt every test that runs after it; `any_size` restores the
desktop 1440x900 size once each parametrized test finishes.

## Window sizes

`conftest.py` owns the size list so both files test the same thing. The sizes
sit either side of the Tailwind breakpoints the app uses (sm 640, md 768,
lg 1024, xl 1280), because a layout that breaks does it just above or below a
breakpoint rather than in the middle of one:

| Size | Label | Why it is in the list |
| --- | --- | --- |
| 320x568 | `small-phone` | The narrowest phone still in real use - worst case for a fixed width or a long unbroken string |
| 390x844 | `phone` | The phone size most people carry |
| 414x896 | `large-phone` | A large phone, still under the `sm` breakpoint |
| 844x390 | `phone-landscape` | The same phone turned sideways: wide enough for the desktop layout but only 390px tall, where stacked panels run out of room |
| 768x1024 | `tablet` | Exactly on `md` - the tablet layout's first pixel |
| 1024x768 | `small-laptop` | Exactly on `lg` |
| 1440x900 | `desktop` | The size the design was drawn at |
| 1920x1080 | `wide-desktop` | A full HD monitor - catches layouts that stop growing or centre badly |

Each responsive test asks two questions at every size, because passing the
first does not imply the second:

1. **Does the page hold together?** `has_horizontal_overflow()` - no sideways
   scroll. On failure the message names the element sticking out furthest and
   how far it reaches.
2. **Are the controls usable?** `control_problems()` - each control is
   rendered, has not collapsed to nothing, is fully inside the viewport
   horizontally, and on a touch-sized screen is at least 44px (Apple's HIG
   minimum; WCAG 2.2's own floor is a more forgiving 24px). The overflow check
   only asks whether the *document* is wider than the screen, so a control
   clipped by a container that hides its own overflow, squashed to a sliver, or
   shrunk below a fingertip sails straight past it - that is the gap this
   closes. Vertical overflow is deliberately not a failure; pages scroll down.

Touch sizing is decided by the **shorter** side, not the width, so a rotated
phone (844x390) is still treated as a phone. `set_viewport()` uses the same
rule for Chrome's mobile emulation flag.

The two cheap page-load tests run at all eight sizes. `test_choose_a_ride_...`
has to drive the whole flow (open a destination, wait for the pickup to
locate, Search, wait for live fares from trip-matching) before it can measure
anything, so it runs at `CORE_VIEWPORTS` - phone, tablet and desktop, the
three that represent genuinely different layouts - rather than paying for that
flow eight times over. Widen it by swapping `CORE_VIEWPORTS` for `VIEWPORTS`
in its `parametrize` decorator if you want the full sweep before a release.

The 44px tap-target rule is applied to the primary controls of each screen
(recent destinations, the two address fields, Search, the vehicle cards), not
to every button on the page. Icon-only chrome such as the 40px back button in
`ride-phases.tsx` is under Apple's 44px but comfortably over WCAG's 24px, so
it is out of scope here rather than a standing red test - worth raising as its
own small accessibility ticket if the team wants it changed.

## Prerequisites

- Python 3.11 or newer and Google Chrome. Selenium Manager downloads the matching
  chromedriver on the first run.
- The frontend running: `npm run dev` at the repository root.
- The identity API running at `https://localhost:7136`.

```bash
pip install -r tests/selenium/requirements.txt
```

## Running

From `tests/selenium`:

```bash
python -m pytest -v
```

Watch the browser drive itself:

```bash
set HEADLESS=0 && python -m pytest -v


$env:HEADLESS = "0"                 
>> python -m pytest -v
```

Run the suite and open a self contained HTML report with the screenshots embedded:

```bash
python make_report.py
```

Screenshots, `junit.xml` and `report.html` are written to `tests/selenium/evidence/`,
which is ignored by git. Point elsewhere with the `GORIDE_EVIDENCE` environment variable.

## Capturing a session cookie

`grab_session_cookie.py` signs in through the real Asgardeo flow and prints the full
`Cookie` header that Postman and JMeter need. The session cookie is HttpOnly, so it
cannot be read from page JavaScript; WebDriver can.

```bash
python grab_session_cookie.py --role driver
```

The header is written to `tests/selenium/.sessions/<role>.txt`. That folder is ignored
by git because it holds a live session.

## Configuration

| Variable | Default |
| --- | --- |
| `GORIDE_APP` | `http://localhost:3000` |
| `GORIDE_API` | `https://localhost:7136` |
| `HEADLESS` | `1` |
| `GORIDE_EVIDENCE` | `tests/selenium/evidence` |
