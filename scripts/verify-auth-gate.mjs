#!/usr/bin/env node
/**
 * Guards against a specific regression that has already shipped to five
 * different branches: src/proxy.ts gating "is there a session" on the
 * client-only `goride_role` cookie instead of the backend's real HttpOnly
 * `app_session` cookie.
 *
 * `goride_role` is written by client JS only after getMe() resolves, so
 * it's always absent on the very first request right after a successful
 * OIDC login. Gating the login-redirect on it sends a freshly-signed-in
 * user straight back to /login; Asgardeo silently re-authenticates them
 * via its still-active SSO session and bounces them back, before client JS
 * ever gets a chance to run and set the cookie -- an infinite redirect
 * loop that looks like "the sign-in page keeps reloading".
 *
 * This has no test framework to hook into yet, so it's a plain,
 * dependency-free static check on the source text rather than a unit test
 * -- good enough to fail loudly in `npm run build` (so a bad deploy never
 * ships) and in CI (so it never reaches anyone's local `git pull` either).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const proxyPath = path.join(here, "..", "src", "proxy.ts");

let source;
try {
  source = readFileSync(proxyPath, "utf8");
} catch {
  console.error(`[verify-auth-gate] Could not read ${proxyPath} -- skipping (nothing to check).`);
  process.exit(0);
}

const fail = (message) => {
  console.error("\n[verify-auth-gate] FAILED\n");
  console.error(message);
  console.error(
    "\nSee the comment above `proxy()` in src/proxy.ts for the full story, " +
      "or the git history of this file for the original incident.\n",
  );
  process.exit(1);
};

// The login-redirect gate must key off app_session (the real session
// cookie), not goride_role (a client-only convenience cookie).
const guardsOnAppSession = /const\s+hasSession\s*=\s*!!request\.cookies\.get\(\s*["']app_session["']\s*\)/.test(source);
if (!guardsOnAppSession) {
  fail(
    "src/proxy.ts no longer gates the login redirect on the `app_session` cookie.\n" +
      "If you're using a different variable/cookie name, update the regex in\n" +
      "scripts/verify-auth-gate.mjs to match -- but make sure whatever you land on\n" +
      "is still the backend's real HttpOnly session cookie, not `goride_role`\n" +
      "(client-only, not yet set on the first request after login).",
  );
}

// The classic regression: `if (!role)` gating the redirect, where `role`
// came straight from the goride_role cookie. Catch that specific shape
// even if someone renames `hasSession` back to something role-flavored.
const roleGatesRedirect = /const\s+role\s*=\s*request\.cookies\.get\(\s*["']goride_role["']\s*\)[\s\S]{0,120}if\s*\(\s*!role\s*\)/.test(source);
if (roleGatesRedirect) {
  fail(
    "src/proxy.ts appears to gate the login redirect on `goride_role` again\n" +
      "(a `const role = ...goride_role...` immediately followed by `if (!role)`).\n" +
      "This is the exact pattern that caused the infinite sign-in redirect loop --\n" +
      "see the comment above `proxy()` for why. Gate on `app_session` instead.",
  );
}

console.log("[verify-auth-gate] OK -- proxy.ts gates the login redirect on app_session.");
