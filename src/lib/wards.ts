import { db } from "@/db";
import { wards } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

/**
 * Ward configuration lives in the `wards` table — the single source of truth
 * for which wards the portal serves. Nothing here enumerates ward numbers, so
 * a ward added to the configuration is immediately served and immediately
 * covered by any account with the `all wards` scope.
 */

export interface WardConfig {
  number: number;
  name: string;
}

/** Active, configured wards (ascending). */
export async function getConfiguredWards(): Promise<WardConfig[]> {
  try {
    return await db
      .select({ number: wards.number, name: wards.name })
      .from(wards)
      .where(eq(wards.active, true))
      .orderBy(asc(wards.number));
  } catch {
    return [];
  }
}

/** Just the ward numbers, for cheap membership checks. */
export async function getConfiguredWardNumbers(): Promise<number[]> {
  return (await getConfiguredWards()).map((w) => w.number);
}

/** True when the ward exists in the configuration and is active. */
export async function isWardConfigured(n: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: wards.id })
      .from(wards)
      .where(and(eq(wards.number, n), eq(wards.active, true)))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

/** Configured wards filtered to the given numbers (for display of a subset). */
export async function getWardsByNumbers(numbers: readonly number[]): Promise<WardConfig[]> {
  if (numbers.length === 0) return [];
  try {
    return await db
      .select({ number: wards.number, name: wards.name })
      .from(wards)
      .where(and(eq(wards.active, true), inArray(wards.number, [...numbers])))
      .orderBy(asc(wards.number));
  } catch {
    return [];
  }
}
