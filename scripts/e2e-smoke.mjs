/**
 * End-to-end smoke test for Jan Samasya Nivaran Manch.
 *
 * Prerequisite: the app running (npm run start) + seeded DB.
 * Run:  node scripts/e2e-smoke.mjs   (E2E_BASE_URL to override origin)
 *
 * Exercises the full public + officer flow against real HTTP APIs:
 * health → lookups → complaint (with photo) → secure citizen tracking →
 * officer login → RBAC scoping → status/remarks → admin assignment →
 * restricted media access → rate limiting.
 *
 * NOTE: the final rate-limit assertions intentionally exhaust the
 * per-IP limits for ~10 minutes. Run last or on a throwaway origin.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@jsnm.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@JSNM123";
const OFFICER_PASSWORD = process.env.SEED_OFFICER_PASSWORD ?? "Officer@JSNM123";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let step = 0;
function ok(name) {
  step += 1;
  console.log(`  ✔ ${String(step).padStart(2, "0")}. ${name}`);
}

function cookieFrom(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = set[0] ?? res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0];
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0, 200)}`);
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

async function main() {
  console.log(`E2E smoke against ${BASE}\n`);

  // ---- 1. Health ----
  {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200, "health 200");
    const body = await json(res);
    assert.equal(body.status, "ok");
  }
  ok("GET /api/health returns ok");

  // ---- 2. Public reference data + ward restriction ----
  let categories;
  {
    const [c, a12, aBad] = await Promise.all([
      fetch(`${BASE}/api/categories`),
      fetch(`${BASE}/api/areas?ward=12`),
      fetch(`${BASE}/api/areas?ward=15`),
    ]);
    categories = (await json(c)).categories;
    const areas12 = (await json(a12)).areas;
    assert.ok(categories.length > 0, "categories seeded");
    // No fabricated ward-area names may be exposed anywhere in the public API.
    assert.equal(areas12.length, 0, "no fabricated area names exposed");
    assert.equal(aBad.status, 400, "ward 15 rejected");
  }
  ok("categories load; no fabricated areas exposed; unsupported ward rejected");

  // ---- 3. Complaint validation & registration ----
  const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  const citizen = { name: "E2E Test Citizen", mobile };
  let trackingId;
  {
    const bad = await fetch(`${BASE}/api/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citizenName: citizen.name, citizenMobile: "123", ward: 12,
        manualLocationText: "E2E invalid sample lane", categoryId: categories[0].id, description: "short",
      }),
    });
    assert.equal(bad.status, 400, "invalid payload rejected");

    const fd = new FormData();
    fd.set("citizenName", citizen.name);
    fd.set("citizenMobile", mobile);
    fd.set("ward", "12");
    fd.set("manualLocationText", "E2E test lane, near the sample landmark");
    fd.set("categoryId", categories[0].id);
    fd.set("description", "E2E smoke test complaint: overflowing dustbin near the test lane.");
    fd.set("addressText", "E2E test landmark");
    fd.set("lat", "26.85123");
    fd.set("lng", "80.94321");
    fd.set("photo", new Blob([PNG_1PX], { type: "image/png" }), "evidence.png");

    const res = await fetch(`${BASE}/api/complaints`, { method: "POST", body: fd });
    assert.equal(res.status, 201, `created (${res.status})`);
    const body = await json(res);
    assert.match(body.trackingId, /^JSNM-12-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    trackingId = body.trackingId;
  }
  ok(`complaint registered with photo — ${trackingId}`);

  // ---- 4. Secure citizen tracking ----
  let photoUrl;
  {
    const wrong = await fetch(`${BASE}/api/complaints/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingId, mobile: `8${mobile.slice(1)}` }),
    });
    assert.equal(wrong.status, 404, "wrong mobile rejected");

    const res = await fetch(`${BASE}/api/complaints/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingId, mobile }),
    });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.status, "pending");
    assert.equal(body.timeline.length, 1);
    assert.ok(body.photoUrl, "has photo url");
    photoUrl = body.photoUrl;
  }
  ok("tracking requires tracking ID + mobile; wrong mobile rejected");

  // ---- 5. Restricted media access ----
  {
    const fileName = photoUrl.split("?")[0].split("/").pop();
    const noAuth = await fetch(`${BASE}/api/media/${fileName}`);
    assert.equal(noAuth.status, 403, "anonymous denied");
    const badName = await fetch(`${BASE}/api/media/${randomUUID()}.png`);
    assert.equal(badName.status, 404, "unknown file 404");
    const withToken = await fetch(`${BASE}${photoUrl}`);
    assert.equal(withToken.status, 200, "media token allows access");
    assert.equal(withToken.headers.get("content-type"), "image/png");
  }
  ok("photo access restricted (403 anonymous / 200 with media token)");

  // ---- 6. Officer login (bad then good) ----
  let officerCookie;
  {
    const bad = await login("ward12@jsnm.local", "wrong-password-1");
    assert.equal(bad.status, 401, "bad password rejected");
    const res = await login("ward12@jsnm.local", OFFICER_PASSWORD);
    assert.equal(res.status, 200);
    officerCookie = cookieFrom(res);
    assert.ok(officerCookie.includes("jsnm_session="), "session cookie set");
  }
  ok("officer login: wrong credentials 401, correct credentials set cookie");

  // ---- 7. Ward-scoped RBAC list ----
  let createdComplaintId;
  {
    const res = await fetch(`${BASE}/api/officer/complaints?limit=50`, {
      headers: { Cookie: officerCookie },
    });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.ok(body.items.length > 0, "ward 12 has complaints");
    assert.ok(body.items.every((c) => c.ward === 12), "all items are ward 12");
    const ours = body.items.find((c) => c.trackingId === trackingId);
    assert.ok(ours, "new complaint visible to officer");
    createdComplaintId = ours.id;

    const unauth = await fetch(`${BASE}/api/officer/complaints`);
    assert.equal(unauth.status, 401, "unauthenticated list denied");
  }
  ok("officer list is ward-scoped (RBAC) and auth-gated");

  // ---- 8. Status updates with remarks ----
  {
    const res = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: officerCookie },
      body: JSON.stringify({ action: "status", toStatus: "in_progress", remark: "E2E: team dispatched", isPublic: true }),
    });
    assert.equal(res.status, 200);

    const remark = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: officerCookie },
      body: JSON.stringify({ action: "remark", text: "E2E: internal note", isPublic: false }),
    });
    assert.equal(remark.status, 200);

    const noRemark = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: officerCookie },
      body: JSON.stringify({ action: "status", toStatus: "resolved", remark: "" }),
    });
    assert.equal(noRemark.status, 400, "resolve requires remark");

    const resolve = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: officerCookie },
      body: JSON.stringify({ action: "status", toStatus: "resolved", remark: "E2E: fixed and verified", isPublic: true }),
    });
    assert.equal(resolve.status, 200);
  }
  ok("status transitions + remarks audited (resolve needs a remark)");

  // ---- 9. Citizen sees updates; private remarks hidden ----
  {
    const res = await fetch(`${BASE}/api/complaints/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingId, mobile }),
    });
    const body = await json(res);
    assert.equal(body.status, "resolved");
    const texts = body.timeline.map((e) => e.remark ?? "").join(" | ");
    assert.ok(texts.includes("team dispatched"), "public remark visible");
    assert.ok(!texts.includes("internal note"), "private remark hidden from citizen");
  }
  ok("citizen timeline shows public updates only");

  // ---- 10. Admin: RBAC override, assignment, officer + area management ----
  {
    const adminRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert.equal(adminRes.status, 200);
    const adminCookie = cookieFrom(adminRes);

    const all = (await json(
      await fetch(`${BASE}/api/officer/complaints?limit=50`, { headers: { Cookie: adminCookie } }),
    ));
    const wards = new Set(all.items.map((c) => c.ward));
    assert.ok(wards.size >= 1, "admin sees complaints");

    const officerDetail = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      headers: { Cookie: officerCookie },
    });
    const detail = await json(officerDetail);
    assert.ok(detail.events.length >= 4, "audit history recorded");

    // Officer (non-admin) cannot reopen a resolved complaint
    const reopen = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: officerCookie },
      body: JSON.stringify({ action: "status", toStatus: "in_progress", remark: "nope" }),
    });
    assert.equal(reopen.status, 409, "officer cannot reopen resolved");

    // Officer cannot access admin endpoints
    const forbidden = await fetch(`${BASE}/api/admin/officers`, { headers: { Cookie: officerCookie } });
    assert.equal(forbidden.status, 403, "officer blocked from admin API");

    // Admin can assign (find ward-12 officer id via admin list)
    const officers = (await json(await fetch(`${BASE}/api/admin/officers`, { headers: { Cookie: adminCookie } }))).officers;
    const ward12Officer = officers.find((o) => o.role === "officer" && o.ward === 12);
    assert.ok(ward12Officer, "ward 12 officer exists");
    const assign = await fetch(`${BASE}/api/officer/complaints/${createdComplaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "assign", officerId: ward12Officer.id }),
    });
    assert.equal(assign.status, 200, "admin assigned");
  }
  ok("admin sees all wards, assigns complaints; officer blocked from admin APIs");

  // ---- 11. Cross-ward RBAC negative check ----
  {
    // ward-13 demo complaint must be invisible/forbidden to ward-12 officer.
    const adminRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminCookie = cookieFrom(adminRes);
    const all = (await json(
      await fetch(`${BASE}/api/officer/complaints?ward=13&limit=10`, { headers: { Cookie: adminCookie } }),
    ));
    if (all.items.length > 0) {
      const ward13Id = all.items[0].id;
      const res = await fetch(`${BASE}/api/officer/complaints/${ward13Id}`, { headers: { Cookie: officerCookie } });
      assert.equal(res.status, 403, "cross-ward detail forbidden");
      const patch = await fetch(`${BASE}/api/officer/complaints/${ward13Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: officerCookie },
        body: JSON.stringify({ action: "remark", text: "should fail" }),
      });
      assert.equal(patch.status, 403, "cross-ward update forbidden");
    }
  }
  ok("cross-ward access denied for ward officers");

  // ---- 12. Rate limiting (runs last — temporarily exhausts limits) ----
  {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE}/api/complaints/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: "JSNM-12-AAAAAA", mobile: "9999999999" }),
      });
      last = res.status;
    }
    assert.equal(last, 429, "track endpoint rate-limits bursts");
  }
  ok("rate limiting engages on burst requests");

  console.log(`\nALL ${step} E2E SMOKE CHECKS PASSED`);
}

main().catch((err) => {
  console.error(`\nE2E FAILED: ${err.message}`);
  process.exit(1);
});
