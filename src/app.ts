import { API } from "api/api";
import { renderHome } from "components/home";
import { ConfigService } from "config";
import { ReplicationService, SyncStatus } from "replication/replication";

export const app = ({
  global,
  api,
  configService,
  replicationService,
}: {
  global: Window;
  api: API;
  configService: ConfigService;
  replicationService: ReplicationService;
}) => {
  const $container = global.document.getElementById("container");
  const $syncStatusIcon = global.document.getElementById("sync-status-icon");

  if (!$container) return;

  replicationService.setOnSyncStatus((status: SyncStatus) => {
    if ($syncStatusIcon) {
      if (status === "SYNC") {
        $syncStatusIcon.style.display = "inline";
      } else {
        $syncStatusIcon.style.display = "none";
      }
    }
  });
  renderHome({ api, configService, $container, replicationService });
};
