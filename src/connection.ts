import { PubSubService } from "pubsub";

export interface ConnectionService {
  isOnline(): boolean;
}

export const getConnectionService = ({ pubSubService }: { pubSubService: PubSubService }) => {
  window.addEventListener("offline", (e) => {
    pubSubService.emit("connection", "offline");
  });

  window.addEventListener("online", (e) => {
    pubSubService.emit("connection", "online");
  });

  return {
    isOnline: () => navigator.onLine
  }
};
