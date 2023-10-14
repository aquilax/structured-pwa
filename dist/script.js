"use strict";
(() => {
  // src/storage/memory.ts
  var MemoryStorage = class {
    add(ns, data) {
      throw new Error("Method not implemented.");
    }
    getAll(ns) {
      throw new Error("Method not implemented.");
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
    const $addButton = $clone.querySelector(".add-record");
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
    $addButton?.addEventListener("click", (e) => {
      e.preventDefault();
      if ($form && namespace) {
        const formData = new FormData($form);
        const data2 = Object.fromEntries(formData);
        console.table(data2);
        api.add(namespace, data2).then(() => {
          $form.reset();
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
          "label",
          {},
          cel.name,
          dom("input", {
            type: cel.type,
            name: cel.name,
            value: getDefaultValue(cel.type)
          })
        )
      );
      $fieldset?.replaceChildren(...formContent);
      const theadContent = config2.map(
        (cel) => dom("th", {}, cel.name)
      );
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
    const $home = $clone.querySelector(".home");
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

  // src/App.ts
  var app = (global, api) => {
    const $container = global.document.getElementById("container");
    renderHome({ api, $container });
  };

  // src/api/api.ts
  var namespaceConfigNamespace = "namespaceConfigV1";
  var API = class {
    constructor(storage) {
      this.data = {
        [namespaceConfigNamespace]: [
          {
            namespace: "merkiV1",
            config: [
              { name: "ts", type: "datetime-local" },
              { name: "what", type: "text" },
              { name: "qty", type: "number" },
              { name: "label", type: "text" }
            ]
          }
        ]
      };
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
      return this.data[namespace] || [];
    }
    async add(namespace, record) {
      if (!this.data[namespace]) {
        this.data[namespace] = [];
      }
      this.data[namespace].push(record);
    }
  };

  // src/index.ts
  window.addEventListener("load", () => {
    const storage = new MemoryStorage();
    const api = new API(storage);
    app(window, api);
  });
})();
