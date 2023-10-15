import { IStorage } from "storage/storage";

type Namespace = string;

const namespaceConfigNamespace: Namespace = "namespaceConfigV1";

export class API {
  storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage
  }

  async getHomeElements() {
    return [
      { namespace: "merkiV1", name: "merki" },
      { namespace: "hranoprovodV1", name: "hranoprovod-cli" },
      { namespace: "$config", name: "Config" },
    ];
  }
  async getNamespaceConfig(namespace: Namespace) {
    return this.getNamespaceData(namespaceConfigNamespace).then(
      (data) =>
        data.find((c) => c.namespace === namespace) || {
          namespace: namespace,
          config: [],
        }
    );
  }
  async getNamespaceData(
    namespace: Namespace
  ): Promise<Array<Record<string, any>>> {
    const data = await this.storage.get()
    return data.filter(m => m.meta.ns === namespace).map(m => m.data)
  }

  async add(namespace: Namespace, record: any) {
    this.storage.add(namespace, record)
  }
}
