export type NodeID = string;

export type Namespace = string;
export type MessageID = string;
export type MaybeMessageID = MessageID | null;
export type MessageOperator = "ADD" | "UPDATE" | "DELETE";
export type MessageData = any;

export type MessageMeta = {
  node: NodeID;
  ns: Namespace;
  op: MessageOperator;
  messageID: MaybeMessageID;
  ts: number;
};

export type Message = {
  id: MessageID;
  meta: MessageMeta;
  data: MessageData;
};

export const EmptyMessageID = "-";

export const newMessageID = (
  namespace: Namespace,
  nodeID: NodeID,
  counter: number
): MessageID => `${namespace}.${nodeID}.${counter}`;

export interface IStorage {
  add(ns: Namespace, data: any): MessageID;
  get(): Message[];
  getAllAfter(cursor: MessageID): Message[];
  append(messages: Message[]): void;
}
