import { Config } from "config";
import { EmptyMessageID, IStorage } from "storage/storage";

export type ReplicationConfig = {
  interval: number;
  url: string;
};

export const replication = (
  storage: IStorage,
  config: Config,
) => {
  let lastUpdate = 0;

  const replicate = () => {
    const allMessages = storage.get();
    const messages = allMessages.filter((m) => m.meta.ts > lastUpdate);
    let cursor = EmptyMessageID;
    if (allMessages.length > 0) {
      cursor = allMessages[allMessages.length - 1].id;
    }
    const body = { cursor, messages }
    console.log("REPLICATION >>>", body);
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
      .catch(console.error);
  };
  if (config.AutoReplication) {
    replicate();
    setInterval(replicate, config.ReplicationInterval);
  }
};
