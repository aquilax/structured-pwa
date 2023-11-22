import { ApiService } from "api/api";
import { ConfigService } from "config";
import { StorageAdapter } from "storage/localStorage";
import { EmptyMessageID, IStorageAPI, MessageID } from "storage/storage";
import { debounce } from "utils";

const debounceTimeout = 60000;
export const replicationStorageKey = "REPLICATION";

export type ReplicationState = {
  cursor: MessageID;
  lastUpdate: number;
};

export type SyncStatus = "SYNC" | "NO_SYNC";

export interface ReplicationService {
  replicate(): Promise<void>;
  getLastUpdate(): number;
  setOnSyncStatus(cb: OnSyncStatus): void;
}

export type ReplicationConfig = {
  interval: number;
  url: string;
};

export const defaultReplicationState = {
  cursor: EmptyMessageID,
  lastUpdate: 0,
};

export type OnSyncStatus = (status: SyncStatus) => void;

export const getReplicationService = ({
  api,
  replicationStorage,
  configService,
  onSyncStatus,
}: {
  api: ApiService;
  replicationStorage: StorageAdapter<ReplicationState>;
  configService: ConfigService;
  onSyncStatus?: OnSyncStatus;
}) => {
  let _onSyncStatus = onSyncStatus || (() => {});

  const loadState = () => replicationStorage.get();

  const saveState = (state: ReplicationState) => replicationStorage.set(state);

  const getLastUpdate = () => loadState().lastUpdate;

  const replicate = async () => {
    const config = configService.get();
    const allMessages = api.getAllMessages();
    const state = loadState();
    const messages = api.getAllAfter(state.cursor);

    let cursor = state.cursor;
    if (cursor === EmptyMessageID && allMessages.length > 0) {
      cursor = allMessages[allMessages.length - 1].id;
    }

    const body = { cursor, messages };
    console.log("REPLICATION >>>", body);
    _onSyncStatus("SYNC");
    return fetch(config.ReplicationURL, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        "X-NodeID": config.NodeID,
        Authorization: `Bearer ${config.APIKey}`,
      },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (r.ok) {
          return r.json();
        }
        throw "error sync";
      })
      .then((body) => {
        console.log("REPLICATION <<<", body);
        if (body.messages) {
          // store new messages
          api.append(body.messages);
        }
        saveState({
          ...loadState(),
          lastUpdate: new Date().getTime(),
          ...(body.cursor !== EmptyMessageID ? { cursor: body.cursor } : {}),
        });
      })
      .catch(console.error)
      .finally(() => {
        _onSyncStatus("NO_SYNC");
        if (config.AutoReplication) {
          setTimeout(replicate, config.ReplicationInterval);
        }
      });
  };
  if (configService.get().AutoReplication) {
    replicate();
  } else {
    api.subscribe("add", debounce(() => replicate(), debounceTimeout))
  }
  return {
    replicate,
    getLastUpdate,
    setOnSyncStatus: (cb: OnSyncStatus) => (_onSyncStatus = cb),
  };
};
