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
import { getPubSubService } from "pubsub";
import { getConnectionService } from "connection";

window.addEventListener("load", () => {
  const pubSubService = getPubSubService();
  const connectionService = getConnectionService({pubSubService});
  const messagesStorage = withCache(localStorageAdapter<MessagesState>(messagesStorageKey, defaultMessagesState));
  const configStorage = localStorageAdapter<ConfigState>(configStorageKey, {});
  const replicationStorage = localStorageAdapter<ReplicationState>(replicationStorageKey, defaultReplicationState);

  const configService = getConfigService(configStorage);
  const config = configService.get();

  const api = apiService(config.NodeID, messagesStorage, pubSubService);
  const replicationService = getReplicationService({ api, configService, replicationStorage, connectionService, pubSubService});

  app({ global: window, api, configService, replicationService, pubSubService });
});
