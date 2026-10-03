import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSessionCookie,
  clearSessionCookie,
  isCrossOriginMode,
  isCrossSiteRequest,
  isHttpsRequest,
} from "@/lib/cookies";
import { withCors } from "@/lib/cors";

const ENV_KEYS = ["ALLOWED_ORIGINS"];
const original: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) original[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.org/api/auth/login", { headers });
}

describe("session cookie policy", () => {
  it("is host-only: never sets a Domain attribute", () => {
    const c = buildSessionCookie({ req: req({ "x-forwarded-proto": "https" }), value: "abc" });
    expect(/Domain=/i.test(c)).toBe(false);
    expect(c.startsWith("jsnm_session=abc")).toBe(true);
    expect(c).toContain("Path=/");
    expect(c).toContain("HttpOnly");
  });

  it("sets Secure on HTTPS and omits it on plain HTTP", () => {
    expect(buildSessionCookie({ req: req({ "x-forwarded-proto": "https" }), value: "x" })).toContain("Secure");
    expect(buildSessionCookie({ req: req({ "x-forwarded-proto": "http" }), value: "x" })).not.toContain("Secure");
  });

  it("uses SameSite=Lax for same-origin deployments", () => {
    delete process.env.ALLOWED_ORIGINS;
    const c = buildSessionCookie({ req: req({ "x-forwarded-proto": "https" }), value: "x" });
    expect(c).toContain("SameSite=Lax");
    expect(c).not.toContain("SameSite=None");
  });

  it("uses SameSite=None + Secure for an allow-listed cross-origin frontend", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    expect(isCrossOriginMode()).toBe(true);
    // SameSite=None is only legal with Secure, even over plain HTTP
    const c = buildSessionCookie({ req: req({ "x-forwarded-proto": "http" }), value: "x" });
    expect(c).toContain("SameSite=None");
    expect(c).toContain("Secure");
  });

  it("clears the cookie with attributes identical to the setter", () => {
    const reqH = req({ "x-forwarded-proto": "https" });
    const set = buildSessionCookie({ req: reqH, value: "tok" });
    const clear = clearSessionCookie(reqH);
    expect(clear).toContain("Max-Age=0");
    expect(/SameSite=([^;]+)/.exec(set)?.[1]).toBe(/SameSite=([^;]+)/.exec(clear)?.[1]);
    expect(set.includes("Secure")).toBe(clear.includes("Secure"));
    expect(set.includes("HttpOnly")).toBe(clear.includes("HttpOnly"));
    expect(/Path=([^;]+)/.exec(set)?.[1]).toBe(/Path=([^;]+)/.exec(clear)?.[1]);
  });

  it("detects HTTPS behind a proxy", () => {
    expect(isHttpsRequest(req({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isHttpsRequest(req({ "x-forwarded-proto": "https, http" }))).toBe(true);
    expect(isHttpsRequest(req({ "x-forwarded-proto": "http" }))).toBe(false);
    expect(isHttpsRequest(req())).toBe(false);
  });
});

describe("embedded / cross-site context (Arena preview runs in a frame)", () => {
  it("detects a cross-site request from Fetch Metadata", () => {
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("falls back to comparing Origin with the served host", () => {
    const served = { "x-forwarded-host": "example.org" };
    expect(isCrossSiteRequest(req({ origin: "https://arena.example.com", ...served }))).toBe(true);
    expect(isCrossSiteRequest(req({ origin: "https://example.org", ...served }))).toBe(false);
  });

  it("emits SameSite=None + Secure + Partitioned for a cross-site request", () => {
    const c = buildSessionCookie({ req: req({ "sec-fetch-site": "cross-site" }), value: "tok" });
    expect(c).toContain("SameSite=None");
    expect(c).toContain("Secure");
    expect(c).toContain("Partitioned");
    expect(/Domain=/i.test(c)).toBe(false);
  });

  it("keeps the strong Lax policy (and no Partitioned) for a top-level request", () => {
    const c = buildSessionCookie({ req: req({ "sec-fetch-site": "same-origin", "x-forwarded-proto": "https" }), value: "tok" });
    expect(c).toContain("SameSite=Lax");
    expect(c).not.toContain("SameSite=None");
    expect(c).not.toContain("Partitioned");
  });

  it("clears a cross-site cookie with the same cross-site attributes", () => {
    const r = req({ "sec-fetch-site": "cross-site" });
    const set = buildSessionCookie({ req: r, value: "tok" });
    const clear = clearSessionCookie(r);
    expect(/SameSite=([^;]+)/.exec(set)?.[1]).toBe(/SameSite=([^;]+)/.exec(clear)?.[1]);
    expect(clear.includes("Partitioned")).toBe(set.includes("Partitioned"));
    expect(clear).toContain("Max-Age=0");
  });
});

describe("CORS credentials support", () => {
  it("allows credentials for an allow-listed origin (required for cookies cross-origin)", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const res = withCors(
      new Request("https://api.example.com/x", { headers: { origin: "https://app.example.com" } }),
      new Response("{}"),
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("denies unknown origins entirely (no CORS headers at all)", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const res = withCors(
      new Request("https://api.example.com/x", { headers: { origin: "https://evil.example.net" } }),
      new Response("{}"),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
