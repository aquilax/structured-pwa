import { API } from "api/api";
import { renderHome } from "components/home";
import { ConfigService } from "config";
import { SyncStatus, getReplicationService as getReplicationService } from "replication/replication";
import { IStorage } from "storage/storage";

export const app = ({
  global,
  storage,
  configService,
}: {
  global: Window;
  storage: IStorage;
  configService: ConfigService;
}) => {
  const $container = global.document.getElementById(
    "container"
  ) as HTMLDivElement;
  const $syncStatusIcon = global.document.getElementById('sync-status-icon');

  const api = new API(storage);
  const onSyncStatus = (status: SyncStatus) => {
    if ($syncStatusIcon) {
      if (status === 'SYNC') {
        $syncStatusIcon.style.display = 'inline'
      } else {
        $syncStatusIcon.style.display = 'none';
      }
    }
  }
  const replicationService = getReplicationService({storage, configService, onSyncStatus});
  renderHome({ api, configService, $container, replicationService });
};
