import { IStorage } from "./storage";

export class MemoryStorage implements IStorage{
  add(ns: string, data: any): string {
    throw new Error("Method not implemented.");
  }
  get(ns: string) {
    throw new Error("Method not implemented.");
  }
}