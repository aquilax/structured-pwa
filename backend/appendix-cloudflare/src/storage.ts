import { EmptyMessageID, Message, MessageID, Payload } from "./types";

const parseJson = (val: string | null | undefined): any => {
  if (!val) return {};
  try {
    return typeof val === "string" ? JSON.parse(val) : val;
  } catch {
    return val;
  }
};

export class D1Storage {
  constructor(private db: D1Database) {}

  async processPayload(payload: Payload): Promise<Payload> {
    const incoming = payload.messages || [];

    // 1. Ingest incoming messages into D1 using INSERT OR IGNORE for deduplication
    if (incoming.length > 0) {
      const now = new Date().toISOString();
      const statements = incoming.map((msg) =>
        this.db
          .prepare(
            "INSERT OR IGNORE INTO messages (id, ns, op, message_id, ts, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            msg.id,
            msg.meta?.ns ?? "",
            msg.meta?.op ?? "ADD",
            msg.meta?.message_id ?? EmptyMessageID,
            msg.meta?.ts ?? Date.now(),
            JSON.stringify(msg.data ?? {}),
            now
          )
      );
      await this.db.batch(statements);
    }

    // 2. Fetch messages after cursor
    const messages = await this.getMessagesAfter(payload.cursor);

    // 3. Exclude incoming messages sent by the client in this request
    const incomingSet = new Set(incoming.map((m) => m.id));
    const filteredMessages = messages.filter((m) => !incomingSet.has(m.id));

    // 4. Compute response cursor
    const responseCursor =
      messages.length > 0
        ? messages[messages.length - 1].id
        : payload.cursor && payload.cursor !== EmptyMessageID
        ? payload.cursor
        : EmptyMessageID;

    return {
      cursor: responseCursor,
      messages: filteredMessages,
    };
  }

  private async getMessagesAfter(cursor: MessageID): Promise<Message[]> {
    let cursorRow: { ts: number; id: string } | null = null;

    if (cursor && cursor !== EmptyMessageID) {
      cursorRow = await this.db
        .prepare("SELECT ts, id FROM messages WHERE id = ? LIMIT 1")
        .bind(cursor)
        .first<{ ts: number; id: string }>();
    }

    let results: any[] = [];
    if (cursorRow) {
      const queryRes = await this.db
        .prepare(
          "SELECT id, ns, op, message_id, ts, data FROM messages WHERE (ts > ?) OR (ts = ? AND id > ?) ORDER BY ts ASC, id ASC"
        )
        .bind(cursorRow.ts, cursorRow.ts, cursorRow.id)
        .all();
      results = queryRes.results || [];
    } else {
      const queryRes = await this.db
        .prepare(
          "SELECT id, ns, op, message_id, ts, data FROM messages ORDER BY ts ASC, id ASC"
        )
        .all();
      results = queryRes.results || [];
    }

    return results.map((row: any) => ({
      id: row.id,
      meta: {
        ns: row.ns,
        op: row.op,
        message_id: row.message_id,
        ts: row.ts,
      },
      data: parseJson(row.data),
    }));
  }
}
