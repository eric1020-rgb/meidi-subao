"use client";

import { useCallback, useEffect, useState } from "react";
import { loadWatchlist, saveWatchlist } from "@/lib/storage";

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setList(loadWatchlist());
    setReady(true);
  }, []);

  const persist = useCallback((next: string[]) => {
    setList(next);
    saveWatchlist(next);
  }, []);

  const add = useCallback(
    (ticker: string) => {
      const t = ticker.trim().toUpperCase();
      if (!t) return;
      setList((prev) => {
        if (prev.includes(t)) return prev;
        const next = [...prev, t];
        saveWatchlist(next);
        return next;
      });
    },
    []
  );

  const remove = useCallback((ticker: string) => {
    setList((prev) => {
      const next = prev.filter((x) => x !== ticker);
      saveWatchlist(next);
      return next;
    });
  }, []);

  const toggle = useCallback((ticker: string) => {
    const t = ticker.trim().toUpperCase();
    setList((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      saveWatchlist(next);
      return next;
    });
  }, []);

  return { list, add, remove, toggle, ready, setList: persist };
}
