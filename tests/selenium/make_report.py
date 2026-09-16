"""
Turn a pytest run into a single self-contained HTML report with the screenshots
embedded, so it can be attached to the QA report or opened on any machine.

    python make_report.py

Runs pytest, writes evidence/report.html next to this file, opens it.
Nothing to install - pytest's --junitxml is built in.
"""

from __future__ import annotations

import base64
import html
import re
import subprocess
import sys
import webbrowser
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
XML = EVIDENCE / "junit.xml"
OUT = EVIDENCE / "report.html"

# Which SCRUM story each test speaks to, so the report reads like QA evidence
# rather than a list of function names.
STORY = {
    "test_landing_page_loads": ("Smoke", "The application serves and renders"),
    "test_sign_in_link_targets_the_identity_server":
        ("SCRUM-30", "Login is delegated to the identity server with a returnUrl"),
    "test_no_password_field_on_the_landing_page":
        ("SCRUM-30", "The application never collects a password itself"),
    "test_sign_in_reaches_asgardeo":
        ("SCRUM-30", "Sign in reaches the Asgardeo hosted login page"),
    "test_dashboard_is_not_readable_without_a_session":
        ("SCRUM-36", "A protected route renders nothing to an anonymous visitor"),
    "test_landing_page_does_not_scroll_sideways":
        ("UI", "The landing page does not scroll horizontally"),
    "test_sign_in_stays_reachable_at_every_size":
        ("UI", "The primary control stays visible at every viewport"),
    "test_page_has_no_console_errors":
        ("UI", "No uncaught JavaScript on the first page a user sees"),
}


def run_pytest() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    print("running pytest ...\n")
    subprocess.run(
        [sys.executable, "-m", "pytest", "-v", f"--junitxml={XML}"],
        cwd=HERE, check=False,
    )


def screenshots_for(test_name: str) -> list[Path]:
    stem = re.sub(r"[\[\]]", "-", test_name)
    return sorted(p for p in EVIDENCE.glob("*.png") if p.stem.startswith(stem.split("-")[0])
                  and test_name.split("[")[0] in p.stem)


