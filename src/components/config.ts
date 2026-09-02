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

  $magicNamespaces?.replaceChildren(
    ...magicNamespaces.map((namespace) => {
      const option = document.createElement("option");
      option.value = namespace;
      return option;
    })
  );

  $loadRawButton?.addEventListener("click", async () => {
    const namespace = $namespaceInput?.value.trim();
    if (!namespace || !$rawMessage) return;

    const data = await api.getLatestNamespaceData(namespace);
    if (data !== undefined) {
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
        "label",
        {},
        "ReplicationURL",
        dom("input", {
          name: "ReplicationURL",
          type: "url",
          value: config.ReplicationURL,
        })
      ),

      dom(
        "label",
        {},
        "APIKey",
        dom("input", {
          name: "APIKey",
          type: "text",
          value: config.APIKey,
        })
      ),

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
