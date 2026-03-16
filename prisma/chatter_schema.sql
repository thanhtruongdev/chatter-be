-- Chatter PostgreSQL schema (future-proof baseline)
-- Generated: 2026-03-16

BEGIN;

-- =========================
-- 1) Enums
-- =========================
CREATE TYPE conversation_type AS ENUM ('direct', 'group', 'channel');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');

-- =========================
-- 2) Core tables
-- =========================
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type conversation_type NOT NULL,
  title VARCHAR(255),
  avatar_url TEXT,
  created_by BIGINT,
  last_message_id BIGINT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_conversations_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE conversation_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  muted_until TIMESTAMPTZ,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_conversation_members_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_conversation_members_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_conversation_members_conversation_user
    UNIQUE (conversation_id, user_id)
);

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  type message_type NOT NULL DEFAULT 'text',
  content TEXT,
  reply_to_message_id BIGINT,
  metadata JSONB,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_messages_reply_to
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_messages_content_or_type
    CHECK (
      type <> 'text' OR content IS NOT NULL
    )
);

-- Add FK after messages exists (avoid circular create issue)
ALTER TABLE conversations
  ADD CONSTRAINT fk_conversations_last_message
  FOREIGN KEY (last_message_id) REFERENCES messages(id)
  ON DELETE SET NULL;

-- Optional integrity check trigger: ensure last_message belongs to same conversation
CREATE OR REPLACE FUNCTION validate_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM messages m
    WHERE m.id = NEW.last_message_id
      AND m.conversation_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'last_message_id % does not belong to conversation %', NEW.last_message_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_conversation_last_message
BEFORE INSERT OR UPDATE OF last_message_id ON conversations
FOR EACH ROW
EXECUTE FUNCTION validate_conversation_last_message();

-- =========================
-- 3) Message extension tables
-- =========================
CREATE TABLE message_attachments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  file_name TEXT,
  width INT,
  height INT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_message_attachments_message
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE
);

CREATE TABLE message_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_message_reactions_message
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_message_reactions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_message_reactions_message_user_emoji
    UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE message_reads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_message_reads_message
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_message_reads_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_message_reads_message_user
    UNIQUE (message_id, user_id)
);

-- =========================
-- 4) Session / device / safety
-- =========================
CREATE TABLE user_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  device_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE user_devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  push_token TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_user_devices_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_user_devices_user_device
    UNIQUE (user_id, device_id)
);

CREATE TABLE user_blocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id BIGINT NOT NULL,
  blocked_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_user_blocks_blocker
    FOREIGN KEY (blocker_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_blocks_blocked
    FOREIGN KEY (blocked_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_user_blocks_blocker_blocked
    UNIQUE (blocker_id, blocked_id),
  CONSTRAINT chk_user_blocks_not_self
    CHECK (blocker_id <> blocked_id)
);

-- =========================
-- 5) Performance indexes
-- =========================
CREATE INDEX idx_messages_conversation_created_at_desc
  ON messages (conversation_id, created_at DESC, id DESC);

CREATE INDEX idx_messages_sender_created_at_desc
  ON messages (sender_id, created_at DESC, id DESC);

CREATE INDEX idx_conversation_members_user_joined_at_desc
  ON conversation_members (user_id, joined_at DESC, id DESC);

CREATE INDEX idx_conversations_last_message_at_desc
  ON conversations (last_message_at DESC NULLS LAST, id DESC);

CREATE INDEX idx_message_reads_user_read_at_desc
  ON message_reads (user_id, read_at DESC, id DESC);

CREATE INDEX idx_user_sessions_user_expires_at
  ON user_sessions (user_id, expires_at);

-- Optional: case-insensitive search indexes for login lookups
CREATE INDEX idx_users_email_lower ON users ((LOWER(email)));
CREATE INDEX idx_users_username_lower ON users ((LOWER(username)));

-- =========================
-- 6) updated_at trigger helper
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conversations_set_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conversation_members_set_updated_at
BEFORE UPDATE ON conversation_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_messages_set_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_devices_set_updated_at
BEFORE UPDATE ON user_devices
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
