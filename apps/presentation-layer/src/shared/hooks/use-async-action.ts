"use client";

import { useRef, useState } from "react";
import { requestError } from "@/shared/lib/request-error";

/** Keeps forms open on failure and ignores duplicate submissions while saving. */
export function useAsyncAction() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => void | Promise<void>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await action();
      return true;
    } catch (failure) {
      setError(requestError(failure));
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { pending, error, run };
}
