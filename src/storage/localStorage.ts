export type StorageKey = string;

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

