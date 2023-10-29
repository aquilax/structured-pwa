import { ApiService } from "api/api";
import { Namespace } from "storage/storage";
import { dom, getLocaleDateTime, run } from "utils";

type FieldType = "datetime-local" | "number" | "text";

const getDefaultValue = (type: FieldType) => {
  if (type === "datetime-local") {
    return getLocaleDateTime(new Date());
  }
  if (type === "number") {
    return 1;
  }
  return "";
};

const formatValue = (type: FieldType, value: any) => {
  if (type === "datetime-local") {
    return value.replace("T", " ");
  }
  return value;
};

export const renderNamespace = async ({
  namespace,
  api,
  $container,
  id = new Date().getTime().toString(),
}: {
  namespace: Namespace;
  api: ApiService;
  $container: HTMLElement;
  id: string;
}) => {
  const autofocus = `.quick-entry`;
  const $templateNamespace = document.getElementById("template-namespace") as HTMLTemplateElement;

  const $clone = $templateNamespace.content.cloneNode(true) as HTMLElement;

  const $form = $clone.querySelector<HTMLFormElement>("form");
  const $fieldset = $clone.querySelector<HTMLElement>("form>fieldset");
  const $thead = $clone.querySelector<HTMLElement>("thead");
  const $tbody = $clone.querySelector<HTMLElement>("tbody");
  const $heading = $clone.querySelector<HTMLHeadElement>(".heading");
  const $dataLists = $clone.querySelector<HTMLHeadElement>(".data-lists");
  const $closeButton = $clone.querySelector<HTMLHeadElement>(".close-card");

  if ($heading) {
    $heading.innerText = namespace;
  }
  if (!$fieldset) {
    return;
  }

  const quickEntry = (value: string) => {
    if (!value) {
      return;
    }
    const el = value.split(" ");
    const last = el.length > 1 ? el.pop() : null;
    const rest = el.join(" ");
    const [_skip, $f1, $f2] = Array.from(
      $fieldset.querySelectorAll<HTMLInputElement>('input:not([type="datetime-local"])')
    );
    $f1.value = rest;
    if (last) {
      $f2.value = last;
    }
  };

  const close = () => {
    const card = $closeButton?.closest(".card");
    if (card) {
      card.remove(); // TODO: proper cleanup
    }
  }

  $fieldset.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    if (target && target.classList.contains("quick-entry")) {
      quickEntry(target.value);
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
    // add record button
    e.preventDefault();
    if ($form && namespace) {
      const formData = new FormData($form);
      const data = Object.fromEntries(formData);
      console.table(data);
      api.add(namespace, data);
      // repopulate table
      Promise.all([api.getNamespaceConfig(namespace), api.getNamespaceData(namespace)]).then(([namespace, data]) => {
        const { config } = namespace;
        render(config, data);
      });
    }
  });

  const getDataListOptions = (name: string, data: any[]) =>
    Array.from(new Set(data.filter((i) => i).map((i) => i[name].trim())));

  const render = (config: any[], data: any[]) => {
    const quickEntryFields = config.filter((c) => !["datetime-local"].includes(c.type)).map((c) => c.name);

    const quickEntryDataList = dom(
      "datalist",
      {
        id: `dl-quick-entry-${id}`,
      },
      ...Array.from(
        new Set(
          data.reverse().map((row) =>
            quickEntryFields
              .map((name) => row[name])
              .filter((v) => v)
              .join(" ")
          )
        )
      ).map((o) => dom("option", {}, o))
    );

    const dataLists = config
      .filter((c) => ["text", "string"].includes(c.type))
      .map((c) => ({
        name: c.name,
        options: getDataListOptions(c.name, data),
      }))
      .filter((dl) => dl.options.length > 0)
      .map((dl) =>
        dom(
          "datalist",
          {
            id: `dl-${dl.name}-${id}`,
          },
          ...dl.options.map((o) => dom("option", {}, o))
        )
      );
    $dataLists?.replaceChildren(quickEntryDataList, ...dataLists);

    const formContent = config.map((cel) =>
      dom(
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
          ...(cel.required ? { required: "required" } : {}),
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
        autocapitalize: "none",
      })
    );
    // populate form
    $fieldset?.replaceChildren(quickEntry, ...formContent);

    const theadContent = config.map((cel) => dom("th", {}, cel.name));
    // populate thead
    $thead?.replaceChildren(...theadContent);

    const today = new Date().toISOString().substring(0, 10);

    const tbodyContent = data
      .sort((r1, r2) => r1.ts.localeCompare(r2.ts))
      .reverse()
      .slice(0, 30)
      .map((row) => {
        const tds = config.map((c) => {
          return dom("td", {}, `${formatValue(c.type, row[c.name])}`);
        });
        const isToday = row.ts && row.ts.toString().substr(0, 10) === today;
        return dom(
          "tr",
          {
            ...(isToday ? {} : { class: "older" }),
          },
          ...tds
        );
      });
    // populate tbody
    $tbody?.replaceChildren(...tbodyContent);
    $form?.querySelector<HTMLInputElement>(autofocus)?.focus();
  };

  const { config } = await api.getNamespaceConfig(namespace);
  const data = await api.getNamespaceData(namespace);

  render(config, data);

  $container.prepend($clone);
  $form?.querySelector<HTMLInputElement>(autofocus)?.focus();
};
