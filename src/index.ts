import { MemoryStorage } from "storage/memory";
import { app } from "./App";
import { API } from "./api/api";

window.addEventListener("load", () => {
  const storage = new MemoryStorage()
  const api = new API(storage)
  app(window, api)
});
