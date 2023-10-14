type NodeID = string;

type Namespace = string;
type MessageID = string;
type MaybeMessageID = MessageID | null;
type MessageOperator = "ADD" | "UPDATE" | "DELETE";
type MessageData = string;

type MessageMeta = {
  ns: Namespace;
  op: MessageOperator;
  messageID: MaybeMessageID;
  ts: number;
};

type Message = {
  id: MessageID;
  meta: MessageMeta;
  data: MessageData;
};

type State = {
  counter: number;
  messages: Message[];
};

const EmptyMessageID = '-'

const newMessageID = (
  namespace: Namespace,
  nodeID: NodeID,
  counter: number
): MessageID => `${namespace}.${nodeID}.${counter}.`;

export class LocalStorage implements IStorage {
  storageKey = "STORAGE";
  state: State
  counter = 0;
  nodeID: NodeID;

  constructor(nodeID: NodeID) {
    this.nodeID = nodeID;
    this.state = this.getState(this.storageKey)
  }

  getState(storageKey: string) {
    this.state = JSON.parse(localStorage.getItem(storageKey) || "{}") as State;
    return this.state
  }

  setState(storageKey: string, state: State) {
    this.state = state
    return localStorage.setItem(storageKey,JSON.stringify( state))
  }

  add(namespace: string, data: any): string {
    const state = this.getState(this.storageKey)
    const messageID = newMessageID(namespace, this.nodeID, this.counter++);
    const message: Message = {
      id: messageID,
      meta: { ns: namespace, op: "ADD",messageID: EmptyMessageID, ts: new Date().getTime()},
      data: data,
    };
    this.setState(this.storageKey, {
        ...state,
        counter: this.counter,
        messages: [...state.messages, message],
      });
    return messageID;
  }
  getAll(ns: string) {
    throw new Error("Method not implemented.");
  }
}
