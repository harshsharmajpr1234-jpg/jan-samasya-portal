# Jan Samasya Nivaran Manch · जन समस्या निवारण मंच

An **independent, citizen-run civic grievance portal** for **Ward 12, Ward 13 and Ward 14 only**.
Residents register problems (garbage, water, roads, streetlights, drainage…) with a photo and a
map pin, get a **unique tracking ID** instantly, and follow every officer action through a
permanent **audit history**.

> ⚠️ **Independence statement (read first)**
> This is **not** an official government, municipal or Nagar Nigam website, and it is **not**
> integrated with any government system. No official endorsement or integration is claimed or
> implied. It is a community initiative that keeps its own independent database.

---

## 1. Stack — zero-cost-first

This repository is implemented as a **single Next.js full-stack app**, which is the architecture
supported by the development/preview environment it was built in. It maps 1:1 onto the originally
planned zero-cost stack, and `docs/DEPLOYMENT.md` explains both deployment paths:

| Concern | Originally planned | Implemented here (why) |
|---|---|---|
| Frontend | React + Vite (Netlify free) | **React + TypeScript via Next.js App Router** — same React/TS stack, adds SSR |
| Backend API | Node + Express (Render free) | **Next.js Route Handlers (Node.js)** — same request/response model, zero extra service |
| Database | MongoDB Atlas free | **PostgreSQL + Drizzle ORM** (environment database). Free hosted tiers: Neon / Supabase. A MongoDB adaptation guide is in `docs/DEPLOYMENT.md`. |
| Maps | **Leaflet + OpenStreetMap** | ✅ **Kept exactly** — no API key, no cost |
| Image storage | Free-tier storage service | ✅ Private server disk + **access-controlled media route** (default, $0). Free hosted alternatives (Cloudinary/Supabase Storage free tier) documented as a drop-in |
| Rate limiting / security | server middleware | ✅ In-memory limiter, zod validation, bcrypt, httpOnly JWT — zero-cost |

Everything runs on **free tiers only**. **Do not enable any paid plan without explicit approval**
from the project owner — nothing in this codebase requires one.

**Platform status:** functional and tested in its development environment (unit + E2E smoke tests
pass). It should be treated as **pilot-ready, not production-certified** until a public deployment
passes the same end-to-end suite against its own live data — see §7.

## 2. Feature checklist

- ✅ Ward **12 / 13 / 14 only** (enforced in validation, UI, DB seed; other wards rejected)
- ✅ Ward-wise **area management** (admin can add areas per ward)
- ✅ Complaint registration with **mandatory 10-digit mobile number**
- ✅ **Categories** (bilingual EN/HI)
- ✅ **Photo upload** (JPG/PNG/WebP, magic-byte validated, 4 MB cap)
- ✅ **GPS / map location** (Leaflet + OSM, click-to-pin + "use my location")
- ✅ **Unique tracking IDs** (`JSNM-12-KF4Q7X`, unambiguous alphabet, collision-checked)
- ✅ **Secure citizen tracking** — Tracking ID **and** registered mobile both required
- ✅ **Officer login** (bcrypt passwords, httpOnly JWT session, 8 h expiry)
- ✅ **Role-based access** — `admin` (all wards, assignment, officer/area management) vs `officer` (own ward only, enforced for reads *and* writes)
- ✅ **Complaint assignment** (admin → officer of the same ward)
- ✅ **pending → in_progress → resolved** statuses (resolve requires a remark; only admin can reopen)
- ✅ **Remarks** with public/internal visibility
- ✅ **Immutable audit history** (append-only `complaint_events` table; citizens see the public slice)
- ✅ Records live in the **database only** — nothing is stored in browser storage
- ✅ **Secrets server-side only** (JWT secret, DB URL, hashes; only map center is `NEXT_PUBLIC_*`)

## 3. Security measures

| Measure | Where |
|---|---|
| Rate limiting | `src/lib/rate-limit.ts` — complaints 5/10 min, tracking 10/10 min, login 10/10 min per IP |
| Input validation | `src/lib/validators.ts` — zod on every endpoint; server-side only |
| Password hashing | `src/lib/password.ts` — bcrypt (cost 10), never logged or returned |
| Sessions | `src/lib/jwt.ts` — HS256 JWT in `HttpOnly; SameSite=Lax` cookie, `Secure` in production |
| Restricted files | `src/app/api/media/[file]` — photos served only to officers or citizens holding a 15-min signed media token (no PII in URLs); magic-byte + filename validation; `nosniff` |
| CORS | `src/lib/cors.ts` — deny-by-default; reflect only `ALLOWED_ORIGINS` entries |
| RBAC | `src/lib/rbac.ts` — ward scoping enforced in every officer query/update |
| Enumeration resistance | identical response for wrong tracking ID vs wrong mobile; lookups rate-limited |
| Auditability | `complaint_events` is append-only by design (no update/delete code paths) |

