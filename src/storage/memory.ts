export class MemoryStorage implements IStorage{
  add(ns: string, data: any): string {
    throw new Error("Method not implemented.");
  }
  getAll(ns: string) {
    throw new Error("Method not implemented.");
  }
}