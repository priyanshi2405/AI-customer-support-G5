CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id          SERIAL PRIMARY KEY,
  owner_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  slug        VARCHAR(80) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id              SERIAL PRIMARY KEY,
  business_id     INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  original_name   VARCHAR(255) NOT NULL,
  file_type       VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf','docx','txt')),
  file_size       INT NOT NULL CHECK (file_size > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing','ready','failed')),
  error_message   TEXT,
  chunk_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_business ON documents(business_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id           SERIAL PRIMARY KEY,
  document_id  INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  business_id  INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  embedding    JSONB,              -- vector as JSON array; NULL in keyword mode
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_business ON document_chunks(business_id);

CREATE TABLE IF NOT EXISTS conversations (
  id               SERIAL PRIMARY KEY,
  business_id      INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_token    VARCHAR(64) NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id                  SERIAL PRIMARY KEY,
  conversation_id     INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                VARCHAR(10) NOT NULL CHECK (role IN ('customer','assistant')),
  content             TEXT NOT NULL,
  is_answered         BOOLEAN,
  source_document_id  INT REFERENCES documents(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS unanswered_questions (
  id              SERIAL PRIMARY KEY,
  business_id     INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id INT REFERENCES conversations(id) ON DELETE SET NULL,
  question        TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','resolved','ignored')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_unanswered_business_status ON unanswered_questions(business_id, status);
