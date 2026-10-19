"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { TodoItem } from "../types/todo";
import {
  inboxKey,
  parseInbox,
  collectInbox,
  markInboxRead,
} from "../utils/inAppNotifications";
const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  window.addEventListener("apptodo-inbox", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("apptodo-inbox", fn);
  };
};
export function useInAppNotifications(
  scope: string,
  tasks: TodoItem[],
  loaded: boolean,
) {
  const [error, setError] = useState("");
  const snapshot = useCallback(() => {
    try {
      return localStorage.getItem(inboxKey(scope)) || "";
    } catch {
      return "";
    }
  }, [scope]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const items = useMemo(() => parseInbox(raw).items, [raw]);
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      try {
        const before = localStorage.getItem(inboxKey(scope));
        const after = collectInbox(localStorage, scope, tasks);
        if (after !== before) window.dispatchEvent(new Event("apptodo-inbox"));
        setError("");
      } catch {
        setError(
          "Não foi possível salvar os avisos neste navegador. Verifique o armazenamento.",
        );
      }
    };
    void Promise.resolve().then(refresh);
    const id = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [scope, tasks, loaded]);
  const markRead = (id?: string) => {
    try {
      markInboxRead(localStorage, scope, id);
      window.dispatchEvent(new Event("apptodo-inbox"));
      setError("");
      return true;
    } catch {
      setError("Não foi possível marcar como lida. Tente novamente.");
      return false;
    }
  };
  return {
    items: loaded ? items : [],
    unread: loaded ? items.filter((x) => !x.read).length : 0,
    error,
    markRead,
  };
}
