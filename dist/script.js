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
    targets: {}
  };
  var getReplicationService = ({
    api,
    replicationStorage,
    configService,
    connectionService,
    pubSubService
  }) => {
    const emptyTargetState = () => ({
      cursor: EmptyMessageID,
      lastUpdate: 0
    });
    const loadState = () => {
      const config = configService.get();
      const loadedState = replicationStorage.get();
      const loadedTargets = loadedState?.targets || {};
      const targets = config.targets.reduce((result, target, index) => {
        const targetState = loadedTargets[target.id];
        if (targetState) {
          result[target.id] = {
            cursor: targetState.cursor || EmptyMessageID,
            lastUpdate: targetState.lastUpdate || 0
          };
        } else if (index === 0 && loadedState?.cursor !== void 0) {
          result[target.id] = {
            cursor: loadedState.cursor,
            lastUpdate: loadedState.lastUpdate || 0
          };
        } else {
          result[target.id] = emptyTargetState();
        }
        return result;
      }, {});
      const state = { targets };
      if (!loadedState || !loadedState.targets) {
        replicationStorage.set(state);
      }
      return state;
    };
    const saveState = (state) => replicationStorage.set(state);
    const getLastUpdate = () => Math.max(0, ...Object.values(loadState().targets).map(({ lastUpdate }) => lastUpdate));
    let inFlight;
    let autoReplicationTimer;
    const replicateTarget = async (target, state) => {
      const messages = api.getAllAfter(state.cursor);
      const body = { cursor: state.cursor, messages };
      console.log("REPLICATION >>>", target.url, body);
      const response = await fetch(target.url, {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          "X-NodeID": configService.get().NodeID,
          Authorization: `Bearer ${target.apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Replication sync failed for ${target.url}`);
      }
      const responseBody = await response.json();
      console.log("REPLICATION <<<", target.url, responseBody);
      if (responseBody.messages) {
        api.append(responseBody.messages);
      }
      const currentState = loadState();
      saveState({
        ...currentState,
        targets: {
          ...currentState.targets,
          [target.id]: {
            lastUpdate: (/* @__PURE__ */ new Date()).getTime(),
            cursor: responseBody.cursor || state.cursor
          }
        }
      });
    };
    const syncTargets = async () => {
      if (!connectionService.isOnline()) {
        return Promise.reject("offline");
      }
      const config = configService.get();
      const state = loadState();
      pubSubService.emit("replicationStart", true);
      const targets = config.targets.filter((target) => target.enabled && target.url.trim().length > 0);
      await Promise.all(targets.map(
        (target) => replicateTarget(target, state.targets[target.id] || emptyTargetState()).catch(console.error)
      ));
      pubSubService.emit("replicationStop", true);
    };
    const replicate = () => {
      if (!inFlight) {
        inFlight = syncTargets().finally(() => {
          inFlight = void 0;
          if (configService.get().AutoReplication) {
            autoReplicationTimer = setTimeout(() => {
              autoReplicationTimer = void 0;
              replicate();
            }, configService.get().ReplicationInterval);
          }
        });
      }
      return inFlight;
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
    const $clone = document.importNode($templateNamespace.content, true);
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
            ...cel.type != "datetime-local" ? { list: `dl-${cel.name}-${id}` } : {},
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
        const isToday = row.ts && row.ts.toString().substring(0, 10) === today;
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

  // src/api/api.ts
  var messagesStorageKey = "STORAGE";
  var defaultMessagesState = {
    messages: []
  };
  var magicNamespaces = [
    "namespaceHomeV1",
    "namespaceConfigV1"
  ];
  var [namespaceHome, namespaceConfig] = magicNamespaces;
  var getSeq = (messages) => {
    const next = messages.flatMap(({ id }) => {
      const s = id.split(".").pop();
      if (s) {
        return [parseInt(s, 10)];
      }
      return [];
    }).sort((a, b) => a - b).pop();
    return next ? next + 1 : messages.length;
  };
  var apiService = (nodeID, messageStorage, pubSubService) => {
    const add = (namespace, data) => {
      const state = messageStorage.get();
      const seq = getSeq(state.messages || []);
      const messageID = newMessageID(namespace, nodeID, seq);
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
    const normalizeMessageData = (data) => {
      const { ts, ...rest } = data || {};
      return rest;
    };
    const getCompactKey = (message) => JSON.stringify([
      message.meta.ns,
      message.meta.op,
      normalizeMessageData(message.data)
    ]);
    const getAllMessages = () => messageStorage.get().messages;
    const compactStorage = () => {
      const state = messageStorage.get();
      const messages = state.messages || [];
      const cutoff = Date.now() - 1e3 * 60 * 60 * 24 * 14;
      const olderMessages = messages.filter((m) => m.meta.ts < cutoff);
      const newerMessages = messages.filter((m) => m.meta.ts >= cutoff);
      const compacted = /* @__PURE__ */ new Map();
      [...olderMessages].sort((a, b) => b.meta.ts - a.meta.ts).forEach((message) => {
        const key = getCompactKey(message);
        if (!compacted.has(key)) {
          compacted.set(key, message);
        }
      });
      const compactedMessages = [...newerMessages, ...compacted.values()].sort(
        (a, b) => a.meta.ts - b.meta.ts
      );
      messageStorage.set({
        ...state,
        messages: compactedMessages
      });
      return {
        removed: messages.length - compactedMessages.length,
        total: compactedMessages.length
      };
    };
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
        (data) => data.filter((c) => c.namespace === namespace).pop() || {
          namespace,
          config: []
        }
      );
    };
    const getNamespaceData = async (namespace) => {
      const data = await getAllMessages();
      return data.filter((m) => m.meta.ns === namespace).map((m) => m.data);
    };
    const getLatestNamespaceData = async (namespace) => {
      const data = await getNamespaceData(namespace);
      return data.pop();
    };
    const getNamespaceConfigNamespaces = async () => {
      const namespaces = (await getNamespaceData(namespaceConfig)).map((record) => record?.namespace).filter((namespace) => typeof namespace === "string" && namespace.length > 0);
      return [...new Set(namespaces)];
    };
    const getLatestNamespaceConfig = async (namespace) => {
      const data = await getNamespaceData(namespaceConfig);
      return data.filter((record) => record?.namespace === namespace).pop();
    };
    const remove = async (id) => {
      const state = messageStorage.get();
      messageStorage.set({
        ...state,
        messages: state.messages.filter((m) => m.id !== id)
      });
    };
    return {
      getHomeElements,
      getNamespaceConfig,
      getNamespaceData,
      getLatestNamespaceData,
      getNamespaceConfigNamespaces,
      getLatestNamespaceConfig,
      add,
      getAllMessages,
      getAllAfter,
      append,
      remove,
      compactStorage
    };
  };

  // src/components/config.ts
  var renderConfig = ({
    configService,
    api,
    replicationService,
    $container
  }) => {
    const $templateConfig = document.getElementById("template-config");
    const $clone = document.importNode($templateConfig.content, true);
    const $form = $clone.querySelector("form");
    const $formRaw = $clone.querySelector("#form-raw");
    const $namespaceInput = $clone.querySelector('input[name="namespace"]');
    const $rawMessage = $clone.querySelector('textarea[name="rawMessage"]');
    const $magicNamespaces = $clone.querySelector("#magic-namespaces");
    const $loadRawButton = $clone.querySelector(".load-raw");
    const $fieldset = $clone.querySelector("fieldset");
    const $closeButton = $clone.querySelector(".close-card");
    const $compactButton = $clone.querySelector(".compact-storage");
    const $compactStatus = $clone.querySelector(".compact-status");
    const $syncNowButton = $clone.querySelector(".sync-now");
    $closeButton?.addEventListener("click", (e) => {
      const card = $closeButton?.closest(".card");
      if (card) {
        card.remove();
      }
    });
    if (!$fieldset)
      return;
    const setNamespaceOptions = (namespaces) => {
      $magicNamespaces?.replaceChildren(
        ...namespaces.map((namespace) => {
          const option = document.createElement("option");
          option.value = namespace;
          return option;
        })
      );
    };
    setNamespaceOptions(magicNamespaces);
    api.getNamespaceConfigNamespaces().then((namespaces) => {
      setNamespaceOptions([
        ...magicNamespaces,
        ...namespaces.map((namespace) => `${magicNamespaces[1]}.${namespace}`)
      ]);
    });
    $loadRawButton?.addEventListener("click", async () => {
      const selectedNamespace = $namespaceInput?.value.trim();
      if (!selectedNamespace || !$rawMessage)
        return;
      const [namespace, configNamespace] = selectedNamespace.split(`${magicNamespaces[1]}.`);
      const data = configNamespace === void 0 ? await api.getLatestNamespaceData(selectedNamespace) : await api.getLatestNamespaceConfig(configNamespace);
      if (data !== void 0) {
        if ($namespaceInput && configNamespace !== void 0) {
          $namespaceInput.value = magicNamespaces[1];
        }
        $rawMessage.value = JSON.stringify(data, null, 2);
      }
    });
    $compactButton?.addEventListener("click", (e) => {
      e.preventDefault();
      const { removed, total } = api.compactStorage();
      if ($compactStatus) {
        $compactStatus.textContent = `Compaction complete. ${removed} duplicate old message${removed === 1 ? "" : "s"} removed. ${total} messages stored.`;
      }
    });
    $syncNowButton?.addEventListener("click", (e) => {
      e.preventDefault();
      replicationService.replicate().then(() => {
        render(configService.get(), replicationService.getLastUpdate());
      });
    });
    const readTargets = () => [...$fieldset.querySelectorAll(".replication-target")].map((row) => ({
      id: row.dataset.targetId || `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: row.querySelector(".target-url")?.value.trim() || "",
      apiKey: row.querySelector(".target-api-key")?.value || "",
      enabled: row.querySelector(".target-enabled")?.checked === true
    }));
    $form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData($form);
      const data = Object.fromEntries(formData);
      console.table(data);
      const config = configService.save({
        ...configService.get(),
        targets: readTargets(),
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
      const targetRows = config.targets.map((target) => {
        const $row = dom(
          "div",
          { class: "replication-target", "data-target-id": target.id },
          dom(
            "label",
            {},
            "URL",
            dom("input", {
              class: "target-url",
              type: "url",
              value: target.url
            })
          ),
          dom(
            "label",
            {},
            "API key",
            dom("input", {
              class: "target-api-key",
              type: "text",
              value: target.apiKey
            })
          ),
          dom(
            "label",
            { class: "target-enabled-label" },
            dom("input", {
              class: "target-enabled",
              type: "checkbox",
              ...target.enabled ? { checked: "checked" } : {}
            }),
            "Enabled"
          ),
          dom("button", { type: "button", class: "remove-target" }, "remove")
        );
        $row.querySelector(".remove-target")?.addEventListener("click", () => {
          $row.remove();
        });
        return $row;
      });
      const $addTargetButton = dom("button", { type: "button", class: "add-target" }, "add target");
      $addTargetButton.addEventListener("click", () => {
        const target = {
          id: `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          url: "",
          apiKey: "",
          enabled: true
        };
        config.targets = [...readTargets(), target];
        render(config, lastUpdate);
      });
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
          "div",
          { class: "replication-targets" },
          ...targetRows
        ),
        $addTargetButton,
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
    const $clone = document.importNode($templateHome.content, true);
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
        if (namespace && name) {
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
  var newTargetID = () => `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  var normalizeTarget = (target, index) => ({
    id: typeof target.id === "string" && target.id.length > 0 ? target.id : `${newTargetID()}-${index}`,
    url: typeof target.url === "string" ? target.url : "",
    apiKey: typeof target.apiKey === "string" ? target.apiKey : "",
    enabled: target.enabled !== false
  });
  var normalizeConfig = (loadedConfig) => {
    const legacyTarget = loadedConfig && (loadedConfig.ReplicationURL || loadedConfig.APIKey) ? [{
      id: newTargetID(),
      url: loadedConfig.ReplicationURL || "",
      apiKey: loadedConfig.APIKey || "",
      enabled: Boolean(loadedConfig.ReplicationURL)
    }] : [];
    const targets = Array.isArray(loadedConfig?.targets) ? loadedConfig.targets.map(normalizeTarget) : legacyTarget;
    return {
      NodeID: loadedConfig?.NodeID || getNodeID(),
      targets,
      ReplicationInterval: typeof loadedConfig?.ReplicationInterval === "number" ? loadedConfig.ReplicationInterval : 6e4,
      AutoReplication: loadedConfig?.AutoReplication === true
    };
  };
  var getConfigService = (configStorage) => {
    const save = (c) => configStorage.set(c);
    const get = () => {
      const loadedConfig = configStorage.get();
      const config = normalizeConfig(loadedConfig);
      const isNormalized = Boolean(
        loadedConfig && Array.isArray(loadedConfig.targets) && !loadedConfig.ReplicationURL && !loadedConfig.APIKey && loadedConfig.NodeID && loadedConfig.ReplicationInterval !== void 0 && loadedConfig.AutoReplication !== void 0
      );
      return isNormalized ? config : save(config);
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
    let cache;
    let hasCache = false;
    const get = () => {
      if (!hasCache) {
        cache = f.get();
        hasCache = true;
      }
      return cache;
    };
    const set = (data) => {
      const result = f.set(data);
      cache = result;
      hasCache = true;
      return result;
    };
    return {
      get,
      set
    };
  };

  // src/pubsub.ts
  var getPubSubService = () => {
    let subscriptions = [];
    const emit = (hook, ...args) => subscriptions.forEach((s) => s.hook == hook && s.cb(...args));
    const on = (hook, cb) => subscriptions.push({ hook, cb });
    const off = (hook, cb) => {
      subscriptions = subscriptions.filter((s) => s.hook !== hook || s.cb !== cb);
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
