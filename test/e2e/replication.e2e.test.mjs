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
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
};

const signalProcessGroup = (child, signal) => {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    if (child.exitCode === null) child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH" && child.exitCode === null) throw error;
  }
};

const getDescendantPids = (rootPid) => {
  if (process.platform === "win32") return [];
  const output = execFileSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" });
  const children = new Map();
  for (const line of output.trim().split("\n")) {
    const [pid, parentPid] = line.trim().split(/\s+/).map(Number);
    if (!Number.isNaN(pid) && !Number.isNaN(parentPid)) {
      const siblings = children.get(parentPid) || [];
      siblings.push(pid);
      children.set(parentPid, siblings);
    }
  }

  const descendants = [];
  const visit = (parentPid) => {
    for (const childPid of children.get(parentPid) || []) {
      descendants.push(childPid);
      visit(childPid);
    }
  };
  visit(rootPid);
  return descendants;
};

const stopProcess = async (child) => {
  if (!child) return;
  const descendantPids = getDescendantPids(child.pid);
  signalProcessGroup(child, "SIGTERM");
  for (const pid of descendantPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000),
  ]);
  for (const pid of descendantPids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  signalProcessGroup(child, "SIGKILL");
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
    await Promise.all([stopProcess(appendix), stopProcess(cloudflare)]);
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts and replays the same message from both backends", async () => {
    for (const url of [appendixUrl, cloudflareUrl]) {
      const first = await sync(url, { cursor: "-", messages: [message] });
      expect(first.status).toBe(200);
      expect(first.body.messages).toEqual([]);
      expect(first.body.cursor).toBe(message.id);

      const replay = await sync(url, { cursor: message.id, messages: [] });
      expect(replay.status).toBe(200);
      expect(replay.body.messages).toEqual([]);
      expect(replay.body.cursor).toBe(message.id);
    }
  });

  it("converges 100 messages across randomly ordered client syncs", async () => {
    let seed = 0x5eed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const messages = Array.from({ length: 100 }, (_, index) => ({
      id: `tasks.random.${String(index).padStart(3, "0")}`,
      meta: {
        ns: "tasks",
        op: "ADD",
        message_id: "-",
        ts: 1700000000000 + index,
      },
      data: { index },
    }));
    const backends = [appendixUrl, cloudflareUrl];
    const clients = Array.from({ length: 3 }, () => ({
      messages: [],
      pending: new Map(backends.map((url) => [url, []])),
      cursors: new Map(),
      requests: [],
    }));

    const syncClient = async (client, url) => {
      const cursor = client.cursors.get(url) || "-";
      const outgoing = client.pending.get(url);
      const payload = { cursor, messages: outgoing };
      client.requests.push({ url, payload });

      const result = await sync(url, payload);
      expect(result.status).toBe(200);
      for (const message of result.body.messages) {
        if (!client.messages.some(({ id }) => id === message.id)) {
          client.messages.push(message);
        }
        for (const backend of backends) {
          if (backend !== url && !client.pending.get(backend).some(({ id }) => id === message.id)) {
            client.pending.get(backend).push(message);
          }
        }
      }
      client.messages.sort((left, right) => left.id.localeCompare(right.id));
      client.pending.set(url, []);
      client.cursors.set(url, result.body.cursor ?? cursor);
      return result;
    };

    for (let index = 0; index < messages.length; index += 1) {
      const client = clients[Math.floor(random() * clients.length)];
      client.messages.push(messages[index]);
      for (const url of backends) {
        client.pending.get(url).push(messages[index]);
      }
      client.messages.sort((left, right) => left.id.localeCompare(right.id));

      if ((index + 1) % 5 === 0) {
        const selectedClient = clients[Math.floor(random() * clients.length)];
        const backends = random() < 0.5
          ? [appendixUrl, cloudflareUrl]
          : [cloudflareUrl, appendixUrl];
        for (const url of backends) {
          await syncClient(selectedClient, url);
        }
      }
    }

    for (let round = 0; round < 3; round += 1) {
      for (const client of clients) {
        const order = round % 2 === 0 ? backends : [...backends].reverse();
        for (const url of order) {
          await syncClient(client, url);
        }
      }
    }

    for (const client of clients) {
      for (const url of backends) {
        client.cursors.set(url, "-");
      }
    }
    for (const client of clients) {
      await syncClient(client, appendixUrl);
      await syncClient(client, cloudflareUrl);
    }

    const expectedIds = [message, ...messages].map(({ id }) => id).sort();
    for (const client of clients) {
      expect(client.messages.map(({ id }) => id).sort()).toEqual(expectedIds);
      expect(client.cursors.get(appendixUrl)).toBe(messages[messages.length - 1].id);
      expect(client.cursors.get(cloudflareUrl)).toBe(messages[messages.length - 1].id);
      expect(client.pending.get(appendixUrl)).toEqual([]);
      expect(client.pending.get(cloudflareUrl)).toEqual([]);
    }

    for (const client of clients) {
      await syncClient(client, appendixUrl);
      await syncClient(client, cloudflareUrl);
    }
    for (const client of clients) {
      expect(client.requests.slice(-2).map(({ payload }) => payload.messages)).toEqual([[], []]);
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
