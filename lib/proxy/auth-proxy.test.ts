import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const TEST_SECRET = "test-secret-for-auth-proxy-regression-tests";
process.env.BETTER_AUTH_SECRET ||= TEST_SECRET;

function buildSignedSessionToken(token: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(token).digest("base64");
  return `${token}.${sig}`;
}

export async function runAuthProxyTests(): Promise<boolean> {
  console.log("Running auth proxy regression tests...");

  const { handleAuthProxy, ROLE_COOKIE_NAME, signRoleCookie } = await import(
    "./auth-proxy"
  );
  const { AUTH_SECRET } = await import("@/lib/auth");

  const sessionToken = buildSignedSessionToken("session-token-123", AUTH_SECRET);
  const roleCookie = signRoleCookie("REPORTER");
  const authCookieHeader = `better-auth.session_token=${encodeURIComponent(sessionToken)}; ${ROLE_COOKIE_NAME}=${roleCookie}`;

  // 1. Authenticated Server Action POST on /[locale]/login must NOT be redirected (307 breaks Next.js Server Actions)
  const serverActionReq = new NextRequest("http://localhost:3000/id/login", {
    method: "POST",
    headers: {
      cookie: authCookieHeader,
      "next-action": "fake-login-action-id",
    },
  });
  const serverActionRes = await handleAuthProxy(serverActionReq, {
    locale: "id",
    routeSegment: "login",
    subSegments: [],
  });

  if (serverActionRes.status >= 300 && serverActionRes.status < 400) {
    throw new Error(
      `FAIL: Authenticated Server Action POST to /id/login was redirected with status ${serverActionRes.status} to ${serverActionRes.headers.get("location")}`
    );
  }

  // 2. Authenticated GET on /[locale]/login must STILL redirect to role home
  const authedGetReq = new NextRequest("http://localhost:3000/id/login", {
    method: "GET",
    headers: {
      cookie: authCookieHeader,
    },
  });
  const authedGetRes = await handleAuthProxy(authedGetReq, {
    locale: "id",
    routeSegment: "login",
    subSegments: [],
  });

  if (
    authedGetRes.status !== 307 ||
    authedGetRes.headers.get("location") !== "http://localhost:3000/id/reports"
  ) {
    throw new Error(
      `FAIL: Authenticated GET to /id/login should redirect (307) to /id/reports, got status ${authedGetRes.status} location=${authedGetRes.headers.get("location")}`
    );
  }

  // 3. Unauthenticated GET on /[locale]/login must set Cache-Control: no-store to prevent stale bfcache restores
  const unauthedGetReq = new NextRequest("http://localhost:3000/id/login", {
    method: "GET",
  });
  const unauthedGetRes = await handleAuthProxy(unauthedGetReq, {
    locale: "id",
    routeSegment: "login",
    subSegments: [],
  });

  const cacheControl = unauthedGetRes.headers.get("cache-control") || "";
  if (!cacheControl.toLowerCase().includes("no-store")) {
    throw new Error(
      `FAIL: Unauthenticated GET to /id/login must include Cache-Control: no-store, got "${cacheControl}"`
    );
  }

  // 4. Unauthenticated GET on /[locale]/login with stale cookies must clear them and still set no-store
  const staleGetReq = new NextRequest("http://localhost:3000/id/login", {
    method: "GET",
    headers: {
      cookie: "better-auth.session_token=invalid.token",
    },
  });
  const staleGetRes = await handleAuthProxy(staleGetReq, {
    locale: "id",
    routeSegment: "login",
    subSegments: [],
  });

  const staleCacheControl = staleGetRes.headers.get("cache-control") || "";
  if (!staleCacheControl.toLowerCase().includes("no-store")) {
    throw new Error(
      `FAIL: Stale-cookie GET to /id/login must include Cache-Control: no-store, got "${staleCacheControl}"`
    );
  }

  const clearedToken = staleGetRes.cookies.get("better-auth.session_token");
  if (!clearedToken || clearedToken.value !== "") {
    throw new Error(
      "FAIL: Stale-cookie GET to /id/login did not clear better-auth.session_token"
    );
  }

  console.log("All auth proxy regression tests passed successfully!");
  return true;
}

runAuthProxyTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
