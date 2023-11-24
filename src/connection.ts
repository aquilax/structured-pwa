import { PubSubService } from "pubsub";

export interface ConnectionService {
  isOnline(): boolean;
}

export const getConnectionService = ({ pubSubService }: { pubSubService: PubSubService }) => {
  const isOnline = () => navigator.onLine

  pubSubService.on("checkConnection", () => {
    pubSubService.emit(isOnline() ? "connectionOnline" : "connectionOffline")
  })

  window.addEventListener("offline", (e) => {
    pubSubService.emit("connectionOffline");
  });

  window.addEventListener("online", (e) => {
    pubSubService.emit("connectionOnline");
  });

  return {
    isOnline
  }
};
