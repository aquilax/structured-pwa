import { ApiService } from "api/api";
import { ConfigService, ReplicationTarget } from "config";
import { ConnectionService } from "connection";
import { PubSubService } from "pubsub";
import { StorageAdapter } from "storage/localStorage";
import { EmptyMessageID, MessageID } from "storage/storage";
import { debounce } from "utils";

const debounceTimeout = 60000;
export const replicationStorageKey = "REPLICATION";

export type ReplicationState = {
  targets: Record<string, ReplicationTargetState>;
};

export type ReplicationTargetState = {
  cursor: MessageID;
  lastUpdate: number;
};

export type SyncStatus = "SYNC" | "NO_SYNC";

export interface ReplicationService {
  replicate(): Promise<void>;
  getLastUpdate(): number;
}

export type ReplicationConfig = {
  interval: number;
  url: string;
};

export const defaultReplicationState: ReplicationState = {
  targets: {},
};

export type OnSyncStatus = (status: SyncStatus) => void;

export const getReplicationService = ({
  api,
  replicationStorage,
  configService,
  connectionService,
  pubSubService,
}: {
  api: ApiService;
  replicationStorage: StorageAdapter<ReplicationState>;
  configService: ConfigService;
  connectionService: ConnectionService;
  pubSubService: PubSubService;
}) => {
  const emptyTargetState = (): ReplicationTargetState => ({
    cursor: EmptyMessageID,
    lastUpdate: 0,
  });

  const loadState = (): ReplicationState => {
    const config = configService.get();
    const loadedState = replicationStorage.get() as ReplicationState & {
      cursor?: MessageID;
      lastUpdate?: number;
    };
    const loadedTargets = loadedState?.targets || {};
    const targets = config.targets.reduce<Record<string, ReplicationTargetState>>((result, target, index) => {
      const targetState = loadedTargets[target.id];
      if (targetState) {
        result[target.id] = {
          cursor: targetState.cursor || EmptyMessageID,
          lastUpdate: targetState.lastUpdate || 0,
        };
      } else if (index === 0 && loadedState?.cursor !== undefined) {
        result[target.id] = {
          cursor: loadedState.cursor,
          lastUpdate: loadedState.lastUpdate || 0,
        };
      } else {
        result[target.id] = emptyTargetState();
      }
      return result;
    }, {});
    const state = { targets };
    if (!loadedState || !loadedState.targets) {
      replicationStorage.set(state);
    }
    return state;
  };

  const saveState = (state: ReplicationState) => replicationStorage.set(state);

  const getLastUpdate = () => Math.max(0, ...Object.values(loadState().targets).map(({ lastUpdate }) => lastUpdate));

  let inFlight: Promise<void> | undefined;
  let pendingReplicate = false;
  let autoReplicationTimer: ReturnType<typeof setTimeout> | undefined;

  const replicateTarget = async (target: ReplicationTarget, state: ReplicationTargetState) => {
    const messages = api.getAllAfter(state.cursor);
    const body = { cursor: state.cursor, messages };
    console.log("REPLICATION >>>", target.url, body);
    const response = await fetch(target.url, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        "X-NodeID": configService.get().NodeID,
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Replication sync failed for ${target.url}`);
    }
    const responseBody = await response.json();
    console.log("REPLICATION <<<", target.url, responseBody);
    if (responseBody.messages) {
      api.append(responseBody.messages);
    }
    const currentState = loadState();
    saveState({
      ...currentState,
      targets: {
        ...currentState.targets,
        [target.id]: {
          lastUpdate: new Date().getTime(),
          cursor: responseBody.cursor || state.cursor,
        },
      },
    });
  };

  const syncTargets = async () => {
    if (!connectionService.isOnline()) {
      return Promise.reject("offline");
    }

    const config = configService.get();
    const state = loadState();
    pubSubService.emit("replicationStart", true);
    const targets = config.targets.filter((target) => target.enabled && target.url.trim().length > 0);
    await Promise.all(
      targets.map((target) =>
        replicateTarget(target, state.targets[target.id] || emptyTargetState()).catch(console.error)
      )
    );
    pubSubService.emit("replicationStop", true);
  };

  const replicate = (): Promise<void> => {
    if (inFlight) {
      pendingReplicate = true;
      return inFlight;
    }
    pendingReplicate = false;
    inFlight = syncTargets().finally(() => {
      inFlight = undefined;
      if (pendingReplicate) {
        pendingReplicate = false;
        replicate();
      } else if (configService.get().AutoReplication) {
        autoReplicationTimer = setTimeout(() => {
          autoReplicationTimer = undefined;
          replicate();
        }, configService.get().ReplicationInterval);
      }
    });
    return inFlight;
  };

  if (configService.get().AutoReplication) {
    replicate();
  } else {
    pubSubService.on("add", debounce(() => replicate(), debounceTimeout))
  }
  return {
    replicate,
    getLastUpdate,
  };
};
