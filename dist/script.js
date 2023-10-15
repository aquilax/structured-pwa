"use strict";
(() => {
  // src/storage/storage.ts
  var EmptyMessageID = "-";
  var newMessageID = (namespace, nodeID, counter) => `${namespace}.${nodeID}.${counter}.`;

  // src/replication/replication.ts
  var replication = (storage, config) => {
    let lastUpdate = 0;
    const replicate = () => {
      const allMessages = storage.get();
      const messages = allMessages.filter((m) => m.meta.ts > lastUpdate);
      let cursor = EmptyMessageID;
      if (allMessages.length > 0) {
        cursor = allMessages[allMessages.length - 1].id;
      }
      const body = { cursor, messages };
      console.log("REPLICATION >>>", body);
      fetch(config.ReplicationURL, {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          "X-NodeID": config.ReplicationURL,
          "Authorization": `Bearer : ${config.APIKey}`
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
      }).catch(console.error);
    };
    if (config.AutoReplication) {
      replicate();
      setInterval(replicate, config.ReplicationInterval);
    }
  };

  // src/utils.ts
  var getLocaleDateTime = (d) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, -8);
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
              ...cel.required ? { required: "required" } : {}
            })
          )
        )
      );
      $fieldset?.replaceChildren(...formContent);
      const theadContent = config2.map((cel) => dom("th", {}, cel.name));
      $thead?.replaceChildren(...theadContent);
      const tbodyContent = data2.reverse().map((row) => {
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

  // src/components/home.ts
  var renderHome = async ({
    api,
    $container
  }) => {
    const $templateHome = document.getElementById(
      "template-home"
    );
    const $clone = $templateHome.content.cloneNode(true);
    const $home = $clone.querySelector(".home-container");
    const elements = await api.getHomeElements();
    $home?.addEventListener("click", (e) => {
      const target = e.target;
      if (!target)
        return;
      if (target.matches(".button.home")) {
        e.preventDefault();
        const namespace = target.dataset["namespace"];
        if (namespace) {
          if (namespace[0] === "$") {
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
        }).forEach((b) => $home?.appendChild(b))
      )
    );
    $container.prepend($clone);
  };

  // src/app.ts
  var app = (global, api) => {
    const $container = global.document.getElementById("container");
    renderHome({ api, $container });
  };

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

  // src/storage/localStorage.ts
  var LocalStorage = class {
    constructor(nodeID) {
      this.storageKey = "STORAGE";
      this.onlyNodeMessages = (messages) => messages.filter((m) => m.meta.node === this.nodeID);
      this.nodeID = nodeID;
    }
    getState(storageKey2) {
      return JSON.parse(localStorage.getItem(storageKey2) || "{}");
    }
    setState(storageKey2, state) {
      return localStorage.setItem(storageKey2, JSON.stringify(state));
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
  var storageKey = "CONFIG";
  var getNodeID = () => `nd-${Math.ceil((/* @__PURE__ */ new Date()).getTime()).toString(36).toUpperCase()}`;
  var loadConfig = () => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      return JSON.parse(raw);
    }
    return {};
  };
  var saveConfig = (c) => localStorage.setItem(storageKey, JSON.stringify(c));
  var getConfig = () => {
    const defaultConfig = {
      NodeID: getNodeID(),
      ReplicationURL: "http://localhost:3333/sync",
      APIKey: "POTATO",
      ReplicationInterval: 6e4,
      AutoReplication: true
    };
    const loadedConfig = loadConfig();
    const config = { ...defaultConfig, ...loadedConfig };
    if (loadedConfig != config) {
      saveConfig(config);
    }
    return config;
  };

  // src/index.ts
  window.addEventListener("load", () => {
    const config = getConfig();
    console.log({ config });
    const storage = new LocalStorage(config.NodeID);
    const api = new API(storage);
    replication(storage, config);
    app(window, api);
  });
})();
