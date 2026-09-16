import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side route guard — runs on every matching request before the page
 * component renders. This eliminates the flash-of-protected-content that the
 * client-side RoleGuard alone can't prevent.
 *
 * Auth model:
 *  - `app_session` is the backend's real HttpOnly session cookie -- present
 *    immediately after the OIDC callback, so it's what gates "is there a
 *    session at all".
 *  - `goride_role` is written by session.ts only after client JS has loaded
 *    and called getMe(); it's used here only for the softer route-level
 *    role restriction, and is treated as absent-is-fine (deferred to the
 *    client-side RoleGuard) rather than a login gate.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Redirect to the identity provider login, preserving the intended destination. */
function toLogin(destination: string): NextResponse {
  const returnUrl = `${APP_URL}${destination}`;
  const loginUrl = `${API_URL}/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  return NextResponse.redirect(loginUrl);
}

/**
 * Routes that require a signed-in session of any role.
 * Add new protected path prefixes here as the app grows.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/rider",
  "/driver",
  "/admin",
  "/onboarding",
];

/**
 * Role-restricted path prefixes.
 * A signed-in user whose role isn't in the allowed list is bounced to /dashboard.
 */
const ROLE_RESTRICTED: { prefix: string; roles: string[] }[] = [
  { prefix: "/rider", roles: ["Rider"] },
  { prefix: "/driver", roles: ["Driver"] },
  { prefix: "/admin", roles: ["Admin"] },
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // `app_session` is the backend's real (HttpOnly) auth cookie, so it's
  // already present on the very first request after login — unlike
  // `goride_role`, which client JS only writes after a page has loaded and
  // called getMe(). Gating on `goride_role` here caused an infinite loop on
  // a fresh sign-in: the first /dashboard request always has no goride_role
  // yet, so the proxy bounced back to /login, Asgardeo silently
  // re-authenticated via its existing SSO session, and the cycle repeated
  // forever without client JS ever getting a chance to run and set the
  // cookie. Reading HttpOnly cookies from middleware is fine — that
  // restriction only applies to document.cookie in the browser.
  const hasSession = !!request.cookies.get("app_session");

  // No session cookie at all → bounce to identity login
  if (!hasSession) {
    // If API_URL is not configured we can't redirect properly; let the
    // client-side guard handle it rather than sending to a dead URL.
    if (!API_URL || !APP_URL) return NextResponse.next();
    return toLogin(pathname);
  }

  // Session exists — check route-level role restrictions using the
  // client-set role cookie. It may not be populated yet on the first
  // request right after login; when absent, let the request through and
  // defer to the client-side RoleGuard once it hydrates.
  const role = request.cookies.get("goride_role")?.value ?? null;
  const restriction = ROLE_RESTRICTED.find((r) =>
    pathname.startsWith(r.prefix),
  );
  if (role && restriction && !restriction.roles.includes(role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all paths that need a session check.
   * Exclude Next.js internals and static files so they are never blocked.
   */
  matcher: [
    "/dashboard/:path*",
    "/rider/:path*",
    "/driver/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
  ],
};
