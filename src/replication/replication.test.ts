// replication.test.ts
import { expect, test, vi } from 'vitest'
import { getReplicationService } from "./replication";
import type { ReplicationTarget } from "config";
import type { ApiService } from "api/api";
import type { StorageAdapter } from "storage/localStorage";
import type { ConfigService } from "config";
import type { ConnectionService } from "connection";
import type { PubSubService } from "pubsub";

// Simple in‑memory mocks
class MockApi implements ApiService {
  private messages: any[] = [];
  private cursor: string = "-";
  async getAllAfter(cursor: string) {
    if (!cursor || cursor === "-") return this.messages;
    const idx = this.messages.findIndex((m) => m.id === cursor);
    return idx === -1 ? this.messages : this.messages.slice(idx + 1);
  }
  append(messages: any[]) {
    this.messages.push(...messages);
    return { messages: this.messages } as any;
  }
  add(namespace: string, data: any) {
    const id = `${namespace}.node.1`;
    const msg = { id, meta: { ns: namespace, op: "ADD", ts: Date.now() }, data };
    this.messages.push(msg);
    return id;
  }
}

class MockStorage<T> implements StorageAdapter<T> {
  private value?: T;
  get() { return this.value as T; }
  set(v: T) { this.value = v; }
}

class MockConfig implements ConfigService {
  private cfg: any;
  constructor(targets: ReplicationTarget[]) {
    this.cfg = { targets, AutoReplication: false, ReplicationInterval: 0, NodeID: "node" };
  }
  get() { return this.cfg; }
}

class MockConnection implements ConnectionService {
  isOnline() { return true; }
}

class MockPubSub implements PubSubService {
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};
  emit(event: string, payload?: any) {
    (this.listeners[event] || []).forEach((cb) => cb(payload));
  }
  on(event: string, cb: (...args: any[]) => void) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
  }
}

// Mock fetch globally
global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
  const body = JSON.parse(opts.body);
  // Echo back the same cursor and empty messages for simplicity
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ cursor: body.cursor, messages: [] }),
  });
});

test("replication sends payload to each enabled target and updates state", async () => {
  const api = new MockApi();
  const storage = new MockStorage<any>();
  storage.set({ targets: {} });
  const targets: ReplicationTarget[] = [
    { id: "appendix", url: "http://appendix/sync", enabled: true, apiKey: "key1" },
    { id: "cloudflare", url: "http://cloudflare/sync", enabled: true, apiKey: "key2" },
  ];
  const config = new MockConfig(targets);
  const conn = new MockConnection();
  const pubsub = new MockPubSub();

  const replication = getReplicationService({
    api,
    replicationStorage: storage,
    configService: config,
    connectionService: conn,
    pubSubService: pubsub,
  });

  // add a message locally
  api.add("test", { foo: "bar" });

  await replication.replicate();

  // fetch should have been called twice – once per target
  expect((global.fetch as vi.Mock).mock.calls.length).toBe(2);
  const firstCallBody = JSON.parse((global.fetch as vi.Mock).mock.calls[0][1].body);
  expect(firstCallBody.messages.length).toBe(1);
  // state should now contain cursor updates for each target
  const state = storage.get();
  expect(state.targets["appendix"].cursor).toBeDefined();
  expect(state.targets["cloudflare"].cursor).toBeDefined();
});