def embed(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def build() -> None:
    root = ET.parse(XML).getroot()
    suite = root.find("testsuite") if root.tag == "testsuites" else root

    cases = []
    for case in suite.findall("testcase"):
        name = case.get("name", "")
        # An ElementTree Element with no children is falsy, so `find(a) or find(b)`
        # silently discards a real <failure> and the report claims a clean run.
        failure = case.find("failure")
        if failure is None:
            failure = case.find("error")
        skipped = case.find("skipped")
        outcome = "fail" if failure is not None else "skip" if skipped is not None else "pass"
        base = name.split("[")[0]
        story, intent = STORY.get(base, ("", base.replace("_", " ")))
        cases.append({
            "name": name, "story": story, "intent": intent, "outcome": outcome,
            "time": float(case.get("time", 0) or 0),
            "message": (failure.get("message", "") if failure is not None else ""),
            "shots": screenshots_for(name),
        })

    total = len(cases)
    passed = sum(1 for c in cases if c["outcome"] == "pass")
    failed = sum(1 for c in cases if c["outcome"] == "fail")
    duration = sum(c["time"] for c in cases)
    when = datetime.now().strftime("%d %B %Y, %H:%M")

    rows, details = [], []
    for i, c in enumerate(cases, 1):
        badge = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP"}[c["outcome"]]
        rows.append(f"""
        <tr class="{c['outcome']}">
          <td class="num">{i}</td>
          <td>{'<span class="story">' + html.escape(c['story']) + '</span>' if c['story'] else ''}</td>
          <td class="intent">{html.escape(c['intent'])}<div class="fn">{html.escape(c['name'])}</div></td>
          <td class="ms">{c['time']:.2f}s</td>
          <td><span class="badge {c['outcome']}">{badge}</span></td>
        </tr>""")

        if c["outcome"] == "fail":
            msg = html.escape(c["message"].strip().splitlines()[0] if c["message"] else "")
            details.append(f"""
      <div class="failure">
        <h3>{html.escape(c['name'])}</h3>
        <pre>{msg}</pre>
      </div>""")

    gallery = []
    for c in cases:
        for shot in c["shots"]:
            label = shot.stem.split("__", 1)[-1]
            gallery.append(f"""
        <figure class="{c['outcome']}">
          <img src="{embed(shot)}" alt="{html.escape(label)}">
          <figcaption><span class="badge {c['outcome']}">{c['outcome'].upper()}</span>
            {html.escape(label)}</figcaption>
        </figure>""")

    OUT.write_text(TEMPLATE.format(
        when=when, total=total, passed=passed, failed=failed,
        pct=(passed / total * 100 if total else 0), duration=duration,
        rows="".join(rows),
        failures=("<h2>Failure detail</h2>" + "".join(details)) if details else "",
        gallery="".join(gallery),
    ), encoding="utf-8")

    print(f"\n  {passed}/{total} passed  ->  {OUT}")


TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GoRide UI Test Report</title>
<style>
  :root {{
    --bg:#f2f4f7; --card:#fff; --line:#dde3ea; --ink:#161b22; --ink2:#5b6672;
    --pass:#10684c; --pass-bg:#dcefe6; --fail:#a52019; --fail-bg:#f8dedb;
    --skip:#7a6a20; --skip-bg:#f5eccf; --accent:#b25e12;
  }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink);
    font:15px/1.55 "Segoe UI",system-ui,sans-serif; }}
  .wrap {{ max-width:1080px; margin:0 auto; padding:36px 22px 80px; }}
  header {{ border-bottom:3px solid var(--ink); padding-bottom:20px; }}
  .eyebrow {{ font:600 11px/1 ui-monospace,monospace; letter-spacing:.14em;
    text-transform:uppercase; color:var(--accent); }}
  h1 {{ margin:10px 0 4px; font-size:32px; letter-spacing:-.02em; }}
  .sub {{ color:var(--ink2); margin:0; }}
  .tiles {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    gap:12px; margin:22px 0 34px; }}
  .tile {{ background:var(--card); border:1px solid var(--line); border-radius:4px; padding:14px 16px; }}
  .tile b {{ display:block; font-size:28px; line-height:1.1; font-variant-numeric:tabular-nums; }}
  .tile span {{ font:600 11px/1 ui-monospace,monospace; letter-spacing:.08em;
    text-transform:uppercase; color:var(--ink2); }}
  .tile.ok b {{ color:var(--pass); }} .tile.bad b {{ color:var(--fail); }}
  h2 {{ font-size:19px; margin:34px 0 12px; }}
  table {{ width:100%; border-collapse:collapse; background:var(--card);
    border:1px solid var(--line); border-radius:4px; overflow:hidden; }}
  th {{ text-align:left; padding:9px 14px; background:#e8edf2;
    font:600 11px/1 ui-monospace,monospace; letter-spacing:.07em;
    text-transform:uppercase; color:var(--ink2); }}
  td {{ padding:10px 14px; border-top:1px solid var(--line); vertical-align:top; }}
  .num,.ms {{ font-variant-numeric:tabular-nums; color:var(--ink2); white-space:nowrap; }}
  .fn {{ font:12px ui-monospace,monospace; color:var(--ink2); margin-top:2px; }}
  .story {{ font:600 11px ui-monospace,monospace; background:#e6ecf2;
    padding:2px 7px; border-radius:2px; white-space:nowrap; }}
  .badge {{ font:600 11px ui-monospace,monospace; padding:2px 8px; border-radius:2px; }}
  .badge.pass {{ background:var(--pass-bg); color:var(--pass); }}
  .badge.fail {{ background:var(--fail-bg); color:var(--fail); }}
  .badge.skip {{ background:var(--skip-bg); color:var(--skip); }}
  tr.fail td {{ background:#fdf6f5; }}
  .failure {{ background:var(--card); border:1px solid var(--line);
    border-left:3px solid var(--fail); border-radius:3px; padding:12px 16px; margin-bottom:10px; }}
  .failure h3 {{ margin:0 0 6px; font:600 14px ui-monospace,monospace; }}
  .failure pre {{ margin:0; white-space:pre-wrap; font:12.5px ui-monospace,monospace;
    color:var(--fail); }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }}
  figure {{ margin:0; background:var(--card); border:1px solid var(--line);
    border-radius:4px; overflow:hidden; }}
  figure.fail {{ border-color:#e8b5b0; }}
  figure img {{ display:block; width:100%; border-bottom:1px solid var(--line); }}
  figcaption {{ padding:9px 12px; font-size:12.5px; color:var(--ink2);
    display:flex; gap:8px; align-items:center; }}
  footer {{ margin-top:40px; padding-top:16px; border-top:1px solid var(--line);
    color:var(--ink2); font-size:13px; }}
</style></head><body><div class="wrap">

<header>
  <div class="eyebrow">Selenium WebDriver &middot; Chrome &middot; goride-frontend</div>
  <h1>GoRide UI Test Report</h1>
  <p class="sub">Automated browser tests against http://localhost:3000 &mdash; {when}</p>
</header>

<div class="tiles">
  <div class="tile"><b>{total}</b><span>Tests run</span></div>
  <div class="tile ok"><b>{passed}</b><span>Passed</span></div>
  <div class="tile bad"><b>{failed}</b><span>Failed</span></div>
  <div class="tile"><b>{pct:.0f}%</b><span>Pass rate</span></div>
  <div class="tile"><b>{duration:.0f}s</b><span>Duration</span></div>
</div>

<h2>Test results</h2>
<table>
  <thead><tr><th>#</th><th>Story</th><th>What it verifies</th><th>Time</th><th>Result</th></tr></thead>
  <tbody>{rows}</tbody>
</table>

{failures}

<h2>Evidence</h2>
<div class="grid">{gallery}</div>

<footer>Generated by make_report.py from the pytest JUnit XML. Screenshots are embedded,
so this file can be attached or opened anywhere.</footer>

</div></body></html>"""


if __name__ == "__main__":
    run_pytest()
    build()
    webbrowser.open(OUT.as_uri())
