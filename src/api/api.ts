import { PubSubService } from "pubsub";
import { StorageAdapter } from "storage/localStorage";
import { EmptyMessageID, Message, MessageID, NodeID, newMessageID } from "storage/storage";

export const messagesStorageKey = "STORAGE";


export type MessagesState = {
  messages: Message[];
};

export const defaultMessagesState = {
  messages: [],
};


type Namespace = string;
type HomeElement = {
  namespace: Namespace;
  name: string;
};

const namespaceHome: Namespace = "namespaceHomeV1";
const namespaceConfig: Namespace = "namespaceConfigV1";

export interface ApiService {
  getHomeElements(): Promise<HomeElement[]>;
  getNamespaceConfig(namespace: Namespace): Promise<Record<string, any>>;
  getNamespaceData(namespace: Namespace): Promise<Array<Record<string, any>>>;
  add(namespace: Namespace, data: any): MessageID;
  getAllAfter(cursor: MessageID): Message[];
  append(messages: Message[]): MessagesState;
  getAllMessages(): Message[];
}

export const apiService = (nodeID: NodeID, messageStorage: StorageAdapter<MessagesState>, pubSubService: PubSubService) => {
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
    pubSubService.emit('add')
    return messageID;
  };

  const getAllMessages = (): Message[] => messageStorage.get().messages;

  const getAllAfter = (cursor: MessageID): Message[] => {
    const all = getAllMessages();
    const i = all.findLastIndex((m) => m.id == cursor);
    return i === -1 ? all : all.slice(i + 1);
  };

  const append = (messages: Message[]): MessagesState => {
    const state = messageStorage.get();
    const ids = state.messages.map(m => m.id);
    const newMessages = [...(state.messages || []), ...messages.filter(m => !ids.includes(m.id))];
    return messageStorage.set({
      ...state,
      messages: newMessages,
    });
  };

  const getHomeElements = async (): Promise<HomeElement[]> => {
    const record = (await getNamespaceData(namespaceHome)).pop();
    return record?.config || [{ namespace: "$config", name: "Config" }];
  };

  const getNamespaceConfig = async (namespace: Namespace) => {
    return getNamespaceData(namespaceConfig).then(
      (data) =>
        data.find((c) => c.namespace === namespace) || {
          namespace: namespace,
          config: [],
        }
    );
  };

  const getNamespaceData = async (namespace: Namespace): Promise<Array<Record<string, any>>> => {
    const data = await getAllMessages();
    return data.filter((m) => m.meta.ns === namespace).map((m) => m.data);
  };

  const remove = async (id: MessageID): Promise<void> => {
    const state = messageStorage.get();
    messageStorage.set({
      ...state,
      messages: state.messages.filter((m) => m.id !== id)
    })
  };

  return {
    getHomeElements,
    getNamespaceConfig,
    getNamespaceData,
    add,
    getAllMessages,
    getAllAfter,
    append,
    remove,
  };
};
