import { useCallback, useEffect, useState } from "react";

export type ListItem = {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster?: string | null;
  r?: number;
  y?: string;
  at?: number;
};

export type CwItem = ListItem & { s?: number; e?: number; p?: number };

const read = <T,>(k: string, f: T): T => {
  if (typeof window === "undefined") return f;
  try {
    return (JSON.parse(localStorage.getItem(k) as string) as T) ?? f;
  } catch {
    return f;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    window.dispatchEvent(new CustomEvent("cimaly-store", { detail: k }));
  } catch {
    /* ignore */
  }
};

const LIST = "cimaly.list";
const CW = "cimaly.cw";

export const getList = () => read<ListItem[]>(LIST, []);
export const getCw = () => read<CwItem[]>(CW, []);

export function toggleList(item: ListItem) {
  const l = getList();
  const exists = l.some((i) => i.type === item.type && i.id === item.id);
  write(
    LIST,
    exists
      ? l.filter((i) => !(i.type === item.type && i.id === item.id))
      : [{ ...item, at: Date.now() }, ...l],
  );
}

export function recordWatch(entry: CwItem) {
  const l = getCw().filter((i) => !(i.type === entry.type && i.id === entry.id));
  write(CW, [{ ...entry, at: Date.now() }, ...l].slice(0, 24));
}

export const removeCw = (type: string, id: number) =>
  write(
    CW,
    getCw().filter((i) => !(i.type === type && i.id === id)),
  );
export const clearCw = () => write(CW, []);

function useStore<T>(key: string, get: () => T) {
  const [value, setValue] = useState<T>(() => get());
  const refresh = useCallback(() => setValue(get()), [get]);
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("cimaly-store", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("cimaly-store", h);
      window.removeEventListener("storage", h);
    };
  }, [refresh, key]);
  return value;
}

export const useMyList = () => useStore<ListItem[]>(LIST, getList);
export const useContinueWatching = () => useStore<CwItem[]>(CW, getCw);