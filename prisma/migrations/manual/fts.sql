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
