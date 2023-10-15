import { replication } from "replication/replication";
import { app } from "./app";
import { API } from "./api/api";
import { LocalStorage } from "storage/localStorage";
import { getConfig } from "config";

window.addEventListener("load", () => {
  const config = getConfig()
  console.log({config});
  const storage = new LocalStorage(config.NodeID);
  const api = new API(storage);
  replication(storage, config)
  app(window, api);
});
