"use strict";
(() => {
  // src/api/api.ts
  var namespaceConfigNamespace = "namespaceConfigV1";
  var API = class {
    constructor(storage) {
      this.storage = storage;
    }
    async getHomeElements() {
      return [
        { namespace: "merkiV1", name: "merki" },
        { namespace: "hranoprovodV1", name: "hranoprovod-cli" },
        { namespace: "$config", name: "Config" }
      ];
    }
    async getNamespaceConfig(namespace) {
      return this.getNamespaceData(namespaceConfigNamespace).then(
        (data) => data.find((c) => c.namespace === namespace) || {
          namespace,
          config: []
        }
      );
    }
    async getNamespaceData(namespace) {
      const data = await this.storage.get();
      return data.filter((m) => m.meta.ns === namespace).map((m) => m.data);
    }
    async add(namespace, record) {
      this.storage.add(namespace, record);
    }
  };

  // src/utils.ts
  var getLocaleDateTime = (d) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, -5);
  };
  var run = (cb) => cb();
  var dom = (tag, attributes = {}, ...children) => {
    const element = document.createElement(tag);
    for (const attribute in attributes) {
      if (attributes.hasOwnProperty(attribute)) {
        element.setAttribute(attribute, attributes[attribute]);
      }
    }
    if (children) {
      const fragment = run(() => {
        const fragment2 = document.createDocumentFragment();
        children.forEach((child) => {
          if (typeof child === "string") {
            fragment2.appendChild(document.createTextNode(child));
          } else {
            fragment2.appendChild(child);
          }
        });
        return fragment2;
      });
      element.appendChild(fragment);
    }
    return element;
  };

  // src/components/namespace.ts
  var getDefaultValue = (type) => {
    if (type === "datetime-local") {
      return getLocaleDateTime(/* @__PURE__ */ new Date());
    }
    if (type === "number") {
      return 1;
    }
    return "";
  };
  var renderNamespace = async ({
    namespace,
    api,
    $container
  }) => {
    const $templateNamespace = document.getElementById(
      "template-namespace"
    );
    const $clone = $templateNamespace.content.cloneNode(true);
    const $form = $clone.querySelector("form");
    const $fieldset = $clone.querySelector("form>fieldset");
    const $thead = $clone.querySelector("thead");
    const $tbody = $clone.querySelector("tbody");
    const $heading = $clone.querySelector(".heading");
    const $closeButton = $clone.querySelector(".close-card");
    if ($heading) {
      $heading.innerText = namespace;
    }
    $closeButton?.addEventListener("click", (e) => {
      const card = $closeButton?.closest(".card");
      if (card) {
        card.remove();
      }
    });
    $form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if ($form && namespace) {
        const formData = new FormData($form);
        const data2 = Object.fromEntries(formData);
        console.table(data2);
        api.add(namespace, data2).then(() => {
          Promise.all([
            api.getNamespaceConfig(namespace),
            api.getNamespaceData(namespace)
          ]).then(([namespace2, data3]) => {
            const { config: config2 } = namespace2;
            render(config2, data3);
          });
        });
      }
    });
    const render = (config2, data2) => {
      const formContent = config2.map(
        (cel) => dom(
          "div",
          {},
          dom(
            "label",
            {},
            cel.name,
            dom("input", {
              type: cel.type,
              name: cel.name,
              value: getDefaultValue(cel.type),
              autocapitalize: "none",
              ...cel.required ? { required: "required" } : {}
            })
          )
        )
      );
      $fieldset?.replaceChildren(...formContent);
      const theadContent = config2.map((cel) => dom("th", {}, cel.name));
      $thead?.replaceChildren(...theadContent);
      const tbodyContent = data2.sort((r1, r2) => r1.ts.localeCompare(r2.ts)).reverse().slice(0, 30).map((row) => {
        const tds = config2.map((c) => {
          return dom("td", {}, `${row[c.name]}`);
        });
        return dom("tr", {}, ...tds);
      });
      $tbody?.replaceChildren(...tbodyContent);
    };
    const { config } = await api.getNamespaceConfig(namespace);
    const data = await api.getNamespaceData(namespace);
    render(config, data);
    $container.prepend($clone);
  };

  // src/components/config.ts
  var renderConfig = ({
    configService,
    replicationService,
    $container
  }) => {
    const $templateConfig = document.getElementById(
      "template-config"
    );
    const $clone = $templateConfig.content.cloneNode(true);
    const $form = $clone.querySelector("form");
    const $fieldset = $clone.querySelector("fieldset");
    const $closeButton = $clone.querySelector(".close-card");
    const $syncNowButton = $clone.querySelector(".sync-now");
    $closeButton?.addEventListener("click", (e) => {
      const card = $closeButton?.closest(".card");
      if (card) {
        card.remove();
      }
    });
    if (!$fieldset) {
      return;
    }
    $syncNowButton?.addEventListener("click", (e) => {
      e.preventDefault();
      replicationService.replicate();
    });
    $form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData($form);
      const data = Object.fromEntries(formData);
      console.table(data);
      const config = configService.save({
        ...configService.get(),
        ReplicationURL: data.ReplicationURL.toString(),
        APIKey: data.APIKey.toString(),
        ReplicationInterval: parseInt(data.ReplicationInterval.toString(), 10),
        AutoReplication: (data.AutoReplication || "false") === "true" ? true : false
      });
      render(config);
    });
    const render = (config) => {
      const fields = [
        dom(
          "label",
          {},
          "NodeID",
          dom("input", {
            type: "text",
            value: config.NodeID,
            disabled: "disabled"
          })
        ),
        dom(
          "label",
          {},
          "ReplicationURL",
          dom("input", {
            name: "ReplicationURL",
            type: "url",
            value: config.ReplicationURL
          })
        ),
        dom(
          "label",
          {},
          "APIKey",
          dom("input", {
            name: "APIKey",
            type: "text",
            value: config.APIKey
          })
        ),
        dom(
          "label",
          {},
          "ReplicationInterval",
          dom("input", {
            name: "ReplicationInterval",
            type: "number",
            value: config.ReplicationInterval
          })
        ),
        dom(
          "label",
          {},
          "AutoReplication",
          dom("input", {
            name: "AutoReplication",
            type: "checkbox",
            value: "true",
            ...config.AutoReplication ? { checked: "checked" } : {}
          })
        ),
        dom(
          "em",
          {},
          `Last update: ${new Date(
            replicationService.getLastUpdate()
          ).toLocaleString("sv", { timeZoneName: "short" })}`
        )
      ].map((f) => dom("div", {}, f));
      $fieldset.replaceChildren(...fields);
    };
    render(configService.get());
    $container.prepend($clone);
  };

  // src/components/home.ts
  var renderHome = async ({
    api,
    replicationService,
    configService,
    $container
  }) => {
    const $templateHome = document.getElementById(
      "template-home"
    );
    const $clone = $templateHome.content.cloneNode(true);
    const $homeContainer = $clone.querySelector(".home-container");
    const elements = await api.getHomeElements();
    $homeContainer?.addEventListener("click", (e) => {
      const target = e.target;
      if (!target)
        return;
      if (target.matches(".button.home")) {
        e.preventDefault();
        const namespace = target.dataset["namespace"];
        if (namespace) {
          if (namespace === "$config") {
            renderConfig({
              configService,
              replicationService,
              $container
            });
          } else {
            renderNamespace({
              namespace,
              api,
              $container
            });
          }
        }
      }
    });
    run(
      () => (
        // populate buttons
        elements.map((el) => {
          const button = dom(
            "button",
            {
              ["data-namespace"]: el.namespace,
              class: "button home"
            },
            el.name
          );
          return button;
        }).forEach((b) => $homeContainer?.appendChild(b))
      )
    );
    $container.prepend($clone);
  };

  // src/storage/storage.ts
  var EmptyMessageID = "-";
  var newMessageID = (namespace, nodeID, counter) => `${namespace}.${nodeID}.${counter}`;

  // src/replication/replication.ts
  var getReplicationService = ({
    storage,
    configService,
    onSyncStatus
  }) => {
    let lastUpdate = 0;
    const getLastUpdate = () => lastUpdate;
    const replicate = () => {
      const config = configService.get();
      const allMessages = storage.get();
      const messages = allMessages.filter((m) => m.meta.ts > lastUpdate);
      let cursor = EmptyMessageID;
      if (allMessages.length > 0) {
        cursor = allMessages[allMessages.length - 1].id;
      }
      const body = { cursor, messages };
      console.log("REPLICATION >>>", body);
      onSyncStatus("SYNC");
      fetch(config.ReplicationURL, {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          "X-NodeID": config.ReplicationURL,
          "Authorization": `Bearer ${config.APIKey}`
        },
        body: JSON.stringify(body)
      }).then((r) => {
        if (r.ok) {
          return r.json();
        }
        throw "error sync";
      }).then((body2) => {
        console.log("REPLICATION <<<", body2);
        lastUpdate = (/* @__PURE__ */ new Date()).getTime();
        if (body2.messages) {
          storage.append(body2.messages);
        }
      }).catch(console.error).finally(() => onSyncStatus("NO_SYNC"));
      if (config.AutoReplication) {
        setTimeout(replicate, config.ReplicationInterval);
      }
    };
    if (configService.get().AutoReplication) {
      replicate();
    }
    return {
      replicate,
      getLastUpdate
    };
  };

  // src/app.ts
  var app = ({
    global,
    storage,
    configService
  }) => {
    const $container = global.document.getElementById(
      "container"
    );
    const $syncStatusIcon = global.document.getElementById("sync-status-icon");
    const api = new API(storage);
    const onSyncStatus = (status) => {
      if ($syncStatusIcon) {
        if (status === "SYNC") {
          $syncStatusIcon.style.display = "inline";
        } else {
          $syncStatusIcon.style.display = "none";
        }
      }
    };
    const replicationService = getReplicationService({ storage, configService, onSyncStatus });
    renderHome({ api, configService, $container, replicationService });
  };

  // src/storage/localStorage.ts
  var LocalStorage = class {
    constructor(nodeID) {
      this.storageKey = "STORAGE";
      this.onlyNodeMessages = (messages) => messages.filter((m) => m.meta.node === this.nodeID);
      this.nodeID = nodeID;
    }
    getState(storageKey) {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    }
    setState(storageKey, state) {
      return localStorage.setItem(storageKey, JSON.stringify(state));
    }
    add(namespace, data) {
      const state = this.getState(this.storageKey);
      const messageID = newMessageID(namespace, this.nodeID, (state.messages || []).length);
      const message = {
        id: messageID,
        meta: {
          node: this.nodeID,
          ns: namespace,
          op: "ADD",
          messageID: EmptyMessageID,
          ts: (/* @__PURE__ */ new Date()).getTime()
        },
        data
      };
      this.setState(this.storageKey, {
        ...state,
        counter: this.onlyNodeMessages(state.messages || []).length,
        messages: [...state.messages || [], message]
      });
      return messageID;
    }
    append(messages) {
      const state = this.getState(this.storageKey);
      const newMessages = [...state.messages || [], ...messages];
      this.setState(this.storageKey, {
        ...state,
        counter: this.onlyNodeMessages(newMessages).length,
        messages: newMessages
      });
    }
    get() {
      return this.getState(this.storageKey).messages || [];
    }
  };

  // src/config.ts
  var getConfigService = () => {
    const storageKey = "CONFIG";
    const getNodeID = () => `nd-${Math.ceil((/* @__PURE__ */ new Date()).getTime()).toString(36).toUpperCase()}`;
    const loadConfig = () => {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
      return {};
    };
    const save = (c) => {
      localStorage.setItem(storageKey, JSON.stringify(c));
      return c;
    };
    const get = () => {
      const defaultConfig = {
        NodeID: getNodeID(),
        ReplicationURL: "",
        APIKey: "",
        ReplicationInterval: 6e4,
        AutoReplication: false
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
      save
    };
  };

  // src/index.ts
  window.addEventListener("load", () => {
    const configService = getConfigService();
    const config = configService.get();
    const storage = new LocalStorage(config.NodeID);
    app({ global: window, storage, configService });
  });
})();
