import { Config, ConfigService } from "config";
import { ReplicationService } from "replication/replication";
import { dom } from "utils";

export const renderConfig = ({
  configService,
  replicationService,
  $container,
}: {
  configService: ConfigService;
  replicationService: ReplicationService;
  $container: HTMLElement;
}) => {
  const $templateConfig = document.getElementById(
    "template-config"
  ) as HTMLTemplateElement;
  const $clone = $templateConfig.content.cloneNode(true) as HTMLElement;
  const $form = $clone.querySelector<HTMLFormElement>("form");
  const $fieldset = $clone.querySelector<HTMLFieldSetElement>("fieldset");
  const $closeButton = $clone.querySelector<HTMLHeadElement>(".close-card");
  const $syncNowButton = $clone.querySelector<HTMLHeadElement>(".sync-now");

  $closeButton?.addEventListener("click", (e) => {
    const card = $closeButton?.closest(".card");
    if (card) {
      card.remove(); // TODO: proper cleanup
    }
  });

  if (!$fieldset) { return }

  $syncNowButton?.addEventListener('click', (e) => {
    e.preventDefault();
    replicationService.replicate();
  })

  $form?.addEventListener("submit", (e) => {
    e.preventDefault()
    const formData = new FormData($form);
    const data = Object.fromEntries(formData);
    console.table(data);
    const config = configService.save({...configService.get(),
      ReplicationURL: data.ReplicationURL.toString(),
      APIKey: data.APIKey.toString(),
      ReplicationInterval: parseInt(data.ReplicationInterval.toString(), 10),
      AutoReplication: (data.AutoReplication || 'false') === 'true' ? true : false,
    });
    render(config);
  });

  const render = (config: Config) => {
    const fields = [
      dom(
        "label",
        {},
        "NodeID",
        dom("input", {
          type: "text",
          value: config.NodeID,
          disabled: 'disabled',
        })
      ),

      dom(
        "label",
        {},
        "ReplicationURL",
        dom("input", {
          name: 'ReplicationURL',
          type: "text",
          value: config.ReplicationURL,
        })
      ),

      dom(
        "label",
        {},
        "APIKey",
        dom("input", {
          name: 'APIKey',
          type: "text",
          value: config.APIKey,
        })
      ),

      dom(
        "label",
        {},
        "ReplicationInterval",
        dom("input", {
          name: 'ReplicationInterval',
          type: "number",
          value: config.ReplicationInterval,
        })
      ),

      dom(
        "label",
        {},
        "AutoReplication",
        dom("input", {
          name: 'AutoReplication',
          type: "checkbox",
          value: "true",
          ...(config.AutoReplication ? { checked: "checked" } : {}),
        })
      ),
    ]
      .map((f) => dom("div", {}, f))
    $fieldset.replaceChildren(...fields);
  }
  render(configService.get());
  $container.prepend($clone);
};
