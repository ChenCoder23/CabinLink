CREATE TABLE cabinet_links (
  cabinet_id TEXT PRIMARY KEY NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  admin_token TEXT NOT NULL,
  admin_token_hash TEXT NOT NULL UNIQUE,
  share_token_hash TEXT NOT NULL UNIQUE
);
