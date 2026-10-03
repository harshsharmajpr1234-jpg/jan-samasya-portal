# Deployment Guide — free tiers only

> **Rule:** do not activate any paid plan or paid add-on without explicit approval from the
> project owner. Every option below has a permanent free tier that fits this portal's scale.

---

## Path A — Deploy this Next.js app as-is (recommended)

The app is a single deployable unit (UI + API + auth). This is the simplest **and** cheapest path:
one web service, one database, one disk.

### A1. This platform / any Node host
```bash
npm ci
cp .env.example .env           # fill DATABASE_URL, JWT_SECRET, SEED_*
npx drizzle-kit push           # create schema
npx tsx scripts/seed.ts        # seed areas, categories, officer accounts
npm run build
npm run start                  # listens on PORT (default 3000)
```

### A2. Vercel (free Hobby tier) + Neon (free tier)
1. **Neon**: create a free project → copy the pooled `DATABASE_URL`.
2. **Vercel**: import the repo. Env vars: `DATABASE_URL`, `JWT_SECRET`,
   `ALLOWED_ORIGINS` (empty), `NEXT_PUBLIC_MAP_*`.
3. Run once locally against the Neon URL: `npx drizzle-kit push && npx tsx scripts/seed.ts`.
4. **Uploads caveat:** serverless filesystems are ephemeral. Complaint photos **must** go to
   object storage there — use **Cloudinary free tier** (25 credits/mo) or **Supabase Storage free
   tier (1 GB)**. Replace `validateAndSaveUpload`/`readUpload` in `src/lib/uploads.ts` with the
   provider SDK; keep the `/api/media/[file]` access-control wrapper unchanged. Keep files
   private/signed exactly as they are on disk today.
5. Verify with `E2E_BASE_URL=https://<your-app>.vercel.app node scripts/e2e-smoke.mjs`.

### A3. Render (free web service) + Neon
Same as A1 but on Render: build `npm ci && npm run build`, start `npm run start`. A Render free
instance has a persistent-enough disk for pilots, but still prefer object storage for durability,
and note free instances sleep when idle (cold starts).

---

## Path B — Originally-planned split (Vite/Netlify + Express/Render + MongoDB Atlas)

Choose this only if a separate frontend/backend is a hard requirement. It needs **two** services
to stay awake on free tiers.

1. **Frontend (Netlify free):** the React components in `src/components/**` and pages port
   directly to a Vite + React + TS app; API base URL becomes an env (`VITE_API_URL`).
2. **Backend (Render free):** each `src/app/api/**/route.ts` maps 1:1 to an Express route —
   the handlers already use plain `Request`/`Response`. Keep every `src/lib/*` module unchanged
   (zod schemas, rate limiter, bcrypt, JWT, CORS helper, uploads).
3. **MongoDB Atlas free (M0, 512 MB):** replace the Drizzle/Postgres layer:
   - Collections: `areas`, `categories`, `officers`, `complaints`, `complaint_events` — same
     field names as `src/db/schema.ts`.
   - Uniqueness: unique indexes on `complaints.trackingId`, `officers.email`,
     `areas(ward,name)`; index `complaints(ward,status)`, `complaint_events(complaintId,createdAt)`.
   - Retry loop in `generateUniqueTrackingId` stays (check-then-insert with unique index).
   - Keep the **audit collection append-only** (never `updateOne`/`deleteOne` on it).
   - Do **not** store photos in MongoDB (GridFS wastes the 512 MB); keep the media-route pattern.
4. **CORS:** because frontend and API now differ by origin, set `ALLOWED_ORIGINS=https://<netlify-app>.netlify.app`
   on the API. Never use `*` with credentials.
5. Verify: `E2E_BASE_URL=https://<render-app>.onrender.com node scripts/e2e-smoke.mjs`.

---

## Production login troubleshooting (Netlify and other serverless hosts)

If sign-in works locally but fails after deployment, run this **one request** against the live
site first — it reports configuration *names and states* only, never secret values:

```bash
curl -s https://<your-site>/api/health
```

Interpret the result:

| Field | Meaning |
|---|---|
| `"db":"up"` | PostgreSQL is reachable. `"down"` → `DATABASE_URL` is wrong/unreachable, or the IP is not allow-listed on the database. |
| `"secrets":"missing"` | **This is the usual production root cause.** `JWT_SECRET` is not set in the host environment. Sign-in returns 503 until it is. |
| `"secretSource":"file"` | Working, but only because `JWT_SECRET_FILE` resolved. On serverless hosts there is no committed secret file — set `JWT_SECRET` properly. |
| `"diagnostics":{"jwtSecretEnv":"not set"}` | Confirms the variable is absent from the deployed environment. |