**Multi-instance deployments:** the in-memory limiter is single-process. For horizontal scale,
swap in Upstash Redis (free tier) behind the same `rateLimit()` API.

## 4. Environment variables

See **`.env.example`** (copy to `.env`). Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (local or Neon/Supabase free tier) |
| `JWT_SECRET` | ≥32 random chars — `openssl rand -base64 48` — sessions + media tokens |
| `ALLOWED_ORIGINS` | CORS allow-list; **leave empty** for same-origin deployments |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | Private photo directory (default `./data/uploads`) / size cap |
| `NEXT_PUBLIC_MAP_CENTER_*` | Default map center/zoom (public by design, not secrets) |
| `SEED_*` | Seed-only credentials; change before first real run |

## 5. Local setup (exact commands)

```bash
# 1) install dependencies
npm install

# 2) configure environment
cp .env.example .env
#    → set DATABASE_URL and generate JWT_SECRET:
openssl rand -base64 48   # paste into .env

# 3) create schema in your PostgreSQL (zero-cost local or Neon/Supabase)
npx drizzle-kit push

# 4) seed areas, categories, admin + ward officers, demo complaints
npx tsx scripts/seed.ts

# 5) run
npm run dev        # development
npm run build && npm run start   # production
```

**Demo accounts & demo complaints (dev only).** They are created **only** when
`SEED_DEMO_DATA=true` **and** `NODE_ENV` is not `production`. In production they are refused
automatically. Credentials come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` /
`SEED_OFFICER_PASSWORD` in your own `.env`; no password is hardcoded in this repository and none
is ever printed or logged.

**One-time production admin** — a deliberate, separate step (refuses to run if an admin already
exists; password read from the environment and never logged):

```bash
BOOTSTRAP_ADMIN_EMAIL="you@example.org" \
BOOTSTRAP_ADMIN_PASSWORD="<strong-password>" \
npx tsx scripts/bootstrap-admin.ts
```

**Demo data cleanup** (dry-run by default; deletes only rows carrying explicit demo markers —
never real complaints or real audit rows):

```bash
npx tsx scripts/cleanup-demo.ts              # inspect only, changes nothing
npx tsx scripts/cleanup-demo.ts --confirm    # delete exactly the rows listed above
```

## 5b. Ward reference data & boundary verification

Ward/locality **reference data is kept separate from citizen complaints** (`ward_delimitations`
+ `ward_localities`, versus `complaints`). Every mapping records **source, publisher,
delimitation + year, verification date and verification status**.

Current, honest status:

| Delimitation | Year | Source | Status |
|---|---|---|---|
| 2024 delimitation (Swachhtam Portal dataset) | 2024 | Rajasthan LSG Department — Swachhtam Portal PDF (2024) | **Needs verification** |
| 2025 merged-JMC ward boundaries (current) | 2025 | No confirmed source on file | **Needs verification** |

Scope rule: the **Rajasthan LSG Department 2024 Swachhtam Portal PDF is a source for that 2024
dataset only**. It does **not** prove the current 2025 merged-JMC ward boundaries, and the UI says
so. Nothing is marked *verified* until it has been transcribed from a source and checked.

- **No locality names are invented.** `ward_localities` is empty until a source is transcribed.
- Operational `areas` used by the complaint form are **provisional placeholders**, labelled
  *needs verification*, so the form keeps working without asserting unverified boundaries.
- Import real names from a documented source (never overwrites existing rows):

```bash
npx tsx scripts/import-ward-localities.ts --delimitation=2024-swachhtam \
  --csv=./localities-2024.csv --source-ref="p.14"
# --mark-verified is refused for unconfirmed delimitations (e.g. 2025 merged-JMC)
```

## 5c. Ward configuration & the `all wards` permission

**Wards are configuration, not code.** The `wards` table is the single source of truth for which
wards the portal serves. Add a ward through the admin API (`POST /api/admin/wards`) or an ops
insert and it is immediately served, selectable and in scope — **no code change, no redeploy**.

```bash
# admin session required
curl -X POST https://<host>/api/admin/wards \
  -H "Content-Type: application/json" -b "jsnm_session=<token>" \
  -d '{"number": 15, "name": "Ward 15"}'
