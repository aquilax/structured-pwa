import { StorageAdapter } from "storage/localStorage";
import { NodeID } from "storage/storage";

export const configStorageKey = "CONFIG";

export interface ConfigService {
  get(): ConfigState;
  save(c: ConfigState): ConfigState;
}

export type ReplicationTarget = {
  id: string;
  url: string;
  apiKey: string;
  enabled: boolean;
};

export type ConfigState = {
  NodeID: NodeID;
  targets: ReplicationTarget[];
  ReplicationInterval: number;
  AutoReplication: boolean;
};

const getNodeID = (): NodeID => `nd-${Math.ceil(new Date().getTime()).toString(36).toUpperCase()}`;

const newTargetID = (): string => `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeTarget = (target: Partial<ReplicationTarget>, index: number): ReplicationTarget => ({
  id: typeof target.id === "string" && target.id.length > 0 ? target.id : `${newTargetID()}-${index}`,
  url: typeof target.url === "string" ? target.url : "",
  apiKey: typeof target.apiKey === "string" ? target.apiKey : "",
  enabled: target.enabled !== false,
});

export const normalizeConfig = (loadedConfig: Partial<ConfigState> & {
  ReplicationURL?: string;
  APIKey?: string;
} | undefined): ConfigState => {
  const legacyTarget = loadedConfig && (loadedConfig.ReplicationURL || loadedConfig.APIKey)
    ? [{
      id: newTargetID(),
      url: loadedConfig.ReplicationURL || "",
      apiKey: loadedConfig.APIKey || "",
      enabled: Boolean(loadedConfig.ReplicationURL),
    }]
    : [];
  const targets = Array.isArray(loadedConfig?.targets)
    ? loadedConfig.targets.map(normalizeTarget)
    : legacyTarget;

  return {
    NodeID: loadedConfig?.NodeID || getNodeID(),
    targets,
    ReplicationInterval: typeof loadedConfig?.ReplicationInterval === "number"
      ? loadedConfig.ReplicationInterval
      : 60000,
    AutoReplication: loadedConfig?.AutoReplication === true,
  };
};

export const getConfigService = (configStorage: StorageAdapter<ConfigState>) => {
  const save = (c: ConfigState): ConfigState => configStorage.set(c);
  const get = (): ConfigState => {
    const loadedConfig = configStorage.get();
    const config = normalizeConfig(loadedConfig as Partial<ConfigState> & {
      ReplicationURL?: string;
      APIKey?: string;
    } | undefined);
    const isNormalized = Boolean(
      loadedConfig &&
      Array.isArray((loadedConfig as Partial<ConfigState>).targets) &&
      !(loadedConfig as { ReplicationURL?: string }).ReplicationURL &&
      !(loadedConfig as { APIKey?: string }).APIKey &&
      (loadedConfig as Partial<ConfigState>).NodeID &&
      (loadedConfig as Partial<ConfigState>).ReplicationInterval !== undefined &&
      (loadedConfig as Partial<ConfigState>).AutoReplication !== undefined
    );
    return isNormalized ? config : save(config);
  };

  return {
    get,
    save,
  };
};