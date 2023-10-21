import { StorageAdapter } from "storage/localStorage";
import { NodeID } from "storage/storage";

export const configStorageKey = "CONFIG";

export interface ConfigService {
  get(): ConfigState;
  save(c: ConfigState): ConfigState;
}

export type ConfigState = {
  NodeID: NodeID;
  ReplicationURL: string;
  APIKey: string;
  ReplicationInterval: number;
  AutoReplication: boolean;
};

const getNodeID = (): NodeID => `nd-${Math.ceil(new Date().getTime()).toString(36).toUpperCase()}`;

export const getConfigService = (configStorage: StorageAdapter<ConfigState>) => {
  const save = (c: ConfigState): ConfigState => configStorage.set(c);
  const get = (): ConfigState => {
    const defaultConfig: ConfigState = {
      NodeID: getNodeID(),
      ReplicationURL: "",
      APIKey: "",
      ReplicationInterval: 60000,
      AutoReplication: false,
    };
    const loadedConfig = configStorage.get();
    const config = { ...defaultConfig, ...loadedConfig };
    return loadedConfig != config ? save(config) : config;
  };

  return {
    get,
    save,
  };
};
