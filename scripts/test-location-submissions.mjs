/**
 * Location submission scenarios — end-to-end against a RUNNING app.
 *
 *   node scripts/test-location-submissions.mjs     (E2E_BASE_URL to override)
 *
 * Current contract:
 *   - "Colony / Area / Landmark" text is REQUIRED and saved as
 *     `manualLocationText` (labelled "Citizen-provided location").
 *   - GPS is OPTIONAL and never blocks submission.
 *   - No fabricated area list is used; citizens type any locality.
 *
 * Each request uses a distinct X-Forwarded-For so the per-IP rate limiter is
 * not exhausted (rate limiting itself is covered by scripts/e2e-smoke.mjs).
 * Created rows carry the test label "Location Test *" so
 * scripts/cleanup-demo.ts can remove them again.
 */
import assert from "node:assert/strict";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let step = 0;
const ok = (n) => { step += 1; console.log(`  ✔ ${String(step).padStart(2, "0")}. ${n}`); };
const fail = (m) => { console.error(`\nFAILED: ${m}`); process.exit(1); };

const uniqueIp = () => `198.51.100.${Math.floor(1 + Math.random() * 250)}`;
const mobileFor = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

function formPayload(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
  return fd;
}

async function submit(fields) {
  const res = await fetch(`${BASE}/api/complaints`, {
    method: "POST",
    headers: { "x-forwarded-for": uniqueIp() },
    body: formPayload(fields),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function track(trackingId, mobile) {
  const res = await fetch(`${BASE}/api/complaints/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": uniqueIp() },
    body: JSON.stringify({ trackingId, mobile }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  console.log(`Location submission scenarios against ${BASE}\n`);

  const cats = (await (await fetch(`${BASE}/api/categories`)).json()).categories;
  assert.ok(cats?.length > 0, "categories available");
  const categoryId = cats[0].id;

  // ---- 1. Manual location only (GPS not shared) ----
  {
    const mobile = mobileFor();
    const { status, body } = await submit({
      citizenName: "Location Test A", citizenMobile: mobile, categoryId,
      description: "Scenario A: typed location only, no GPS shared.",
      manualLocationText: "Lane behind the primary school, Ward 12",
    });
    assert.equal(status, 201, `manual submit (${status}: ${JSON.stringify(body)})`);
    const t = await track(body.trackingId, mobile);
    assert.equal(t.body.locationMethod, "manual", `got ${t.body.locationMethod}`);
    assert.equal(t.body.manualLocationText, "Lane behind the primary school, Ward 12");
    assert.equal(t.body.locationLabel, "Citizen-provided location", "labelled as citizen-provided");
    assert.equal(t.body.lat, null, "GPS optional — none stored when not shared");
    ok(`manual only → 201, saved + labelled "Citizen-provided location", GPS optional (${body.trackingId})`);
  }

  // ---- 2. Manual + GPS together ----
  {
    const mobile = mobileFor();
    const { status, body } = await submit({
      citizenName: "Location Test B", citizenMobile: mobile, categoryId,
      description: "Scenario B: typed description plus an optional GPS position.",
      manualLocationText: "Main Road near the temple steps",
      lat: "26.84700", lng: "80.95100",
    });
    assert.equal(status, 201, `manual+gps submit (${status}: ${JSON.stringify(body)})`);
    const t = await track(body.trackingId, mobile);
    assert.equal(t.body.locationMethod, "gps_and_manual", `got ${t.body.locationMethod}`);
    assert.equal(t.body.manualLocationText, "Main Road near the temple steps", "text NOT replaced by GPS");
    assert.equal(t.body.lat, 26.847);
    assert.equal(t.body.lng, 80.951);
    ok(`manual + GPS → 201, locationMethod=gps_and_manual, both preserved (${body.trackingId})`);
  }

  // ---- 3. Missing location text → REJECTED (field is required) ----
  {
    const { status, body } = await submit({
      citizenName: "Location Test C", citizenMobile: mobileFor(), categoryId,
      description: "Scenario C: deliberately submitted without any location text.",
    });
    assert.equal(status, 400, `missing location must be rejected (got ${status})`);
    assert.ok(
      JSON.stringify(body).toLowerCase().includes("location"),
      `clear location error expected, got ${JSON.stringify(body)}`,
    );
    ok("missing Colony/Area/Landmark → 400 (manual location is required)");
  }

  // ---- 4. Whitespace normalised, arbitrary locality accepted ----
  {
    const mobile = mobileFor();
    const { status, body } = await submit({
      citizenName: "Location Test D", citizenMobile: mobile, categoryId,
      description: "Scenario D: messy whitespace and a locality not in any list.",
      manualLocationText: "   Brand   New   Unlisted   Colony   ",
    });
    assert.equal(status, 201, `normalisation submit (${status}: ${JSON.stringify(body)})`);
    const t = await track(body.trackingId, mobile);
    assert.equal(t.body.manualLocationText, "Brand New Unlisted Colony", "trimmed + whitespace collapsed");
    ok("arbitrary unlisted locality accepted; whitespace trimmed and collapsed");
  }

  // ---- 5. Ward saved alongside the typed location ----
  {
    const mobile = mobileFor();
    const { status, body } = await submit({
      citizenName: "Location Test E", citizenMobile: mobile, categoryId,
      description: "Scenario E: ward selected together with a typed location.",
      ward: "13",
      manualLocationText: "Ward 13 canal side, near the pump house",
    });
    assert.equal(status, 201, `ward+manual submit (${status}: ${JSON.stringify(body)})`);
    assert.equal(body.ward, 13, "ward saved");
    assert.match(body.trackingId, /^JSNM-13-/);
    const t = await track(body.trackingId, mobile);
    assert.equal(t.body.ward, 13);
    assert.equal(t.body.manualLocationText, "Ward 13 canal side, near the pump house");
    ok("ward + typed location both saved and returned");
  }

  // ---- 6. No fabricated area list is exposed ----
  {
    for (const w of [12, 13, 14]) {
      const res = await fetch(`${BASE}/api/areas?ward=${w}`);
      const b = await res.json().catch(() => ({ areas: [] }));
      assert.equal((b.areas ?? []).length, 0, `ward ${w} must expose no fabricated area names, got ${JSON.stringify(b.areas)}`);
    }
    ok("API exposes no fabricated ward-area names for wards 12/13/14");
  }

  console.log(`\nALL ${step} LOCATION SUBMISSION SCENARIOS PASSED`);
}

main().catch((err) => fail(err.message));
