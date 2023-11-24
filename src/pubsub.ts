export type Hook = "add" | "connection" | "replicationStart" | "replicationStop";
export type Callback = (...args: any) => void;

export interface PubSubService {
  emit(hook: Hook, ...args: any): void;
  on(hook: Hook, cb: Callback): void;
  off(hook: Hook, cb: Callback): void;
}

export const getPubSubService = () => {
  let subscriptions: Array<{ hook: Hook; cb: Callback }> = [];

  const emit = (hook: Hook, ...args: any) => subscriptions.forEach((s) => s.hook == hook && s.cb(...args));
  const on = (hook: Hook, cb: Callback) => subscriptions.push({ hook, cb });
  const off = (hook: Hook, cb: Callback) => {
    subscriptions = subscriptions.filter((s) => s.hook === hook && s.cb === cb);
  };

  return {
    on,
    off,
    emit,
  };
};
