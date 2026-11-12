-- the me page: a short line and a status for each work, and the awards (a small collection, like works but with no
-- pictures). line is the work's one-sentence summary; status is a short tag like "in progress" or "not launched yet".
-- Awards are drafts until published, ordered by position then id, and the public API serves published ones only.
ALTER TABLE works ADD COLUMN line TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN status TEXT NOT NULL DEFAULT '';

CREATE TABLE awards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  line TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX awards_by_position ON awards (published, position, id);
