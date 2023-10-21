"use strict";
(() => {
  // src/storage/storage.ts
  var EmptyMessageID = "-";
  var newMessageID = (namespace, nodeID, counter) => `${namespace}.${nodeID}.${counter}`;

  // src/replication/replication.ts
  var replicationStorageKey = "REPLICATION";
  var defaultReplicationState = {
    cursor: EmptyMessageID,
    lastUpdate: 0
  };
  var getReplicationService = ({
    storage,
    replicationStorage,
    configService,
    onSyncStatus
  }) => {
    let _onSyncStatus = onSyncStatus || (() => {
    });
    const loadState = () => replicationStorage.get();
    const saveState = (state) => replicationStorage.set(state);
    const getLastUpdate = () => loadState().lastUpdate;
    const replicate = async () => {
      const config = configService.get();
      const allMessages = storage.get();
      const state = loadState();
      const messages = storage.getAllAfter(state.cursor);
      let cursor = state.cursor;
      if (cursor === EmptyMessageID && allMessages.length > 0) {
        cursor = allMessages[allMessages.length - 1].id;
      }
      const body = { cursor, messages };
      console.log("REPLICATION >>>", body);
      _onSyncStatus("SYNC");
      return fetch(config.ReplicationURL, {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          "X-NodeID": config.NodeID,
          Authorization: `Bearer ${config.APIKey}`
        },
        body: JSON.stringify(body)
      }).then((r) => {
        if (r.ok) {
          return r.json();
        }
        throw "error sync";
      }).then((body2) => {
        console.log("REPLICATION <<<", body2);
        if (body2.messages) {
          storage.append(body2.messages);
        }
        saveState({
          ...loadState(),
          lastUpdate: (/* @__PURE__ */ new Date()).getTime(),
          ...body2.cursor !== EmptyMessageID ? { cursor: body2.cursor } : {}
        });
      }).catch(console.error).finally(() => {
        _onSyncStatus("NO_SYNC");
        if (config.AutoReplication) {
          setTimeout(replicate, config.ReplicationInterval);
        }
      });
    };
    if (configService.get().AutoReplication) {
      replicate();
    }
    return {
      replicate,
      getLastUpdate,
      setOnSyncStatus: (cb) => _onSyncStatus = cb
    };
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
  var formatValue = (type, value) => {
    if (type === "datetime-local") {
      return value.replace("T", " ");
    }
    return value;
  };
  var renderNamespace = async ({
    namespace,
    api,
    $container
  }) => {
    const autofocus = ".quick-entry";
    const $templateNamespace = document.getElementById("template-namespace");
    const $clone = $templateNamespace.content.cloneNode(true);
    const $form = $clone.querySelector("form");
    const $fieldset = $clone.querySelector("form>fieldset");
    const $thead = $clone.querySelector("thead");
    const $tbody = $clone.querySelector("tbody");
    const $heading = $clone.querySelector(".heading");
    const $dataLists = $clone.querySelector(".data-lists");
    const $closeButton = $clone.querySelector(".close-card");
    if ($heading) {
      $heading.innerText = namespace;
    }
    if (!$fieldset) {
      return;
    }
    const quickEntry = (value) => {
      if (!value) {
        return;
      }
      const el = value.split(" ");
      const last = el.length > 1 ? el.pop() : null;
      const rest = el.join(" ");
      const [_skip, $f1, $f2] = Array.from(
        $fieldset.querySelectorAll('input:not([type="datetime-local"])')
      );
      $f1.value = rest;
      if (last) {
        $f2.value = last;
      }
    };
    $fieldset.addEventListener("input", (e) => {
      const target = e.target;
      if (target && target.classList.contains("quick-entry")) {
        quickEntry(target.value);
      }
    });
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
          Promise.all([api.getNamespaceConfig(namespace), api.getNamespaceData(namespace)]).then(([namespace2, data3]) => {
            const { config: config2 } = namespace2;
            render(config2, data3);
          });
        });
      }
    });
    const getDataListOptions = (name, data2) => Array.from(new Set(data2.filter((i) => i).map((i) => i[name].trim())));
    const render = (config2, data2) => {
      const dataLists = config2.filter((c) => ["text", "string"].includes(c.type)).map((c) => ({
        name: c.name,
        options: getDataListOptions(c.name, data2)
      })).filter((dl) => dl.options.length > 0).map(
        (dl) => dom(
          "datalist",
          {
            id: `dl-${dl.name}`
          },
          ...dl.options.map((o) => dom("option", {}, o))
        )
      );
      $dataLists?.replaceChildren(...dataLists);
      const formContent = config2.map(
        (cel) => dom(
          "div",
          {},
          dom("label", {}, cel.name),
          dom("input", {
            type: cel.type,
            name: cel.name,
            list: `dl-${cel.name}`,
            value: getDefaultValue(cel.type),
            autocapitalize: "none",
            ...cel.required ? { required: "required" } : {}
          })
        )
      );
      const quickEntry2 = dom(
        "div",
        {},
        dom("input", {
          class: "quick-entry",
          type: "text",
          placeholder: "quick entry",
          autocapitalize: "none"
        })
      );
      $fieldset?.replaceChildren(quickEntry2, ...formContent);
      const theadContent = config2.map((cel) => dom("th", {}, cel.name));
      $thead?.replaceChildren(...theadContent);
      const tbodyContent = data2.sort((r1, r2) => r1.ts.localeCompare(r2.ts)).reverse().slice(0, 30).map((row) => {
        const tds = config2.map((c) => {
          return dom("td", {}, `${formatValue(c.type, row[c.name])}`);
        });
        return dom("tr", {}, ...tds);
      });
      $tbody?.replaceChildren(...tbodyContent);
      $form?.querySelector(autofocus)?.focus();
    };
    const { config } = await api.getNamespaceConfig(namespace);
    const data = await api.getNamespaceData(namespace);
    render(config, data);
    $container.prepend($clone);
    $form?.querySelector(autofocus)?.focus();
  };

  // src/components/config.ts
  var renderConfig = ({
    configService,
    replicationService,
    $container
  }) => {
    const $templateConfig = document.getElementById("template-config");
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
    if (!$fieldset)
      return;
    $syncNowButton?.addEventListener("click", (e) => {
      e.preventDefault();
      replicationService.replicate().then(() => {
        render(configService.get(), replicationService.getLastUpdate());
      });
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
      render(config, replicationService.getLastUpdate());
    });
    const render = (config, lastUpdate) => {
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
        dom("em", {}, `Last update: ${new Date(lastUpdate).toLocaleString("sv", { timeZoneName: "short" })}`)
      ].map((f) => dom("div", {}, f));
      $fieldset.replaceChildren(...fields);
    };
    render(configService.get(), replicationService.getLastUpdate());
    $container.prepend($clone);
  };

  // src/components/home.ts
  var renderHome = async ({
    api,
    replicationService,
    configService,
    $container
  }) => {
    const $templateHome = document.getElementById("template-home");
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

  // src/app.ts
  var app = ({
    global,
    api,
    configService,
    replicationService
  }) => {
    const $container = global.document.getElementById("container");
    const $syncStatusIcon = global.document.getElementById("sync-status-icon");
    if (!$container)
      return;
    replicationService.setOnSyncStatus((status) => {
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

  // src/config.ts
  var configStorageKey = "CONFIG";
  var getNodeID = () => `nd-${Math.ceil((/* @__PURE__ */ new Date()).getTime()).toString(36).toUpperCase()}`;
  var getConfigService = (configStorage) => {
    const save = (c) => configStorage.set(c);
    const get = () => {
      const defaultConfig = {
        NodeID: getNodeID(),
        ReplicationURL: "",
        APIKey: "",
        ReplicationInterval: 6e4,
        AutoReplication: false
      };
      const loadedConfig = configStorage.get();
      const config = { ...defaultConfig, ...loadedConfig };
      return loadedConfig != config ? save(config) : config;
    };
    return {
      get,
      save
    };
  };

  // src/storage/localStorage.ts
  var messagesStorageKey = "STORAGE";
  var defaultMessagesState = {
    messages: []
  };
  var localStorageAdapter = (storageKey, def = {}) => {
    const get = () => JSON.parse(localStorage.getItem(storageKey) || "null") || def;
    const set = (data) => {
      localStorage.setItem(storageKey, JSON.stringify(data));
      return data;
    };
    return {
      get,
      set
    };
  };
  var withCache = (f) => {
    let cache = null;
    const get = () => cache ? cache : f.get();
    const set = (data) => {
      cache = null;
      return f.set(data);
    };
    return {
      get,
      set
    };
  };
  var localStorageService = (nodeID, messageStorage) => {
    const add = (namespace, data) => {
      const state = messageStorage.get();
      const messageID = newMessageID(namespace, nodeID, (state.messages || []).length);
      const message = {
        id: messageID,
        meta: {
          node: nodeID,
          ns: namespace,
          op: "ADD",
          messageID: EmptyMessageID,
          ts: (/* @__PURE__ */ new Date()).getTime()
        },
        data
      };
      messageStorage.set({
        ...state,
        messages: [...state.messages || [], message]
      });
      return messageID;
    };
    const get = () => messageStorage.get().messages;
    const getAllAfter = (cursor) => {
      const all = get();
      const i = all.findLastIndex((m) => m.id == cursor);
      return i === -1 ? all : all.slice(i + 1);
    };
    const append = (messages) => {
      const state = messageStorage.get();
      const newMessages = [...state.messages || [], ...messages];
      messageStorage.set({
        ...state,
        messages: newMessages
      });
    };
    return {
      add,
      get,
      getAllAfter,
      append
    };
  };

  // src/api/api.ts
  var namespaceHome = "namespaceHomeV1";
  var namespaceConfig = "namespaceConfigV1";
  var API = class {
    constructor(storage) {
      this.storage = storage;
    }
    async getHomeElements() {
      const record = (await this.getNamespaceData(namespaceHome)).pop();
      return record?.config || [{ namespace: "$config", name: "Config" }];
    }
    async getNamespaceConfig(namespace) {
      return this.getNamespaceData(namespaceConfig).then(
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

  // src/index.ts
  window.addEventListener("load", () => {
    const messagesStorage = withCache(localStorageAdapter(messagesStorageKey, defaultMessagesState));
    const configStorage = localStorageAdapter(configStorageKey, {});
    const replicationStorage = localStorageAdapter(replicationStorageKey, defaultReplicationState);
    const configService = getConfigService(configStorage);
    const config = configService.get();
    const storage = localStorageService(config.NodeID, messagesStorage);
    const replicationService = getReplicationService({ storage, configService, replicationStorage });
    const api = new API(storage);
    app({ global: window, api, configService, replicationService });
  });
})();
