"use client";

import { useCallback, useEffect, useState } from "react";
import { loadVote, saveVote } from "@/lib/storage";
import type { VoteTally } from "@/lib/types";

export function useVote() {
  const [vote, setVote] = useState<VoteTally>({ bull: 12, bear: 8, myVote: null, dateKey: "" });

  useEffect(() => {
    setVote(loadVote());
  }, []);

  const cast = useCallback((side: "bull" | "bear") => {
    setVote((prev) => {
      let { bull, bear, myVote } = prev;
      if (myVote === side) return prev;
      if (myVote === "bull") bull -= 1;
      if (myVote === "bear") bear -= 1;
      if (side === "bull") bull += 1;
      else bear += 1;
      const next = { ...prev, bull, bear, myVote: side };
      saveVote(next);
      return next;
    });
  }, []);

  return { vote, cast };
}
