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

  const {
    handleAuthProxy,
    ROLE_COOKIE_NAME,
    signRoleCookie,
    verifyRoleCookie,
    getHomeRouteForRole,
  } = await import("./auth-proxy");
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

  // 5. signRoleCookie("CHIEF") is accepted by verifyRoleCookie(...) and returns "CHIEF"
  const chiefRoleCookie = signRoleCookie("CHIEF");
  const verifiedChiefRole = verifyRoleCookie(chiefRoleCookie);
  if (verifiedChiefRole !== "CHIEF") {
    throw new Error(
      `FAIL: verifyRoleCookie(signRoleCookie("CHIEF")) should return "CHIEF", got ${String(verifiedChiefRole)}`
    );
  }

  // 6. getHomeRouteForRole("id", "CHIEF") === "/id/operator"
  const chiefHomeRoute = getHomeRouteForRole("id", "CHIEF");
  if (chiefHomeRoute !== "/id/operator") {
    throw new Error(
      `FAIL: getHomeRouteForRole("id", "CHIEF") should return "/id/operator", got "${chiefHomeRoute}"`
    );
  }

  const chiefCookieHeader = `better-auth.session_token=${encodeURIComponent(sessionToken)}; ${ROLE_COOKIE_NAME}=${chiefRoleCookie}`;

  // 7. Authenticated CHIEF GET /id/operator returns non-redirect (status === 200)
  const chiefOperatorReq = new NextRequest("http://localhost:3000/id/operator", {
    method: "GET",
    headers: {
      cookie: chiefCookieHeader,
    },
  });
  const chiefOperatorRes = await handleAuthProxy(chiefOperatorReq, {
    locale: "id",
    routeSegment: "operator",
    subSegments: [],
  });
  if (chiefOperatorRes.status !== 200) {
    throw new Error(
      `FAIL: Authenticated CHIEF GET /id/operator should return 200, got status ${chiefOperatorRes.status} location=${chiefOperatorRes.headers.get("location")}`
    );
  }

  // 8. Authenticated CHIEF GET /id/operator/accounts redirects (307) to http://localhost:3000/id/operator
  const chiefAccountsReq = new NextRequest(
    "http://localhost:3000/id/operator/accounts",
    {
      method: "GET",
      headers: {
        cookie: chiefCookieHeader,
      },
    }
  );
  const chiefAccountsRes = await handleAuthProxy(chiefAccountsReq, {
    locale: "id",
    routeSegment: "operator",
    subSegments: ["accounts"],
  });
  if (
    chiefAccountsRes.status !== 307 ||
    chiefAccountsRes.headers.get("location") !==
      "http://localhost:3000/id/operator"
  ) {
    throw new Error(
      `FAIL: Authenticated CHIEF GET /id/operator/accounts should redirect (307) to http://localhost:3000/id/operator, got status ${chiefAccountsRes.status} location=${chiefAccountsRes.headers.get("location")}`
    );
  }

  // 9. Authenticated CHIEF GET /id/operator/perimeter-damage redirects (307) to http://localhost:3000/id/operator
  const chiefDamageReq = new NextRequest(
    "http://localhost:3000/id/operator/perimeter-damage",
    {
      method: "GET",
      headers: {
        cookie: chiefCookieHeader,
      },
    }
  );
  const chiefDamageRes = await handleAuthProxy(chiefDamageReq, {
    locale: "id",
    routeSegment: "operator",
    subSegments: ["perimeter-damage"],
  });
  if (
    chiefDamageRes.status !== 307 ||
    chiefDamageRes.headers.get("location") !==
      "http://localhost:3000/id/operator"
  ) {
    throw new Error(
      `FAIL: Authenticated CHIEF GET /id/operator/perimeter-damage should redirect (307) to http://localhost:3000/id/operator, got status ${chiefDamageRes.status} location=${chiefDamageRes.headers.get("location")}`
    );
  }

  // 10. Authenticated OPERATOR GET /id/operator/accounts returns non-redirect (status === 200)
  const operatorRoleCookie = signRoleCookie("OPERATOR");
  const operatorCookieHeader = `better-auth.session_token=${encodeURIComponent(sessionToken)}; ${ROLE_COOKIE_NAME}=${operatorRoleCookie}`;
  const operatorAccountsReq = new NextRequest(
    "http://localhost:3000/id/operator/accounts",
    {
      method: "GET",
      headers: {
        cookie: operatorCookieHeader,
      },
    }
  );
  const operatorAccountsRes = await handleAuthProxy(operatorAccountsReq, {
    locale: "id",
    routeSegment: "operator",
    subSegments: ["accounts"],
  });
  if (operatorAccountsRes.status !== 200) {
    throw new Error(
      `FAIL: Authenticated OPERATOR GET /id/operator/accounts should return 200, got status ${operatorAccountsRes.status} location=${operatorAccountsRes.headers.get("location")}`
    );
  }

  // 11. Authenticated CHIEF GET /id/login?callbackUrl=/id/operator/accounts redirects (307) to http://localhost:3000/id/operator (NOT /id/operator/accounts)
  const chiefLoginCallbackReq = new NextRequest(
    "http://localhost:3000/id/login?callbackUrl=/id/operator/accounts",
    {
      method: "GET",
      headers: {
        cookie: chiefCookieHeader,
      },
    }
  );
  const chiefLoginCallbackRes = await handleAuthProxy(chiefLoginCallbackReq, {
    locale: "id",
    routeSegment: "login",
    subSegments: [],
  });
  if (
    chiefLoginCallbackRes.status !== 307 ||
    chiefLoginCallbackRes.headers.get("location") !==
      "http://localhost:3000/id/operator"
  ) {
    throw new Error(
      `FAIL: Authenticated CHIEF GET /id/login?callbackUrl=/id/operator/accounts should redirect (307) to http://localhost:3000/id/operator, got status ${chiefLoginCallbackRes.status} location=${chiefLoginCallbackRes.headers.get("location")}`
    );
  }

  console.log("All auth proxy regression tests passed successfully!");
  return true;
}

runAuthProxyTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
