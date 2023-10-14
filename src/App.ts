import { API } from "api/api";
import { renderHome } from "components/home";

export const app = (global: Window, api: API) => {
  const $container = global.document.getElementById("container") as HTMLDivElement;

  renderHome({api,$container});
}
