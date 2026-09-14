CREATE TABLE IF NOT EXISTS clients (
  client_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_device TEXT NOT NULL,
  last_build TEXT NOT NULL DEFAULT '',
  ever_standalone INTEGER NOT NULL DEFAULT 0 CHECK (ever_standalone IN (0, 1)),
  launch_count INTEGER NOT NULL DEFAULT 0,
  install_events INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_last_seen ON clients(last_seen);
CREATE INDEX IF NOT EXISTS idx_clients_last_device ON clients(last_device);

CREATE TABLE IF NOT EXISTS daily_usage (
  day TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  device TEXT NOT NULL,
  standalone INTEGER NOT NULL DEFAULT 0 CHECK (standalone IN (0, 1)),
  launches INTEGER NOT NULL DEFAULT 0,
  install_events INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, client_hash)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_day ON daily_usage(day);
