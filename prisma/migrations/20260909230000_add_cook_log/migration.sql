-- Adds a cooking log: one row per time a dish was actually made.
--
-- Recipe.lastCookedAt stays as-is. It is denormalised now, but it backs the
-- "cooked" sort and the cooking view's badge, and keeping it means this
-- migration cannot regress either. The log is the history; the column is the
-- fast answer to "most recently".
CREATE TABLE "CookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "cookedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "CookLog_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Per-recipe history reads, and the global "what did I cook this month" feed.
CREATE INDEX "CookLog_recipeId_cookedAt_idx" ON "CookLog"("recipeId", "cookedAt");
CREATE INDEX "CookLog_cookedAt_idx" ON "CookLog"("cookedAt");

-- Backfill: every recipe with a lastCookedAt has demonstrably been cooked at
-- least once, and that timestamp is the only evidence of it that exists. Losing
-- it would make the new history look emptier than the truth.
INSERT INTO "CookLog" ("id", "recipeId", "cookedAt", "note")
SELECT lower(hex(randomblob(16))), "id", "lastCookedAt", NULL
FROM "Recipe"
WHERE "lastCookedAt" IS NOT NULL;
