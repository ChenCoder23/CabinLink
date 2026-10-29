CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  desktop_title TEXT NOT NULL,
  mobile_title TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT ''
);
