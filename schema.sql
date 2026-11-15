-- Notes are stored as Markdown files, same as in the Obsidian vault.
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  mtime INTEGER NOT NULL
);

-- Uploaded images (wallpaper, picture widgets), base64.
-- trashed_at: when nothing used it any more (the bin); deleted 30 days later.
CREATE TABLE IF NOT EXISTS blobs (
  path TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  trashed_at INTEGER
);

-- Dashboard settings and other small state, one JSON value per key.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Failed login attempts, for rate limiting.
CREATE TABLE IF NOT EXISTS login_fails (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- Videos (Zeus' own slideshow), in 1 MB parts as base64. Their row in blobs holds { size, parts }.
CREATE TABLE IF NOT EXISTS video_parts (
  path TEXT NOT NULL,
  n INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (path, n)
);

-- Signed-in devices: one row per login (the cookie holds the id, signed). Deleting a row logs that device out.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  agent TEXT,
  ip TEXT,
  place TEXT
);

-- Wrong-password attempts, listed in Settings > Account for 30 days.
CREATE TABLE IF NOT EXISTS login_log (
  at INTEGER NOT NULL,
  ip TEXT,
  place TEXT,
  agent TEXT
);
