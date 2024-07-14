import { dom, run } from "utils";
import { renderNamespace } from "./namespace";
import { ApiService } from "api/api";
import { renderConfig } from "./config";
import { ConfigService } from "config";
import { ReplicationService } from "replication/replication";

export const renderHome = async ({
  api,
  replicationService,
  configService,
  $container,
}: {
  api: ApiService;
  replicationService: ReplicationService;
  configService: ConfigService;
  $container: HTMLElement;
}) => {
  const $templateHome = document.getElementById("template-home") as HTMLTemplateElement;
  const $clone = $templateHome.content.cloneNode(true) as HTMLElement;
  const $homeContainer = $clone.querySelector<HTMLDivElement>(".home-container");

  const elements = await api.getHomeElements();

  $homeContainer?.addEventListener("click", (e: MouseEvent) => {
    // button click
    const target = e.target as HTMLButtonElement | null;
    if (!target) return;
    if (target.matches(".button.home")) {
      // button on home page
      e.preventDefault();
      const namespace = target.dataset["namespace"];
      const name = target.dataset["name"];
      if (namespace && name) {
        if (namespace === "$config") {
          renderConfig({
            configService,
            api,
            replicationService,
            $container: $container,
          });
        } else {
          renderNamespace({
            name,
            namespace,
            api,
            $container: $container,
          });
        }
      }
    }
  });

  run(() =>
    // populate buttons
    elements
      .map((el) => {
        const button = dom(
          "button",
          {
            ["data-namespace"]: el.namespace,
            ["data-name"]: el.name,
            class: "button home",
          },
          el.name
        );
        return button;
      })
      .forEach((b) => $homeContainer?.appendChild(b))
  );
  $container.prepend($clone);
};
