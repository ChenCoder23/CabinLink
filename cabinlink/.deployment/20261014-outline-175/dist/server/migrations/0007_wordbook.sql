CREATE TABLE IF NOT EXISTS word_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS word_batches (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES word_categories(id), study_date TEXT NOT NULL, uploaded_at TEXT NOT NULL, uploader_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS word_entries (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES word_batches(id), english TEXT NOT NULL, chinese TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS word_batches_date ON word_batches(category_id, study_date);
CREATE INDEX IF NOT EXISTS word_entries_batch ON word_entries(batch_id);
CREATE TABLE IF NOT EXISTS word_tags (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, color TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS word_tags_user_name ON word_tags(user_id,name);
CREATE TABLE IF NOT EXISTS word_tag_links (tag_id TEXT NOT NULL REFERENCES word_tags(id) ON DELETE CASCADE, word_id TEXT NOT NULL REFERENCES word_entries(id), PRIMARY KEY(tag_id,word_id));
