-- content: the three kinds of entries the site reads, and the gate's own records.
-- Every entry is a draft until it is published; the public API serves published entries only.

-- archive · codex. body is the markdown without its notes; notes are [{id, text}], in the order written;
-- figures are [{name, key, w, h}]: density maps in R2 that the body names as ![caption](simulacrum:<name>).
CREATE TABLE posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('nigredo', 'albedo', 'citrinitas', 'rubedo')),
  date TEXT NOT NULL,
  body TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '[]',
  figures TEXT NOT NULL DEFAULT '[]',
  example INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX posts_by_date ON posts (published, date DESC, slug DESC);

-- book · liber. note is plain paragraphs separated by a blank line; picture is the density map's R2 key;
-- adjust holds the simulacrum's settings and the map's crop, blur, brightness and contrast.
CREATE TABLE books (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year TEXT NOT NULL,
  note TEXT NOT NULL,
  quote TEXT NOT NULL DEFAULT '',
  quote_lang TEXT NOT NULL DEFAULT '',
  quote_en TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL,
  picture TEXT NOT NULL,
  picture_w INTEGER NOT NULL DEFAULT 0,
  picture_h INTEGER NOT NULL DEFAULT 0,
  adjust TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  example INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX books_by_position ON books (published, position, slug);

-- works · opera: the fields of section/works content/works.json. links, map, sources and flags are JSON;
-- map is {key, w, h, caption, settings}.
CREATE TABLE works (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gloss TEXT NOT NULL,
  gloss_tip TEXT NOT NULL,
  year TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  links TEXT NOT NULL DEFAULT '[]',
  map TEXT NOT NULL DEFAULT '{}',
  sources TEXT NOT NULL DEFAULT '{}',
  flags TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX works_by_position ON works (published, position, id);

-- the gate. Only hashes are kept: of the pending token, the email code, the session and the visitor's address.
-- A challenge is the step between the password and the code: single use, ten minutes, a few tries.
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  csrf TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
-- failures on either step, per visitor (a salted hash of the address) and for everyone ('*')
CREATE TABLE throttle (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL,
  last INTEGER NOT NULL,
  until INTEGER NOT NULL
);
