-- The photo a recipe was read from, kept only when the cook asks for it.
--
-- A row rather than a file on disk: the backup serialises the database to JSON
-- rather than copying the SQLite file, so a row travels with the backup and a
-- file in /data would silently not.
--
-- One photo per recipe, hence the unique recipeId, and cascading delete so a
-- deleted recipe never leaves its bytes behind.
CREATE TABLE "RecipePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipePhoto_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecipePhoto_recipeId_key" ON "RecipePhoto"("recipeId");
