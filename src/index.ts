import { replication } from "replication/replication";
import { app } from "./App";
import { API } from "./api/api";
import { LocalStorage } from "storage/localStorage";
import { run } from "utils";

window.addEventListener("load", () => {
  const nodeID = run(() => {
    const nodeID = localStorage.getItem('NODE_ID')
    if (nodeID) {
      return nodeID
    }
    const newNodeID = `nd${Math.ceil(new Date().getTime()).toString(36).toUpperCase()}`;
    localStorage.setItem('NODE_ID', newNodeID)
    return newNodeID;
  })
  console.log({nodeID});
  const storage = new LocalStorage(nodeID);
  const api = new API(storage);
  app(window, api);
  replication(nodeID, storage, { interval: 1000 * 60, url: 'http://localhost:3333/sync'})
});
