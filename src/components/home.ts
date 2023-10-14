import { dom, run } from "utils";
import { renderNamespace } from "./namespace";
import { API } from "api/api";

export const renderHome = async ({
  api,
  $container,
}: {
  api: API;
  $container: HTMLElement;
}) => {
  const $templateHome = document.getElementById(
    "template-home"
  ) as HTMLTemplateElement;
  const $clone = $templateHome.content.cloneNode(true) as HTMLElement;
  const $home = $clone.querySelector<HTMLDivElement>(".home");

  const elements = await api.getHomeElements();

  $home?.addEventListener("click", (e: MouseEvent) => {
    // button click
    const target = e.target as HTMLButtonElement | null;
    if (!target) return;
    if (target.matches(".button.home")) {
      // button on home page
      e.preventDefault();
      const namespace = target.dataset["namespace"];
      if (namespace) {
        if (namespace[0] === "$") {
          // TODO: special page
        } else {
          renderNamespace({
            namespace,
            api: api,
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
            class: "button home",
          },
          el.name
        );
        return button;
      })
      .forEach((b) => $home?.appendChild(b))
  );
  $container.prepend($clone);
}