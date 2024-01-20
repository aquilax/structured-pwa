import { ApiService } from "api/api";
import { renderHome } from "components/home";
import { ConfigService } from "config";
import { PubSubService } from "pubsub";
import { ReplicationService, SyncStatus } from "replication/replication";

export const app = ({
  global,
  api,
  configService,
  replicationService,
  pubSubService,
}: {
  global: Window;
  api: ApiService;
  configService: ConfigService;
  replicationService: ReplicationService;
  pubSubService: PubSubService;
}) => {
  const $container = global.document.getElementById("container");
  const $syncStatusIcon = global.document.getElementById("sync-status-icon");
  const $onlineStatusIcon = global.document.getElementById("online-status-icon");

  if (!$container) return;

  if ($onlineStatusIcon) {
    pubSubService.on("connectionOnline", () => {
      $onlineStatusIcon.style.display = "inline";
    });
    pubSubService.on("connectionOffline", () => {
      $onlineStatusIcon.style.display = "none";
    });
    pubSubService.emit("checkConnection");
  }

  if ($syncStatusIcon) {
    pubSubService.on("replicationStart", () => {
      $syncStatusIcon.style.display = "inline";
    });
    pubSubService.on("replicationStop", () => {
      $syncStatusIcon.style.display = "none";
    });
  }
  renderHome({ api, configService, $container, replicationService });
};
