import { desc, sourceHealth } from "@repo/db";
import { router, publicProcedure } from "../trpc";

function mapSourceHealthRows(rows: any[]) {
  const sources = rows.reduce<Record<string, { status: string; ageSeconds?: number }>>(
    (accumulator, row) => {
      accumulator[row.source] = {
        status: row.status,
        ageSeconds: row.ageSeconds,
      };
      return accumulator;
    },
    {},
  );

  const degradedSources = rows
    .filter((row) => row.status !== "healthy")
    .map((row) => row.source);

  return {
    status: degradedSources.length > 0 ? "degraded" : "healthy",
    degradedSources,
    sources,
    summary:
      degradedSources.length > 0
        ? `Release-control data is degraded: ${degradedSources.join(", ")}.`
        : "All critical release-control feeds are healthy.",
  };
}

export const sourceTrustRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    const rows = await ctx.db
      .select()
      .from(sourceHealth)
      .orderBy(desc(sourceHealth.updatedAt));

    return mapSourceHealthRows(rows as any[]);
  }),
});
