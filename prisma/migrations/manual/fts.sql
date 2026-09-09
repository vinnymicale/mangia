-- The table is versioned in its name because FTS5 cannot add a column to an
-- existing virtual table. Bumping the suffix makes older databases build the
-- new shape from scratch via the backfill at the bottom of this file; the old
-- table is dropped by the DROP statements that follow it.
CREATE VIRTUAL TABLE IF NOT EXISTS RecipeFts2 USING fts5(
  recipeId UNINDEXED,
  title,
  description,
  instructions,
  ingredients,
  tokenize = 'porter unicode61'
);

-- Ingredient text is denormalized into the index, so any write that changes a
-- recipe's ingredient rows has to re-index the recipe. Recomputing the whole
-- row from the base tables keeps every trigger below identical in effect.
CREATE TRIGGER IF NOT EXISTS RecipeFtsInsert AFTER INSERT ON Recipe BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = new.id;
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r WHERE r.id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsDelete AFTER DELETE ON Recipe BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = old.id;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsUpdate AFTER UPDATE ON Recipe BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = old.id;
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r WHERE r.id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsIngredientInsert AFTER INSERT ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = new.recipeId;
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r WHERE r.id = new.recipeId;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsIngredientDelete AFTER DELETE ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = old.recipeId;
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r WHERE r.id = old.recipeId;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsIngredientUpdate AFTER UPDATE ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts2 WHERE recipeId = new.recipeId;
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r WHERE r.id = new.recipeId;
END;

-- Renaming a canonical ingredient changes the indexed text of every recipe
-- that uses it.
CREATE TRIGGER IF NOT EXISTS RecipeFtsIngredientRename AFTER UPDATE OF name ON Ingredient BEGIN
  DELETE FROM RecipeFts2
  WHERE recipeId IN (SELECT recipeId FROM RecipeIngredient WHERE ingredientId = new.id);
  INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), '')
  FROM Recipe r
  WHERE r.id IN (SELECT recipeId FROM RecipeIngredient WHERE ingredientId = new.id);
END;

-- Recipes written before the virtual table existed have no trigger-created
-- row, so index anything missing. The NOT EXISTS guard makes this a no-op
-- on every boot after the first.
INSERT INTO RecipeFts2 (recipeId, title, description, instructions, ingredients)
SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
       COALESCE((SELECT group_concat(i.name, ' ')
                 FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                 WHERE ri.recipeId = r.id), '')
FROM Recipe r
WHERE NOT EXISTS (SELECT 1 FROM RecipeFts2 f WHERE f.recipeId = r.id);

-- The superseded single-column index, left behind on databases created before
-- ingredients were indexed. Its triggers were replaced by name above.
DROP TABLE IF EXISTS RecipeFts;
