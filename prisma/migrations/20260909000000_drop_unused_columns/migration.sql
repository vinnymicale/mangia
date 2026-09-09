-- Removes two columns that were never written or read by the application:
-- Recipe.imagePath and RecipeIngredient.section. SQLite has supported
-- ALTER TABLE DROP COLUMN since 3.35, so no table rebuild is needed.
--
-- Recipe.notes is deliberately kept: it now backs the per-recipe notes field.

-- The FTS triggers reference these tables, and SQLite validates trigger
-- bodies when altering a table they touch. They are recreated at boot by
-- ensureFtsSchema, so dropping them here is safe.
DROP TRIGGER IF EXISTS "RecipeFtsInsert";
DROP TRIGGER IF EXISTS "RecipeFtsDelete";
DROP TRIGGER IF EXISTS "RecipeFtsUpdate";
DROP TRIGGER IF EXISTS "RecipeFtsIngredientInsert";
DROP TRIGGER IF EXISTS "RecipeFtsIngredientDelete";
DROP TRIGGER IF EXISTS "RecipeFtsIngredientUpdate";
DROP TRIGGER IF EXISTS "RecipeFtsIngredientRename";

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "imagePath";

-- AlterTable
ALTER TABLE "RecipeIngredient" DROP COLUMN "section";
