import { ConfigService } from "config";
import { EmptyMessageID, IStorage, MessageID } from "storage/storage";

const storageKey = 'REPLICATION';

type State = {
  cursor: MessageID;
  lastUpdate: number;
}

export type SyncStatus = 'SYNC' | 'NO_SYNC';

export interface ReplicationService {
  replicate(): void
  getLastUpdate(): number
}

export type ReplicationConfig = {
  interval: number;
  url: string;
};

export const getReplicationService = ({
  storage,
  configService,
  onSyncStatus,
}: {
  storage: IStorage,
  configService: ConfigService,
  onSyncStatus: (status: SyncStatus)=> void,
}) => {
  const loadState=() => {
    return JSON.parse(localStorage.getItem(storageKey) || 'null') || {
      cursor: EmptyMessageID,
      lastUpdate: 0
    }
  }

  const saveState = (state: State)=> {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return state
  }

  const getLastUpdate = () => loadState().lastUpdate

  const replicate = () => {
    const config = configService.get();
    const allMessages = storage.get();
    const state = loadState();
    // TODO filter by cursor
    const messages = allMessages.filter((m) => m.meta.ts > state.lastUpdate);

    let cursor = state.cursor;
    if (cursor === EmptyMessageID && allMessages.length > 0) {
      cursor = allMessages[allMessages.length - 1].id;
    }

    const body = { cursor, messages }
    console.log("REPLICATION >>>", body);
    onSyncStatus('SYNC');
    fetch(config.ReplicationURL, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        "X-NodeID": config.ReplicationURL,
        "Authorization": `Bearer ${config.APIKey}`,
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
        console.log("REPLICATION <<<",  body );
        if (body.messages) {
          // store new messages
          storage.append(body.messages)
        }
        saveState({
          ...loadState(),
          lastUpdate: new Date().getTime(),
          ...(body.cursor ? {cursor: body.cursor} :{})
        })
      })
      .catch(console.error)
      .finally(() => onSyncStatus('NO_SYNC'));
      if (config.AutoReplication) {
        setTimeout(replicate, config.ReplicationInterval);
      }
  };
  if (configService.get().AutoReplication) {
    replicate();
  }
  return {
    replicate,
    getLastUpdate,
  }
};
