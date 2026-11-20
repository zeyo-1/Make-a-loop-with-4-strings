import { useEffect, useState } from 'react';

// 記録はこの端末のブラウザの中だけに保存する（読めない環境でも動くように try で包む）
const PREFIX = 'himo-no-wa.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 保存できなくても使えるようにする */
  }
}

export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    load(key, typeof initial === 'function' ? (initial as () => T)() : initial),
  );
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}
