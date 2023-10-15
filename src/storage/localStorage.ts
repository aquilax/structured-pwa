import {
  Message,
  NodeID,
  IStorage,
  newMessageID,
  EmptyMessageID,
} from "./storage";

export type State = {
  counter: number;
  messages: Message[];
};

export class LocalStorage implements IStorage {
  storageKey = "STORAGE";
  nodeID: NodeID;

  constructor(nodeID: NodeID) {
    this.nodeID = nodeID;
  }

  private getState(storageKey: string) {
    return JSON.parse(localStorage.getItem(storageKey) || "{}") as State;
  }

  private setState(storageKey: string, state: State) {
    return localStorage.setItem(storageKey, JSON.stringify(state));
  }

  private onlyNodeMessages = (messages: Message[]) =>
    messages.filter(m => m.meta.node === this.nodeID)

  add(namespace: string, data: any): string {
    const state = this.getState(this.storageKey);
    const messageID = newMessageID(namespace, this.nodeID, (state.messages || []).length);
    const message: Message = {
      id: messageID,
      meta: {
        node: this.nodeID,
        ns: namespace,
        op: "ADD",
        messageID: EmptyMessageID,
        ts: new Date().getTime(),
      },
      data: data,
    };
    this.setState(this.storageKey, {
      ...state,
      counter: this.onlyNodeMessages(state.messages || []).length,
      messages: [...(state.messages || []), message],
    });
    return messageID;
  }

  append(messages: Message[]) {
    const state = this.getState(this.storageKey);
    const newMessages = [...(state.messages || []), ...messages];
    this.setState(this.storageKey, {
      ...state,
      counter: this.onlyNodeMessages(newMessages).length,
      messages: newMessages,
    });
  }

  get() {
    return this.getState(this.storageKey).messages || [];
  }
}
