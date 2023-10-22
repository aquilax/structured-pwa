import {
  ReplicationState,
  defaultReplicationState,
  getReplicationService,
  replicationStorageKey,
} from "replication/replication";
import { app } from "./app";
import { ConfigState, configStorageKey, getConfigService } from "config";
import {
  localStorageAdapter,
  withCache,
} from "storage/localStorage";
import { MessagesState, apiService, defaultMessagesState, messagesStorageKey } from "api/api";

window.addEventListener("load", () => {
  const messagesStorage = withCache(localStorageAdapter<MessagesState>(messagesStorageKey, defaultMessagesState));
  const configStorage = localStorageAdapter<ConfigState>(configStorageKey, {});
  const replicationStorage = localStorageAdapter<ReplicationState>(replicationStorageKey, defaultReplicationState);

  const configService = getConfigService(configStorage);
  const config = configService.get();

  const api = apiService(config.NodeID, messagesStorage);
  const replicationService = getReplicationService({ api, configService, replicationStorage });


  app({ global: window, api, configService, replicationService });
});
