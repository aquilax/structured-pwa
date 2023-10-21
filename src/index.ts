import {
  ReplicationState,
  defaultReplicationState,
  getReplicationService,
  replicationStorageKey,
} from "replication/replication";
import { app } from "./app";
import { ConfigState, configStorageKey, getConfigService } from "config";
import {
  MessagesState,
  defaultMessagesState,
  localStorageAdapter,
  localStorageService,
  messagesStorageKey,
  withCache,
} from "storage/localStorage";
import { API } from "api/api";

window.addEventListener("load", () => {
  const messagesStorage = withCache(localStorageAdapter<MessagesState>(messagesStorageKey, defaultMessagesState));
  const configStorage = localStorageAdapter<ConfigState>(configStorageKey, {});
  const replicationStorage = localStorageAdapter<ReplicationState>(replicationStorageKey, defaultReplicationState);

  const configService = getConfigService(configStorage);
  const config = configService.get();

  const storage = localStorageService(config.NodeID, messagesStorage);
  const replicationService = getReplicationService({ storage, configService, replicationStorage });

  const api = new API(storage);

  app({ global: window, api, configService, replicationService });
});
