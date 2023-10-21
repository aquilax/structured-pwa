import { Message, NodeID, IStorageAPI, newMessageID, EmptyMessageID, Namespace, MessageID } from "./storage";

export const messagesStorageKey = "STORAGE";

export type StorageKey = string;
export type MessagesState = {
  messages: Message[];
};

export const defaultMessagesState = {
  messages: [],
};

export interface StorageAdapter<T> {
  get(): T;
  set(data: T): T;
}

export const localStorageAdapter = <T>(storageKey: StorageKey, def: Partial<T> = {} as T): StorageAdapter<T> => {
  const get = () => JSON.parse(localStorage.getItem(storageKey) || "null") || def;

  const set = (data: T): T => {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return data;
  };

  return {
    get,
    set,
  };
};

export const withCache = <T>(f: StorageAdapter<T>) => {
  let cache: T | null = null;
  const get = () => (cache ? cache : f.get());
  const set = (data: T): T => {
    cache = null;
    return f.set(data);
  };

  return {
    get,
    set,
  };
};

export const localStorageService = (nodeID: NodeID, messageStorage: StorageAdapter<MessagesState>): IStorageAPI => {
  const add = (namespace: Namespace, data: any): MessageID => {
    const state = messageStorage.get();
    const messageID = newMessageID(namespace, nodeID, (state.messages || []).length);
    const message: Message = {
      id: messageID,
      meta: {
        node: nodeID,
        ns: namespace,
        op: "ADD",
        messageID: EmptyMessageID,
        ts: new Date().getTime(),
      },
      data: data,
    };
    messageStorage.set({
      ...state,
      messages: [...(state.messages || []), message],
    });
    return messageID;
  };

  const get = (): Message[] => messageStorage.get().messages;

  const getAllAfter = (cursor: MessageID): Message[] => {
    const all = get();
    const i = all.findLastIndex((m) => m.id == cursor);
    return i === -1 ? all : all.slice(i + 1);
  };
  const append = (messages: Message[]): void => {
    const state = messageStorage.get();
    const newMessages = [...(state.messages || []), ...messages];
    messageStorage.set({
      ...state,
      messages: newMessages,
    });
  };

  return {
    add,
    get,
    getAllAfter,
    append,
  };
};
