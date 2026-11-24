-- Kissa accounts + submissions — Cloudflare D1 (SQLite).
--
-- SCOPE RULE (do not grow this without a product decision):
-- The database stores ONLY accounts, their sessions, what they submitted,
-- and the notifications/version switch those need. Story chats, memories,
-- saves, settings and AI keys stay on the user's device and MUST never be
-- written here.

CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT PRIMARY KEY,
  username           TEXT NOT NULL UNIQUE,      -- lowercase a-z0-9_, 3-20 chars
  display_name       TEXT NOT NULL,             -- creator name shown in the app
  password_hash      TEXT NOT NULL,             -- PBKDF2-SHA256, base64
  password_salt      TEXT NOT NULL,             -- random 16 bytes, base64
  password_iter      INTEGER NOT NULL,          -- iterations used for this hash
  recovery_hash      TEXT NOT NULL,             -- PBKDF2 of the recovery code
  recovery_salt      TEXT NOT NULL,
  recovery_iter      INTEGER NOT NULL,
  recovery_rotated_at TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active', -- active | disabled
  created_at         TEXT NOT NULL,
  last_login_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_created ON accounts(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                 -- sha256 hex of the bearer token
  account_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,               -- idea_… / story_… (same ids the app already has)
  account_id    TEXT,                           -- NULL = anonymous (legacy / pre-update)
  type          TEXT NOT NULL,                  -- idea | story
  status        TEXT NOT NULL,                  -- pending | accepted | rejected | expired
  title         TEXT NOT NULL,
  genre         TEXT,
  creator_name  TEXT NOT NULL,
  payload       TEXT NOT NULL,                  -- JSON (idea fields or story bundle)
  submitted_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  decided_at    TEXT,
  client        TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_account ON submissions(account_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  kind           TEXT NOT NULL,                 -- story_accepted | story_rejected | system
  submission_id  TEXT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  read_at        TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id, created_at DESC);

-- Admin-assisted account recovery (no email is collected anywhere).
CREATE TABLE IF NOT EXISTS recovery_requests (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  proof_id       TEXT NOT NULL,                 -- a submission id the owner knows
  status         TEXT NOT NULL,                 -- pending | approved | rejected
  code_hash      TEXT,                          -- set on approve (one-time)
  code_salt      TEXT,
  code_iter      INTEGER,
  code_expires_at TEXT,
  created_at     TEXT NOT NULL,
  decided_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_recovery_username ON recovery_requests(username, created_at DESC);

-- Single-row switches (minimum supported app version etc.).
CREATE TABLE IF NOT EXISTS app_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

INSERT OR IGNORE INTO app_config (key, value) VALUES ('minVersion', '2.14.0');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('minVersionMessage', 'Kissa ka naya version zaroori hai. Play Store se update kar lo.');
