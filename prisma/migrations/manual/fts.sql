-- The table is versioned in its name because FTS5 cannot add a column to an
-- existing virtual table. Bumping the suffix makes older databases build the
-- new shape from scratch via the backfill at the bottom of this file; the old
-- table is dropped by the DROP statements that follow it.
CREATE VIRTUAL TABLE IF NOT EXISTS RecipeFts3 USING fts5(
  recipeId UNINDEXED,
  title,
  description,
  instructions,
  ingredients,
  notes,
  tokenize = 'porter unicode61'
);

-- Triggers are dropped rather than guarded with IF NOT EXISTS: an older
-- database still holds v2 bodies that write to the table the bottom of this
-- file drops, and IF NOT EXISTS would silently keep them, breaking the next
-- recipe write. Recreating them unconditionally is what repoints them at the
-- current table.
DROP TRIGGER IF EXISTS RecipeFtsInsert;
DROP TRIGGER IF EXISTS RecipeFtsDelete;
DROP TRIGGER IF EXISTS RecipeFtsUpdate;
DROP TRIGGER IF EXISTS RecipeFtsIngredientInsert;
DROP TRIGGER IF EXISTS RecipeFtsIngredientDelete;
DROP TRIGGER IF EXISTS RecipeFtsIngredientUpdate;
DROP TRIGGER IF EXISTS RecipeFtsIngredientRename;

-- Ingredient text is denormalized into the index, so any write that changes a
-- recipe's ingredient rows has to re-index the recipe. Recomputing the whole
-- row from the base tables keeps every trigger below identical in effect.
CREATE TRIGGER RecipeFtsInsert AFTER INSERT ON Recipe BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = new.id;
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r WHERE r.id = new.id;
END;

CREATE TRIGGER RecipeFtsDelete AFTER DELETE ON Recipe BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = old.id;
END;

CREATE TRIGGER RecipeFtsUpdate AFTER UPDATE ON Recipe BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = old.id;
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r WHERE r.id = new.id;
END;

CREATE TRIGGER RecipeFtsIngredientInsert AFTER INSERT ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = new.recipeId;
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r WHERE r.id = new.recipeId;
END;

CREATE TRIGGER RecipeFtsIngredientDelete AFTER DELETE ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = old.recipeId;
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r WHERE r.id = old.recipeId;
END;

CREATE TRIGGER RecipeFtsIngredientUpdate AFTER UPDATE ON RecipeIngredient BEGIN
  DELETE FROM RecipeFts3 WHERE recipeId = new.recipeId;
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r WHERE r.id = new.recipeId;
END;

-- Renaming a canonical ingredient changes the indexed text of every recipe
-- that uses it.
CREATE TRIGGER RecipeFtsIngredientRename AFTER UPDATE OF name ON Ingredient BEGIN
  DELETE FROM RecipeFts3
  WHERE recipeId IN (SELECT recipeId FROM RecipeIngredient WHERE ingredientId = new.id);
  INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
  FROM Recipe r
  WHERE r.id IN (SELECT recipeId FROM RecipeIngredient WHERE ingredientId = new.id);
END;

-- Recipes written before the virtual table existed have no trigger-created
-- row, so index anything missing. This is also what populates a bumped table
-- from scratch. The NOT EXISTS guard makes it a no-op on later boots.
INSERT INTO RecipeFts3 (recipeId, title, description, instructions, ingredients, notes)
  SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions,
         COALESCE((SELECT group_concat(i.name, ' ')
                   FROM RecipeIngredient ri JOIN Ingredient i ON i.id = ri.ingredientId
                   WHERE ri.recipeId = r.id), ''),
         COALESCE(r.notes, '')
FROM Recipe r
WHERE NOT EXISTS (SELECT 1 FROM RecipeFts3 f WHERE f.recipeId = r.id);

-- Superseded indexes, left behind on older databases. RecipeFts predates
-- indexed ingredients; RecipeFts2 predates indexed notes. Their triggers were
-- replaced by name above.
DROP TABLE IF EXISTS RecipeFts;
DROP TABLE IF EXISTS RecipeFts2;
