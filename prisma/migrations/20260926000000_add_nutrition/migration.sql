-- Estimated recipe macros.
--
-- Nutrition is stored per ingredient (per 100 g) and per ingredient unit
-- (grams in one cup, one piece...), so each ingredient is resolved once and
-- every recipe using it benefits. Recipe totals are computed on read rather
-- than stored, so an edit to an ingredient shows up everywhere at once.
--
-- A recipe may also carry a per-serving override, which wins over the
-- estimate: the numbers a source page printed, or the cook's own.
--
-- IngredientUnitWeight.unit is NOT NULL with '' standing for a bare count
-- ("2 onions"): SQLite treats NULLs as distinct in a unique index, so a
-- nullable unit would let the bare-count row be inserted twice.

-- CreateTable
CREATE TABLE "RecipeNutritionOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "kcal" REAL,
    "protein" REAL,
    "carbs" REAL,
    "fat" REAL,
    "fiber" REAL,
    "sugar" REAL,
    "sodium" REAL,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipeNutritionOverride_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientNutrition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "kcal" REAL,
    "protein" REAL,
    "carbs" REAL,
    "fat" REAL,
    "fiber" REAL,
    "sugar" REAL,
    "sodium" REAL,
    "source" TEXT NOT NULL,
    "fdcId" INTEGER,
    "fdcDescription" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngredientNutrition_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientUnitWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "grams" REAL,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngredientUnitWeight_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeNutritionOverride_recipeId_key" ON "RecipeNutritionOverride"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientNutrition_ingredientId_key" ON "IngredientNutrition"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientUnitWeight_ingredientId_unit_key" ON "IngredientUnitWeight"("ingredientId", "unit");

