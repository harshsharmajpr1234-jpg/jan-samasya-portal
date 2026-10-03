# Backup & Restore Guide

Two kinds of data must survive a disaster: **database rows** and **uploaded photos**
(`UPLOAD_DIR`, default `./data/uploads`). Back up both together; a complaint row without its
photo (or vice versa) is a partial restore.

---

## 1. PostgreSQL (current implementation)

### Full backup (recommended, zero-cost, built-in tools)
```bash
# local / any PGPASSWORD-less connection string works the same
pg_dump --format=custom --file=backups/jsnm-$(date +%F).dump "$DATABASE_URL"
```

### Plain-SQL backup (portable, human-inspectable)
```bash
pg_dump --no-owner --file=backups/jsnm-$(date +%F).sql "$DATABASE_URL"
```

### Photos backup
```bash
tar -czf backups/jsnm-uploads-$(date +%F).tar.gz data/uploads/
```

### Restore (fresh or replacement database)
```bash
# custom format:
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backups/jsnm-YYYY-MM-DD.dump

# or plain SQL:
psql "$DATABASE_URL" -f backups/jsnm-YYYY-MM-DD.sql

# photos:
mkdir -p data/uploads
tar -xzf backups/jsnm-uploads-YYYY-MM-DD.tar.gz
```

### Hosted free tiers
- **Neon:** free tier keeps point-in-time history (typically 24 h) — export via the same
  `pg_dump` command against the Neon URL for long-term copies; store dumps off-platform
  (e.g. free Backblaze B2 / Cloudflare R2 free tiers) with lifecycle deletion of old dumps.
- **Supabase:** free tier includes daily backups (7-day retention) plus `pg_dump` always works.

### Suggested schedule (cron example, zero-cost)
```cron
# 03:30 daily DB dump + uploads archive; keep 14 days
30 3 * * * pg_dump --format=custom --file=/backups/jsnm-$(date +\%F).dump "$DATABASE_URL" \
          && tar -czf /backups/jsnm-uploads-$(date +\%F).tar.gz /app/data/uploads \
          && find /backups -name 'jsnm-*' -mtime +14 -delete
```

### Verify backups (don't skip)
```bash
# restore into a THROWAWAY database and count rows
createdb jsnm_restore_test && pg_restore --dbname jsnm_restore_test backups/jsnm-YYYY-MM-DD.dump \
  && psql jsnm_restore_test -c "select count(*) from complaints; select count(*) from complaint_events;"
# audit table row count must be >= complaint count (every complaint has a 'created' event)
```

## 2. If you migrate to MongoDB Atlas (Path B in DEPLOYMENT.md)

```bash
# backup (M0 allows mongodump from your machine against the SRV string)
mongodump --uri "mongodb+srv://<user>:<pass>@cluster0.mongodb.net/jsnm" --out backups/mongo-$(date +%F)

# restore
mongorestore --uri "mongodb+srv://<user>:<pass>@cluster0.mongodb.net/jsnm" --drop backups/mongo-YYYY-MM-DD/jsnm
```
Atlas M0 also offers cloud backups in-console; exports via `mongodump` remain the zero-cost
portable option. Photos still live outside MongoDB — back up `UPLOAD_DIR` as above.

## 3. What to back up vs what to regenerate

| Data | Action |
|---|---|
| `complaints`, `complaint_events`, `areas`, `categories`, `officers` | **Back up** (authoritative records; events table is the audit trail) |
| `data/uploads/**` | **Back up** (photo evidence) |
| Sessions (JWT) | Stateless — nothing to back up; rotate `JWT_SECRET` to invalidate all |
| Seed/demo rows | Regenerate anytime via `npx tsx scripts/seed.ts` on an empty DB |

## 4. Rotation of secrets after restore

If a backup or server may have been exposed: rotate `JWT_SECRET` (invalidates all sessions and
media tokens), force-reset officer passwords, and review `complaint_events` for unexpected
entries.
