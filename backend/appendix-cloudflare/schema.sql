-- D1 Database Schema for Appendix Replication Server

CREATE TABLE IF NOT EXISTS messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    ns TEXT NOT NULL,
    op TEXT NOT NULL,
    message_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_id ON messages (id);
CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages (seq);
