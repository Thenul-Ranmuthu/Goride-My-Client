# JMeter load tests

Two plans, one per backend the frontend actually calls under load:

| Plan | Targets | Auth needed |
| --- | --- | --- |
| `goride-auth-load.jmx` | identity-auth (`https://localhost:7136`) | A driver session cookie |
| `goride-trip-load.jmx` | trip-matching (`http://localhost:8080`) | None - `/fare/estimate` and `/drivers/active` carry no `[Authorize]` |

### Not covered here: SCRUM-68/69/84/85 (driver position + route/ETA during a trip)

These stories (simulated driver position broadcast and route/ETA calculation
for the driver-to-pickup and pickup-to-destination legs) have no GoRide-owned
backend behind them to load-test. The whole thing runs client-side: MockWorld
(`src/lib/mock/world.ts`) drives the simulation on a 1s tick, and
`lib/geo/providers.ts`'s `getRoute()` calls the **public OSRM API directly
from the browser** - not `goride-location`, not any service in this repo.
Load-testing someone else's free public API would be inappropriate, and it
would not tell you anything about a GoRide backend's capacity anyway. These
are covered by Selenium instead - see
`tests/selenium/test_ride_planning.py::test_driver_tracking_to_pickup_and_destination`.

## `goride-auth-load.jmx` - identity API

Two thread groups, each 10 users ramped over 10 seconds, 5 iterations per user.

| Sampler | Session | Checks |
| --- | --- | --- |
| `GET /api/me` | Driver | 200, under 2 s |
| `GET /api/driver/verification-status` | Driver | 200, under 2 s |
| `GET /api/driver/{driverSub}` | Driver | 200, under 3 s |
| `GET /api/profile` (proxied to Asgardeo over SCIM2) | Driver | 200 |
| `GET /api/me` with no cookie | None | Stays 401 under load |
| `GET /openapi/v1.json` | None | 200, used as the no auth, no database baseline |

### Prerequisites

- Apache JMeter 5.6 or newer and Java 17 or newer.
- The identity API running at `https://localhost:7136`. JMeter accepts the .NET
  developer certificate without extra setup.
- A driver session cookie. Capture one with the Selenium helper, which writes it
  to `tests/selenium/.sessions/driver.txt` where this plan reads it:

```bash
cd tests/selenium
python grab_session_cookie.py --role driver
```

- The driver's user id (the `userId` printed by that script) passed as `driverSub`.
- A driver profile for that account, otherwise the two `/api/driver/...` samplers return 404.

The session cookie is invalidated whenever the API restarts, so capture a fresh one after a restart.

### Running

Open the plan in the GUI:

```bash
jmeter -t tests/jmeter/goride-auth-load.jmx -JdriverSub=<userId>
```

Run without the GUI and generate the HTML dashboard:

```bash
jmeter -n -t tests/jmeter/goride-auth-load.jmx -JdriverSub=<userId> -l results.jtl -e -o report
```

The `report` folder must not already exist.

### Properties

| Property | Default | Purpose |
| --- | --- | --- |
| `driverSub` | empty | Driver user id for `GET /api/driver/{driverSub}` |
| `cookieFile` | `../selenium/.sessions/driver.txt` | File holding the full `Cookie` header, relative to this plan |
| `users` | `10` | Concurrent users per thread group |
| `rampUp` | `10` | Seconds to start all users |
| `loops` | `5` | Iterations per user |

Pass any of them with `-J`, for example `-Jusers=25 -Jloops=10`.

## `goride-trip-load.jmx` - trip-matching API

Load-tests the backend behind Sprint 2's ride-planning stories (SCRUM-46/47/48/
53/54/56) - the same real HTTP call (`POST /fare/estimate`) and driver-matching
lookup (`GET /drivers/active`) that `test_ride_planning.py` exercises through
the browser, plus the `/health` endpoint. Twelve samplers across four thread
groups, double `goride-auth-load.jmx`'s six - same load shape, 10 users ramped
over 10 seconds, 5 iterations per user, all four groups running concurrently
by default (JMeter starts every thread group at once unless told otherwise).

Nothing here needs a session cookie or a driver profile: `FareController` and
`DriversController` have no `[Authorize]` attribute in `Program.cs`, so this
plan runs against a clean checkout with zero setup beyond the service being up.

| # | Sampler | Checks |
| --- | --- | --- |
| 01 | `POST /fare/estimate` - Galle Face Green -> SLIIT Malabe Campus | 200, has `vehicleTypeCode` in the body, under 2 s |
| 02 | `POST /fare/estimate` - short hop to One Galle Face Mall | 200, under 2 s |
| 03 | `POST /fare/estimate` - cross-city Colombo Fort -> SLIIT Malabe | 200, under 3 s |
| 04 | `POST /fare/estimate` - zero-distance (pickup = destination) | 200, not a crash |
| 05 | `POST /fare/estimate` - reversed direction (SLIIT -> Galle Face Green) | 200, under 2 s |
| 06 | `POST /fare/estimate` - missing destination | Stays 400 under load |
| 07 | `POST /fare/estimate` - empty body | Stays 400 under load |
| 08 | `POST /fare/estimate` - non-numeric latitude | Stays 400 under load |
| 09 | `GET /drivers/active` (unfiltered) | 200, under 3 s |
| 10 | `GET /drivers/active?vehicleType=TUK` | 200, under 3 s |
| 11 | `GET /drivers/active?vehicleType=NOT_A_REAL_CODE` | 200 with an empty list, not an error |
| 12 | `GET /health` | 200, body says `healthy`, under 2 s |

Samplers 01-05 use the same three landmarks `test_ride_planning.py` clicks
through (SLIIT Malabe Campus, One Galle Face Mall, Colombo Fort Railway
Station), so a fare-calculation regression the Selenium suite would notice
in the browser shows up here first, under load, before it does there.
Samplers 06-08 are the validation-under-load counterpart to
`goride-auth-load.jmx`'s "stays 401 under load" sampler - proving
`FareController`'s 400s don't degrade into 500s once the service is busy,
not just when tested once by hand. Sampler 12 is deliberately grouped on
its own thread group so it keeps running throughout the other three -
it is the most direct signal for whether the database itself, not just the
API in front of it, is coping with the combined load.

### Prerequisites

- Apache JMeter 5.6 or newer and Java 17 or newer.
- The trip-matching service running at `http://localhost:8080` (plain HTTP,
  no certificate to accept), and identity-auth running too, since
  `GET /drivers/active` proxies through to it:

```powershell
.\goride-dev.ps1 start identity
.\goride-dev.ps1 start trip
```

That's it - no session cookie, no seeded driver profile.

### Running

Open the plan in the GUI:

```bash
jmeter -t tests/jmeter/goride-trip-load.jmx
```

Run without the GUI and generate the HTML dashboard:

```bash
jmeter -n -t tests/jmeter/goride-trip-load.jmx -l results-trip.jtl -e -o report-trip
```

The `report-trip` folder must not already exist.

### Properties

| Property | Default | Purpose |
| --- | --- | --- |
| `users` | `10` | Concurrent users per thread group |
| `rampUp` | `10` | Seconds to start all users |
| `loops` | `5` | Iterations per user |

Pass any of them with `-J`, for example `-Jusers=25 -Jloops=10`.

## Both plans

`*.jtl`, `jmeter.log` and any `report*/` folder are ignored by git - run
either plan (or both, with the `-trip` filenames above so their output
doesn't collide) without worrying about committing results.
