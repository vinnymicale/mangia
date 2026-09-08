CREATE VIRTUAL TABLE IF NOT EXISTS RecipeFts USING fts5(
  recipeId UNINDEXED,
  title,
  description,
  instructions,
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS RecipeFtsInsert AFTER INSERT ON Recipe BEGIN
  INSERT INTO RecipeFts (recipeId, title, description, instructions)
  VALUES (new.id, new.title, COALESCE(new.description, ''), new.instructions);
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsDelete AFTER DELETE ON Recipe BEGIN
  DELETE FROM RecipeFts WHERE recipeId = old.id;
END;

CREATE TRIGGER IF NOT EXISTS RecipeFtsUpdate AFTER UPDATE ON Recipe BEGIN
  DELETE FROM RecipeFts WHERE recipeId = old.id;
  INSERT INTO RecipeFts (recipeId, title, description, instructions)
  VALUES (new.id, new.title, COALESCE(new.description, ''), new.instructions);
END;

-- Recipes written before the virtual table existed have no trigger-created
-- row, so index anything missing. The NOT EXISTS guard makes this a no-op
-- on every boot after the first.
INSERT INTO RecipeFts (recipeId, title, description, instructions)
SELECT r.id, r.title, COALESCE(r.description, ''), r.instructions
FROM Recipe r
WHERE NOT EXISTS (SELECT 1 FROM RecipeFts f WHERE f.recipeId = r.id);
