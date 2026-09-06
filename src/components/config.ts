import { ApiService, magicNamespaces } from "api/api";
import { ConfigState, ConfigService } from "config";
import { ReplicationService } from "replication/replication";
import { dom } from "utils";

export const renderConfig = ({
  configService,
  api,
  replicationService,
  $container,
}: {
  configService: ConfigService;
  api: ApiService;
  replicationService: ReplicationService;
  $container: HTMLElement;
}) => {
  const $templateConfig = document.getElementById("template-config") as HTMLTemplateElement;
  const $clone = document.importNode($templateConfig.content, true);
  const $form = $clone.querySelector<HTMLFormElement>("form");
  const $formRaw = $clone.querySelector<HTMLFormElement>("#form-raw");
  const $namespaceInput = $clone.querySelector<HTMLInputElement>('input[name="namespace"]');
  const $rawMessage = $clone.querySelector<HTMLTextAreaElement>('textarea[name="rawMessage"]');
  const $magicNamespaces = $clone.querySelector<HTMLDataListElement>("#magic-namespaces");
  const $loadRawButton = $clone.querySelector<HTMLButtonElement>(".load-raw");
  const $fieldset = $clone.querySelector<HTMLFieldSetElement>("fieldset");
  const $closeButton = $clone.querySelector<HTMLHeadElement>(".close-card");
  const $compactButton = $clone.querySelector<HTMLButtonElement>(".compact-storage");
  const $compactStatus = $clone.querySelector<HTMLSpanElement>(".compact-status");
  const $syncNowButton = $clone.querySelector<HTMLHeadElement>(".sync-now");

  $closeButton?.addEventListener("click", (e) => {
    const card = $closeButton?.closest(".card");
    if (card) {
      card.remove(); // TODO: proper cleanup
    }
  });

  if (!$fieldset) return;

  const setNamespaceOptions = (namespaces: string[]) => {
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
      ...namespaces.map((namespace) => `${magicNamespaces[1]}.${namespace}`),
    ]);
  });

  $loadRawButton?.addEventListener("click", async () => {
    const selectedNamespace = $namespaceInput?.value.trim();
    if (!selectedNamespace || !$rawMessage) return;

    const [namespace, configNamespace] = selectedNamespace.split(`${magicNamespaces[1]}.`);
    const data = configNamespace === undefined
      ? await api.getLatestNamespaceData(selectedNamespace)
      : await api.getLatestNamespaceConfig(configNamespace);
    if (data !== undefined) {
      if ($namespaceInput && configNamespace !== undefined) {
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

  const readTargets = () => [...$fieldset.querySelectorAll<HTMLElement>(".replication-target")].map((row) => ({
    id: row.dataset.targetId || `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    url: row.querySelector<HTMLInputElement>(".target-url")?.value.trim() || "",
    apiKey: row.querySelector<HTMLInputElement>(".target-api-key")?.value || "",
    enabled: row.querySelector<HTMLInputElement>(".target-enabled")?.checked === true,
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
      AutoReplication: (data.AutoReplication || "false") === "true" ? true : false,
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
  })

  const render = (config: ConfigState, lastUpdate: number) => {
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
            value: target.url,
          })
        ),
        dom(
          "label",
          {},
          "API key",
          dom("input", {
            class: "target-api-key",
            type: "text",
            value: target.apiKey,
          })
        ),
        dom(
          "label",
          { class: "target-enabled-label" },
          dom("input", {
            class: "target-enabled",
            type: "checkbox",
            ...(target.enabled ? { checked: "checked" } : {}),
          }),
          "Enabled"
        ),
        dom("button", { type: "button", class: "remove-target" }, "remove")
      );
      $row.querySelector<HTMLButtonElement>(".remove-target")?.addEventListener("click", () => {
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
        enabled: true,
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
          disabled: "disabled",
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
          value: config.ReplicationInterval,
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
          ...(config.AutoReplication ? { checked: "checked" } : {}),
        })
      ),
      dom("em", {}, `Last update: ${new Date(lastUpdate).toLocaleString("sv", { timeZoneName: "short" })}`),
    ].map((f) => dom("div", {}, f));
    $fieldset.replaceChildren(...fields);
  };
  render(configService.get(), replicationService.getLastUpdate());
  $container.prepend($clone);
};
