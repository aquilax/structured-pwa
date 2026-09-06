# Appendix Cloudflare Replication Server

A zero-dependency, serverless replication sync server for **[Structured PWA](https://github.com/aquilax/structured-pwa)** built on **Cloudflare Workers**, **TypeScript**, and **Cloudflare D1** (Serverless SQLite).

It provides 100% protocol and payload parity with the original Go `appendix` server, enabling offline-first replication, message deduplication, sequence-indexed cursor pagination, and mandatory Bearer token authentication.

---

## 📑 Features

* 🚀 **Zero External Dependencies:** Built with pure Web Standard Cloudflare Worker APIs (`fetch`, `Request`, `Response`).
* ⚡ **Zero Cold Starts:** Tiny ~1 KB bundle size for instant edge execution.
* 🗄️ **Serverless SQLite (Cloudflare D1):** Auto-incrementing sequence index (`seq`) for ordered message streaming and `INSERT OR IGNORE` deduplication.
* 🔒 **Mandatory Bearer Authentication:** Validates `Authorization: Bearer <API_TOKEN>` on all replication requests.

---

## 📁 Project Structure

```
appendix-cloudflare/
├── src/
│   ├── index.ts      # Native Cloudflare Worker fetch handler & Bearer auth
│   ├── storage.ts    # Cloudflare D1 message ingestion & cursor pagination
│   └── types.ts      # TypeScript interfaces (Message, Payload, Env)
├── schema.sql        # Database table definitions and indexes for D1
├── wrangler.toml     # Cloudflare Worker configuration & D1 bindings
├── package.json      # Dependencies and execution scripts
└── tsconfig.json     # TypeScript configuration
```

---

## 🔑 Authentication

Every request to `/sync` requires an `Authorization` header with a valid Bearer token:

```http
Authorization: Bearer <YOUR_API_TOKEN>
```

If the header is missing or the token does not match `API_TOKEN`, the server returns `401 Unauthorized`.

---

## 🛠️ Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Local D1 Database
Create local SQLite database tables and sequence indexes in Wrangler state:
```bash
npm run d1:init
```

### 3. Start Local Development Server
```bash
npm run dev
```
The local server will start at `http://localhost:8787`.

> 💡 In local development mode, the default API token configured in `wrangler.toml` is `dev-secret-token`.

### Example Local Replication Test (`curl`):
```bash
# Health check
curl http://localhost:8787/health

# Trigger sync (POST /sync)
curl -X POST http://localhost:8787/sync \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "cursor": "-",
    "messages": [
      {
        "id": "msg-001",
        "meta": {
          "ns": "namespaceHomeV1",
          "op": "ADD",
          "message_id": "-",
          "ts": 1700000000000
        },
        "data": { "item": "Sample task" }
      }
    ]
  }'
```

---

## 🚀 Deployment to Cloudflare Workers

### 1. Create Remote Cloudflare D1 Database
```bash
npx wrangler d1 create appendix-db
```
Copy the `database_id` from the output into your `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "appendix-db"
database_id = "YOUR_REMOTE_DATABASE_ID"
```

### 2. Set Production Secret Token
```bash
npx wrangler secret put API_TOKEN
```
Enter your secret production API token when prompted.

### 3. Apply D1 Database Schema
```bash
npx wrangler d1 execute appendix-db --remote --file=./schema.sql
```

### 4. Deploy Worker
```bash
npm run deploy
```

Your live replication server URL will be printed in the terminal output (e.g. `https://appendix-cloudflare.<your-subdomain>.workers.dev/sync`). You can configure this URL in your `structured-pwa` Config settings!
