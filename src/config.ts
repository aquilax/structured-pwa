import { NodeID } from "storage/storage";

export interface ConfigService {
  get(): Config;
  save(c: Config): Config;
}

export type Config = {
  NodeID: NodeID;
  ReplicationURL: string;
  APIKey: string;
  ReplicationInterval: number;
  AutoReplication: boolean;
};

export const getConfigService = () => {
  const storageKey = "CONFIG";

  const getNodeID = (): NodeID =>
    `nd-${Math.ceil(new Date().getTime()).toString(36).toUpperCase()}`;

  const loadConfig = (): Partial<Config> => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      return JSON.parse(raw);
    }
    return {};
  };

  const save = (c: Config): Config => {
    localStorage.setItem(storageKey, JSON.stringify(c));
    return c;
  };

  const get = (): Config => {
    const defaultConfig: Config = {
      NodeID: getNodeID(),
      ReplicationURL: "http://localhost:3333/sync",
      APIKey: "POTATO",
      ReplicationInterval: 60000,
      AutoReplication: true,
    };
    const loadedConfig = loadConfig();
    const config = { ...defaultConfig, ...loadedConfig };
    if (loadedConfig != config) {
      save(config);
    }
    return config;
  };
  return {
    get,
    save,
  };
};
