-- Editable application configuration, one row per key.
--
-- These values were previously readable only from the environment, which meant
-- every change needed a file edit and a restart. A table is what makes them
-- editable at runtime: reads resolve database row -> environment variable ->
-- built-in default, so an installation that never opens the settings page is
-- completely unaffected by this table existing and staying empty.
--
-- No seed, deliberately. Copying the current environment into rows here would
-- pin today's values as overrides that outlive the .env they came from.
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
