import { ConfigService } from "config";
import { EmptyMessageID, IStorage } from "storage/storage";

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
  let lastUpdate = 0;

  const getLastUpdate = () => lastUpdate;

  const replicate = () => {
    const config = configService.get();
    const allMessages = storage.get();
    const messages = allMessages.filter((m) => m.meta.ts > lastUpdate);
    let cursor = EmptyMessageID;
    if (allMessages.length > 0) {
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
        "Authorization": `Bearer : ${config.APIKey}`,
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
        // TODO: make this more atomic
        lastUpdate = new Date().getTime();
        if (body.messages) {
          // store new messages
          storage.append(body.messages)
        }
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
