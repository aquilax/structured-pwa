type MessageID = string
type Namespace = string
type MessageOperator = "ADD" | "UPDATE" | "DELETE";

interface IStorage {
  add(ns: Namespace, data: any): MessageID
}