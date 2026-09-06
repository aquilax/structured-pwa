import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appendixDir = join(root, "backend", "appendix");
const cloudflareDir = join(root, "backend", "appendix-cloudflare");
const token = "dev-secret-token";
const enabled = process.env.RUN_REPLICATION_E2E === "1";

const waitFor = async (check, timeout = 30000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The process may still be starting.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for backend");
};

const startProcess = (command, args, options) => {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
};

const stopProcess = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const sync = async (url, payload, requestToken = token) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
};

describe.skipIf(!enabled)("replication backends", () => {
  let tempDir;
  let logFile;
  let cloudflareState;
  let appendixBinary;
  let appendix;
  let cloudflare;
  let appendixUrl;
  let cloudflareUrl;
  const message = {
    id: "tasks.e2e.1",
    meta: {
      ns: "tasks",
      op: "ADD",
      message_id: "-",
      ts: 1700000000000,
    },
    data: { title: "end to end" },
  };

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "structured-pwa-e2e-"));
    logFile = join(tempDir, "appendix.log");
    cloudflareState = join(tempDir, "wrangler-state");
    appendixBinary = join(tempDir, "appendix");
    const appendixPort = 3333;
    const cloudflarePort = 8787;
    appendixUrl = `http://127.0.0.1:${appendixPort}/sync`;
    cloudflareUrl = `http://127.0.0.1:${cloudflarePort}/sync`;

    execFileSync("npx", ["wrangler", "d1", "execute", "appendix-db", "--local", "--persist-to", cloudflareState, `--file=${join(cloudflareDir, "schema.sql")}`], {
      cwd: cloudflareDir,
      env: { ...process.env, API_TOKEN: token },
      stdio: "ignore",
    });
    execFileSync("go", ["build", "-o", appendixBinary, "."], { cwd: appendixDir, stdio: "ignore" });

    appendix = startProcess(appendixBinary, [], {
      cwd: appendixDir,
      env: { ...process.env, APPENDIX_ADDR: `127.0.0.1:${appendixPort}`, APPENDIX_LOG: logFile, API_TOKEN: token },
    });
    cloudflare = startProcess("npx", ["wrangler", "dev", "--local", "--port", String(cloudflarePort), "--persist-to", cloudflareState], {
      cwd: cloudflareDir,
      env: { ...process.env, API_TOKEN: token },
    });

    await waitFor(async () => (await fetch(`http://127.0.0.1:${cloudflarePort}/health`)).ok);
    await waitFor(async () => (await fetch(`http://127.0.0.1:${appendixPort}/sync`)).status === 405);
  }, 60000);

  afterAll(async () => {
    await stopProcess(appendix);
    await stopProcess(cloudflare);
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts and replays the same message from both backends", async () => {
    for (const url of [appendixUrl, cloudflareUrl]) {
      const first = await sync(url, { cursor: "-", messages: [message] });
      expect(first.status).toBe(200);
      expect(first.body.messages).toEqual([]);

      const replay = await sync(url, { cursor: "-", messages: [] });
      expect(replay.status).toBe(200);
      expect(replay.body.messages).toHaveLength(1);
      expect(replay.body.messages[0].id).toBe(message.id);
    }
  });

  it("rejects invalid credentials", async () => {
    const result = await sync(appendixUrl, { cursor: "-", messages: [] }, "wrong-token");
    expect(result.status).toBe(403);
    const cloudflareResult = await sync(cloudflareUrl, { cursor: "-", messages: [] }, "wrong-token");
    expect(cloudflareResult.status).toBe(401);
  });

  it("preserves messages after restarting appendix", async () => {
    await stopProcess(appendix);
    appendix = startProcess(appendixBinary, [], {
      cwd: appendixDir,
      env: { ...process.env, APPENDIX_ADDR: "127.0.0.1:3333", APPENDIX_LOG: logFile, API_TOKEN: token },
    });
    await waitFor(async () => (await fetch("http://127.0.0.1:3333/sync")).status === 405);

    const replay = await sync(appendixUrl, { cursor: "-", messages: [] });
    expect(replay.status).toBe(200);
    expect(replay.body.messages.map(({ id }) => id)).toContain(message.id);
    expect(readFileSync(logFile, "utf8")).toContain(message.id);
  });
});
