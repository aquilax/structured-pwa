import { replication } from "replication/replication";
import { app } from "./app";
import { API } from "./api/api";
import { LocalStorage } from "storage/localStorage";
import { getConfigService } from "config";

window.addEventListener("load", () => {
  const configService = getConfigService();
  const config = configService.get();
  const storage = new LocalStorage(config.NodeID);
  app({ global: window, storage, configService });
});
