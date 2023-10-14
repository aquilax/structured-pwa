type Namespace = string;

const namespaceConfigNamespace: Namespace = "namespaceConfigV1";

export class API {
  storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage
  }

  data: Record<Namespace, Array<any>> = {
    [namespaceConfigNamespace]: [
      {
        namespace: "merkiV1",
        config: [
          { name: "ts", type: "datetime-local" },
          { name: "what", type: "text" },
          { name: "qty", type: "number" },
          { name: "label", type: "text" },
        ],
      },
    ],
  };
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
    return this.data[namespace] || [];
  }

  async add(namespace: Namespace, record: any) {
    if (!this.data[namespace]) {
      this.data[namespace] = [];
    }
    this.data[namespace].push(record);
  }
}