```

**Two independent attributes decide what an account may do:**

| | Meaning | Values |
|---|---|---|
| `role` | what actions are allowed | `admin` (manage officers/wards/assign) · `officer` (work complaints) |
| `ward_scope` | where those actions are allowed | `all` (every configured ward, **including wards added later**) · `single` (only `ward`) |

`ward_scope` is **never implied by the role**. An admin without `all` is still limited to its own
ward. The `all` scope is granted only to accounts that request it explicitly, and the access logic
never enumerates ward numbers — which is why a newly configured ward is covered automatically.

It is enforced consistently in: complaint listing (`/api/officer/complaints`), complaint detail,
status/remark updates (PATCH), **photo access** (`/api/media/[file]`) and the dashboard.

### Secure one-time bootstrap

`POST /api/bootstrap/officer` provisions or updates exactly one account (upsert on email — never
duplicates). It is guarded by `BOOTSTRAP_TOKEN`, read from the **server** environment inside a
route handler, so it is never bundled into or exposed to the browser.

```bash
# 1. set the private, temporary token on the SERVER only
export BOOTSTRAP_TOKEN="$(openssl rand -hex 24)"

# 2. provision (password supplied out-of-band; never echoed or logged)
curl -X POST https://<host>/api/bootstrap/officer \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" \
  -d '{"name":"Ritesh Kumar Sharma","email":"you@example.org",
       "password":"<from your password manager>","role":"admin","wardScope":"all"}'

# 3. REQUIRED: remove the token now that provisioning is complete
unset BOOTSTRAP_TOKEN      # and delete it from the host's env / .env
```

Without `BOOTSTRAP_TOKEN` the endpoint returns **503 (disabled)** — that is the expected, safe
state for a running deployment. Requests without a valid token are rejected with **401**.

**Secrets hygiene:** the password is stored only as a salted bcrypt hash. Keep it in a password
manager, never in source, seed files, Git, logs or documentation. Delete the temporary bootstrap
variables (`BOOTSTRAP_TOKEN`, and any `SETUP_ACCOUNT_PASSWORD` used with the CLI) right after
provisioning.

CLI equivalent (same rules, useful when the API is not reachable):
`npx tsx scripts/setup-account.ts`.

## 6. Tests (exact commands)

```bash
# unit tests (validation, rate limiting, RBAC, tracking IDs, hashing, uploads)
npx vitest run

# type safety + production build
npx next typegen
npx tsc --noEmit
npm run build

# end-to-end smoke (needs the app running + seeded DB; ~12 check groups)
npm run start &          # or use your preview URL via E2E_BASE_URL
node scripts/e2e-smoke.mjs
```

The E2E suite covers: health, ward restriction, validation rejection, complaint+photo creation,
secure tracking (wrong-mobile rejection), restricted media (403 anonymous / 200 with token / 200 officer),
login brute-force response, ward-scoped RBAC lists, cross-ward 403s, status/remarks audit trail,
public-vs-private remark visibility, resolve-requires-remark, admin assignment, admin API gating,
and rate-limit engagement. **Its final step intentionally exhausts rate limits for ~10 minutes** —
run it last.

## 7. Production-readiness policy

- This project is **not claimed production-ready** until the deployed app passes
  `node scripts/e2e-smoke.mjs` against its public URL (set `E2E_BASE_URL`).
- Before any public launch also: rotate seed passwords, set a strong `JWT_SECRET`, put uploads on
  durable storage, and review `docs/SECURITY.md`-style hardening notes in `docs/DEPLOYMENT.md`.

## 8. Deployment & backups

- **Deployment (free tiers):** `docs/DEPLOYMENT.md` — includes the Netlify+Render+MongoDB Atlas
  adaptation for teams that specifically want the originally-planned layout.
- **Backup / restore:** `docs/BACKUP_RESTORE.md` — `pg_dump`/`pg_restore`, uploads directory, and
  the MongoDB (`mongodump`) equivalents.

## 9. Data & privacy notes

- Citizen mobile numbers are collected **solely** to authenticate tracking; they are never exposed
  publicly (officer console only) and never stored in the browser.
- Complaint photos are private by default and access-controlled server-side.
- Delete requests: remove the complaint row and its photo file; audit events referencing it should
  be retained with content redacted if required by your policy.

## 10. Repository map

```
src/
  app/                 pages: /, /complaint/new, /track, /officer/*
  app/api/             health, areas, categories, complaints(+track), auth,
                       officer/complaints(+[id]), admin/officers, admin/areas, media/[file]
  components/          map (Leaflet), forms, officer console, timers/badges
  db/                  drizzle client + schema
  lib/                 auth, jwt, rbac, rate-limit, cors, uploads, tracking, validators
scripts/               seed.ts, e2e-smoke.mjs
tests/unit/            vitest unit tests
docs/                  DEPLOYMENT.md, BACKUP_RESTORE.md
```
