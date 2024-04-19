"use strict";
(() => {
  // src/storage/storage.ts
  var EmptyMessageID = "-";
  var newMessageID = (namespace, nodeID, counter) => `${namespace}.${nodeID}.${counter}`;

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
  var debounce = (cb, wait) => {
    let h;
    const callable = (...args) => {
      clearTimeout(h);
      h = setTimeout(() => cb(...args), wait);
    };
    return callable;
  };

  // src/replication/replication.ts
  var debounceTimeout = 6e4;
  var replicationStorageKey = "REPLICATION";
  var defaultReplicationState = {
    cursor: EmptyMessageID,
    lastUpdate: 0
  };
  var getReplicationService = ({
    api,
    replicationStorage,
    configService,
    connectionService,
    pubSubService
  }) => {
    const loadState = () => replicationStorage.get();
    const saveState = (state) => replicationStorage.set(state);
    const getLastUpdate = () => loadState().lastUpdate;
    const replicate = async () => {
      if (!connectionService.isOnline) {
        return Promise.reject("offline");
      }
      const config = configService.get();
      const allMessages = api.getAllMessages();
      const state = loadState();
      const messages = api.getAllAfter(state.cursor);
      let cursor = state.cursor;
      if (cursor === EmptyMessageID && allMessages.length > 0) {
        cursor = allMessages[allMessages.length - 1].id;
      }
      const body = { cursor, messages };
      pubSubService.emit("replicationStart", true);
      console.log("REPLICATION >>>", body);
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
          api.append(body2.messages);
        }
        saveState({
          ...loadState(),
          lastUpdate: (/* @__PURE__ */ new Date()).getTime(),
          ...body2.cursor !== EmptyMessageID ? { cursor: body2.cursor } : {}
        });
      }).catch(console.error).finally(() => {
        pubSubService.emit("replicationStop", true);
        if (config.AutoReplication) {
          setTimeout(replicate, config.ReplicationInterval);
        }
      });
    };
    if (configService.get().AutoReplication) {
      replicate();
    } else {
      pubSubService.on("add", debounce(() => replicate(), debounceTimeout));
    }
    return {
      replicate,
      getLastUpdate
    };
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
    name,
    namespace,
    api,
    $container,
    id = (/* @__PURE__ */ new Date()).getTime().toString()
  }) => {
    const autofocus = `.quick-entry`;
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
      $heading.innerText = name;
    }
    if (!$fieldset) {
      return;
    }
    const onQuickEntry = (value) => {
      if (!value) {
        return;
      }
      const fields = Array.from(
        $fieldset.querySelectorAll('input:not([type="datetime-local"])')
      );
      const [_skip, $f1, $f2, $f3] = fields;
      const el = value.split(" ");
      if (fields.length > 3 && el.length > 2) {
        $f3.value = el.pop() || "";
        $f2.value = el.pop() || "";
        $f1.value = el.join(" ");
        return;
      }
      const last = el.length > 1 ? el.pop() : null;
      const rest = el.join(" ");
      $f1.value = rest;
      if (last) {
        $f2.value = last;
      }
    };
    const close = () => {
      const card = $closeButton?.closest(".card");
      if (card) {
        card.remove();
      }
    };
    $fieldset.addEventListener("input", (e) => {
      const target = e.target;
      if (target && target.classList.contains("quick-entry")) {
        onQuickEntry(target.value);
      }
    });
    $fieldset.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        close();
      }
    });
    $closeButton?.addEventListener("click", (e) => {
      close();
    });
    $form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if ($form && namespace) {
        const formData = new FormData($form);
        const data2 = Object.fromEntries(formData);
        console.table(data2);
        api.add(namespace, data2);
        Promise.all([api.getNamespaceConfig(namespace), api.getNamespaceData(namespace)]).then(([namespace2, data3]) => {
          const { config: config2 } = namespace2;
          render(config2, data3);
        });
      }
    });
    $tbody?.addEventListener("click", (e) => {
      if (e.target && e.target.tagName === "TD") {
        const textContent = e.target.textContent;
        Array.from($tbody.getElementsByTagName("td")).forEach(($td) => {
          if ($td.textContent === textContent) {
            $td.classList.add("highlight");
          } else {
            $td.classList.remove("highlight");
          }
        });
      }
    });
    const getDataListOptions = (name2, data2) => Array.from(new Set(data2.filter((i) => i).map((i) => i[name2].trim())));
    const render = (config2, data2) => {
      const quickEntryFields = config2.filter((c) => !["datetime-local"].includes(c.type)).map((c) => c.name);
      const quickEntryDataList = dom(
        "datalist",
        {
          id: `dl-quick-entry-${id}`
        },
        ...Array.from(
          new Set(
            data2.reverse().map(
              (row) => quickEntryFields.map((name2) => row[name2]).filter((v) => v).join(" ")
            )
          )
        ).map((o) => dom("option", {}, o))
      );
      const dataLists = config2.filter((c) => ["text", "string"].includes(c.type)).map((c) => ({
        name: c.name,
        options: getDataListOptions(c.name, data2)
      })).filter((dl) => dl.options.length > 0).map(
        (dl) => dom(
          "datalist",
          {
            id: `dl-${dl.name}-${id}`
          },
          ...dl.options.map((o) => dom("option", {}, o))
        )
      );
      $dataLists?.replaceChildren(quickEntryDataList, ...dataLists);
      const formContent = config2.map(
        (cel) => dom(
          "div",
          {},
          dom("label", { for: `cel-name-${id}` }, cel.name),
          dom("input", {
            id: `cel-name-${id}`,
            type: cel.type,
            name: cel.name,
            list: `dl-${cel.name}-${id}`,
            value: getDefaultValue(cel.type),
            autocapitalize: "none",
            ...cel.required ? { required: "required" } : {}
          })
        )
      );
      const quickEntry = dom(
        "div",
        {},
        dom("input", {
          class: "quick-entry",
          list: `dl-quick-entry-${id}`,
          type: "text",
          placeholder: "quick entry",
          autocapitalize: "none"
        })
      );
      $fieldset?.replaceChildren(quickEntry, ...formContent);
      const theadContent = config2.map((cel) => dom("th", {}, cel.name));
      $thead?.replaceChildren(dom("th", {}, ""), ...theadContent);
      const today = (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
      const checkbox = (n) => dom("td", {}, dom("input", { type: "checkbox" }), ` ${n.toString().padStart(2, "0")}`);
      const tbodyContent = data2.sort((r1, r2) => r1.ts.localeCompare(r2.ts)).reverse().slice(0, 30).map((row, index) => {
        const tds = config2.map((c) => {
          return dom("td", {}, `${formatValue(c.type, row[c.name])}`);
        });
        const isToday = row.ts && row.ts.toString().substr(0, 10) === today;
        return dom(
          "tr",
          {
            ...isToday ? {} : { class: "older" }
          },
          checkbox(index + 1),
          ...tds
        );
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
    api,
    replicationService,
    $container
  }) => {
    const $templateConfig = document.getElementById("template-config");
    const $clone = $templateConfig.content.cloneNode(true);
    const $form = $clone.querySelector("form");
    const $formRaw = $clone.querySelector("#form-raw");
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
    $formRaw?.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData($formRaw);
      const data = Object.fromEntries(formData);
      console.table(data);
      const { namespace, rawMessage } = data;
      const message = JSON.parse(rawMessage.toString());
      if (api && namespace && message) {
        api.add(namespace.toString(), message);
      }
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
        const name = target.dataset["name"];
        if (namespace) {
          if (namespace === "$config") {
            renderConfig({
              configService,
              api,
              replicationService,
              $container
            });
          } else {
            renderNamespace({
              name,
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
              ["data-name"]: el.name,
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
    replicationService,
    pubSubService
  }) => {
    const $container = global.document.getElementById("container");
    const $syncStatusIcon = global.document.getElementById("sync-status-icon");
    const $onlineStatusIcon = global.document.getElementById("online-status-icon");
    if (!$container)
      return;
    if ($onlineStatusIcon) {
      pubSubService.on("connectionOnline", () => {
        $onlineStatusIcon.style.display = "inline";
      });
      pubSubService.on("connectionOffline", () => {
        $onlineStatusIcon.style.display = "none";
      });
      pubSubService.emit("checkConnection");
    }
    if ($syncStatusIcon) {
      pubSubService.on("replicationStart", () => {
        $syncStatusIcon.style.display = "inline";
      });
      pubSubService.on("replicationStop", () => {
        $syncStatusIcon.style.display = "none";
      });
    }
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

  // src/api/api.ts
  var messagesStorageKey = "STORAGE";
  var defaultMessagesState = {
    messages: []
  };
  var namespaceHome = "namespaceHomeV1";
  var namespaceConfig = "namespaceConfigV1";
  var apiService = (nodeID, messageStorage, pubSubService) => {
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
      pubSubService.emit("add");
      return messageID;
    };
    const getAllMessages = () => messageStorage.get().messages;
    const getAllAfter = (cursor) => {
      const all = getAllMessages();
      const i = all.findLastIndex((m) => m.id == cursor);
      return i === -1 ? all : all.slice(i + 1);
    };
    const append = (messages) => {
      const state = messageStorage.get();
      const ids = state.messages.map((m) => m.id);
      const newMessages = [...state.messages || [], ...messages.filter((m) => !ids.includes(m.id))];
      return messageStorage.set({
        ...state,
        messages: newMessages
      });
    };
    const getHomeElements = async () => {
      const record = (await getNamespaceData(namespaceHome)).pop();
      return record?.config || [{ namespace: "$config", name: "Config" }];
    };
    const getNamespaceConfig = async (namespace) => {
      return getNamespaceData(namespaceConfig).then(
        (data) => data.find((c) => c.namespace === namespace) || {
          namespace,
          config: []
        }
      );
    };
    const getNamespaceData = async (namespace) => {
      const data = await getAllMessages();
      return data.filter((m) => m.meta.ns === namespace).map((m) => m.data);
    };
    return {
      getHomeElements,
      getNamespaceConfig,
      getNamespaceData,
      add,
      getAllMessages,
      getAllAfter,
      append
    };
  };

  // src/pubsub.ts
  var getPubSubService = () => {
    let subscriptions = [];
    const emit = (hook, ...args) => subscriptions.forEach((s) => s.hook == hook && s.cb(...args));
    const on = (hook, cb) => subscriptions.push({ hook, cb });
    const off = (hook, cb) => {
      subscriptions = subscriptions.filter((s) => s.hook === hook && s.cb === cb);
    };
    return {
      on,
      off,
      emit
    };
  };

  // src/connection.ts
  var getConnectionService = ({ pubSubService }) => {
    const isOnline = () => navigator.onLine;
    pubSubService.on("checkConnection", () => {
      pubSubService.emit(isOnline() ? "connectionOnline" : "connectionOffline");
    });
    window.addEventListener("offline", (e) => {
      pubSubService.emit("connectionOffline");
    });
    window.addEventListener("online", (e) => {
      pubSubService.emit("connectionOnline");
    });
    return {
      isOnline
    };
  };

  // src/index.ts
  window.addEventListener("load", () => {
    const pubSubService = getPubSubService();
    const connectionService = getConnectionService({ pubSubService });
    const messagesStorage = withCache(localStorageAdapter(messagesStorageKey, defaultMessagesState));
    const configStorage = localStorageAdapter(configStorageKey, {});
    const replicationStorage = localStorageAdapter(replicationStorageKey, defaultReplicationState);
    const configService = getConfigService(configStorage);
    const config = configService.get();
    const api = apiService(config.NodeID, messagesStorage, pubSubService);
    const replicationService = getReplicationService({ api, configService, replicationStorage, connectionService, pubSubService });
    app({ global: window, api, configService, replicationService, pubSubService });
  });
})();
