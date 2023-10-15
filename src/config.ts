import { NodeID } from "storage/storage";

const storageKey = "CONFIG";

export type Config = {
  NodeID: NodeID;
  ReplicationURL: string;
  APIKey: string;
  ReplicationInterval: number;
  AutoReplication: boolean
};

const getNodeID = (): NodeID =>
  `nd-${Math.ceil(new Date().getTime()).toString(36).toUpperCase()}`;

const loadConfig = (): Partial<Config> => {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    return JSON.parse(raw);
  }
  return {};
};

const saveConfig = (c: Config) =>
  localStorage.setItem(storageKey, JSON.stringify(c));

export const getConfig = (): Config => {
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
    saveConfig(config);
  }
  return config;
};
