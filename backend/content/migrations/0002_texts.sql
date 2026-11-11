-- the site's texts the owner changed from the dashboard (the keys and their defaults are in src/texts.rs).
-- value is NULL after a reset to the default; version grows by one with every save and every reset.
CREATE TABLE texts (
  key TEXT PRIMARY KEY,
  value TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
