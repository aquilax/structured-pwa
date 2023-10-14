import { API } from "api/api";
import { dom, getLocaleDateTime, run } from "utils";

type FieldType = string;

const getDefaultValue = (type: FieldType) => {
  if (type === "datetime-local") {
    return getLocaleDateTime(new Date());
  }
  if (type === "number") {
    return 1;
  }
  return "";
};

export const renderNamespace = async ({
  namespace,
  api,
  $container,
}: {
  namespace: Namespace;
  api: API;
  $container: HTMLElement;
}) => {
  const $templateNamespace = document.getElementById(
    "template-namespace"
  ) as HTMLTemplateElement;

  const $clone = $templateNamespace.content.cloneNode(true) as HTMLElement;

  const $form = $clone.querySelector<HTMLFormElement>("form");
  const $fieldset = $clone.querySelector<HTMLElement>("form>fieldset");
  const $thead = $clone.querySelector<HTMLElement>("thead");
  const $tbody = $clone.querySelector<HTMLElement>("tbody");
  const $heading = $clone.querySelector<HTMLHeadElement>(".heading");
  const $addButton = $clone.querySelector<HTMLHeadElement>(".add-record");
  const $closeButton = $clone.querySelector<HTMLHeadElement>(".close-card");

  if ($heading) {
    $heading.innerText = namespace;
  }

  $closeButton?.addEventListener("click", (e) => {
    const card = $closeButton?.closest(".card");
    if (card) {
      card.remove(); // TODO: proper cleanup
    }
  });

  $addButton?.addEventListener("click", (e) => {
    // add record button
    e.preventDefault();
    if ($form && namespace) {
      const formData = new FormData($form);
      const data = Object.fromEntries(formData);
      console.table(data);
      api.add(namespace, data).then(() => {
        $form.reset();
        // TODO: repopulate table
        Promise.all([
          api.getNamespaceConfig(namespace),
          api.getNamespaceData(namespace),
        ]).then(([namespace, data]) => {
          const { config } = namespace;
          render(config, data);
        });
      });
    }
  });

  const render = (config: any[], data: any[]) => {
    const formContent = config.map((cel) =>
      dom(
        "label",
        {},
        cel.name,
        dom("input", {
          type: cel.type,
          name: cel.name,
          value: getDefaultValue(cel.type),
        })
      )
    );
    // populate form
    $fieldset?.replaceChildren(...formContent);

    const theadContent = config.map((cel) =>
        dom("th", {}, cel.name)
      )
    // populate thead
    $thead?.replaceChildren(...theadContent);

    const tbodyContent = data
        .reverse()
        .map((row) => {
          const tds = config.map((c) => {
            return dom("td", {}, `${row[c.name]}`);
          });
          return dom("tr", {}, ...tds);
        })
    // populate tbody
    $tbody?.replaceChildren(...tbodyContent)
  }

  const { config } = await api.getNamespaceConfig(namespace);
  const data = await api.getNamespaceData(namespace);

  render(config, data);

  $container.prepend($clone);
};