### Required environment variables on the host

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | Must allow connections from the host's egress IPs. |
| `JWT_SECRET` | **yes** | ≥32 chars. `openssl rand -base64 48`. **Set it in the Netlify UI** — `.env` is gitignored and is therefore never deployed. |
| `ALLOWED_ORIGINS` | no | Leave empty for same-origin deployments. |
| `UPLOAD_DIR` | no | Default `./data/uploads`. On serverless hosts the filesystem is **ephemeral/read-only** — use object storage for photos. |

> **Important:** `data/.jwt-secret` (the local fallback) is gitignored and will **not** exist on
> Netlify. Relying on it in production is a false sense of security — always set `JWT_SECRET` in
> the host's environment settings.

### Symptoms → causes

| Symptom | Cause |
|---|---|
| Every login returns **503** with "server is not configured" | `JWT_SECRET` missing in the host environment. |
| Logins suddenly return **429** for everyone | Client IP is not being resolved (shared CDN edge) — fixed by keying throttles per account; see `src/lib/rate-limit.ts`. |
| Login appears to succeed but the dashboard bounces back to the login page | Cookie rejected: wrong `Secure`/`SameSite` for the scheme, or the API is on a different origin than the page. |
| **401** with "Invalid email or password." | Wrong password, wrong address, or the account does not exist **in that deployment's database**. |
| **503** with `code:"DB_UNAVAILABLE"` | Database unreachable from the host; check `DATABASE_URL` and IP allow-listing. |

### Verify a deployment end-to-end

```bash
# 1. configuration present?
curl -s https://<your-site>/api/health

# 2. sign-in works and cookie is issued? (never echo the password in logs)
curl -i -X POST https://<your-site>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.org","password":"<your password>"}'
# expect: HTTP/2 200 and a Set-Cookie: jsnm_session=...; HttpOnly; SameSite=Lax; Secure

# 3. session is honoured on a protected page?
curl -i -H "Cookie: jsnm_session=<token>" https://<your-site>/officer/dashboard
# expect: HTTP 200 (not 307 back to /officer/login)
```

## One-time admin setup (production)

Admin accounts are **never** auto-created in production. `scripts/seed.ts` refuses to create demo
accounts or demo complaints when `NODE_ENV=production` (verified). Create the first admin as a
deliberate one-time step; the password comes from the environment and is never logged:

```bash
BOOTSTRAP_ADMIN_EMAIL="you@example.org" \
BOOTSTRAP_ADMIN_PASSWORD="<strong-password>" \
npx tsx scripts/bootstrap-admin.ts
```

The script **refuses to run if any admin already exists**, so it cannot be used to mint accounts.
Then unset `BOOTSTRAP_ADMIN_PASSWORD` from the environment. Use the admin console
(`/officer/admin`) to create further officer accounts — never `SEED_*` variables in production.

## Demo data cleanup (safe by design)

```bash
npx tsx scripts/cleanup-demo.ts              # dry run — prints, changes nothing
npx tsx scripts/cleanup-demo.ts --confirm    # deletes only the demo rows it listed
```

It only touches rows with explicit demo markers (seeded "Demo Citizen …"/"E2E Test Citizen"
complaints and the dev seed emails). Real complaints and their audit rows are never selected.

## Hardening checklist before public launch

- [ ] Run `npx tsx scripts/cleanup-demo.ts --confirm` if any demo rows were seeded in a shared DB
- [ ] Create the production admin via `bootstrap-admin.ts` (one-time), never via `SEED_*`
- [ ] Unset `SEED_DEMO_DATA`, `SEED_*` and `BOOTSTRAP_*` variables from the production environment
- [ ] Confirm `npx tsx scripts/seed.ts` reports demo data "disabled" under `NODE_ENV=production`
- [ ] `JWT_SECRET` generated with `openssl rand -base64 48`, stored only in host env vars
- [ ] HTTPS enforced by the platform (all listed tiers do this automatically)
- [ ] `ALLOWED_ORIGINS` empty (Path A) or exactly your frontend origin (Path B)
- [ ] Uploads on durable/private storage, size cap kept at 4 MB
- [ ] Backups scheduled (see `docs/BACKUP_RESTORE.md`)
- [ ] `node scripts/e2e-smoke.mjs` passing against the public URL
- [ ] OSM tile usage: fine at pilot volume; if traffic grows, switch to a proper tile provider
      with a free tier (e.g. CARTO) or self-host — keep attribution either way

## Legal / identity checklist

- [ ] The "independent portal" notice stays in header + footer (`SiteHeader`, `SiteFooter`)
- [ ] No government emblem, no `.gov` branding, no claim of Nagar Nigam affiliation anywhere
- [ ] "Not production-ready" status is communicated to stakeholders until post-deploy E2E passes
