export interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

export type MessageID = string;
export type MessageOperator = "ADD" | "UPD" | "DEL" | string;
export type Namespace = string;

export interface MessageMeta {
  ns: Namespace;
  op: MessageOperator;
  message_id: MessageID;
  ts: number;
}

export interface Message {
  id: MessageID;
  meta: MessageMeta;
  data: any;
}

export interface Payload {
  cursor: MessageID;
  messages: Message[];
}

export const EmptyMessageID: MessageID = "-";
