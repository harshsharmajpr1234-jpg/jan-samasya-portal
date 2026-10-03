import { db } from "@/db";
import { sql } from "drizzle-orm";
import { handlePreflight } from "@/lib/cors";
import { isJwtSecretConfigured } from "@/lib/jwt";
import { jwtSecretSource } from "@/lib/secret";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      db: "up",
      service: "jan-samasya-nivaran-manch",
      // Diagnostic values only — configuration NAMES and states, never secrets.
      secrets: isJwtSecretConfigured() ? "configured" : "missing",
      secretSource: jwtSecretSource(),
      diagnostics: {
        jwtSecretEnv: process.env.JWT_SECRET ? "set" : "not set",
        databaseUrl: process.env.DATABASE_URL ? "set" : "not set",
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
    });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
