"use client";

import {
  createContext,
  createElement,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const ADMIN_SESSION_KEY = "peptivanta_fulfillment_admin_key";

type AdminSessionValue = {
  adminKey: string;
  setAdminKey: (value: string) => void;
  authenticated: boolean;
  checking: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  request: <T>(url: string, init?: RequestInit, key?: string) => Promise<T>;
  signIn: (event: FormEvent) => Promise<void>;
  signOut: () => void;
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const performRequest = useCallback(
    async <T,>(url: string, init: RequestInit, key: string) => {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${key}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      const data = (await response.json()) as T & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
          setAuthenticated(false);
          setAdminKey("");
        }
        throw new Error(data.error ?? "操作失败，请重试。");
      }
      return data;
    },
    [],
  );

  const request = useCallback(
    <T,>(url: string, init: RequestInit = {}, key = adminKey) =>
      performRequest<T>(url, init, key),
    [adminKey, performRequest],
  );

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    window.queueMicrotask(() => {
      if (!stored) {
        setChecking(false);
        return;
      }

      setAdminKey(stored);
      setBusy(true);
      void performRequest("/api/admin/dashboard", {}, stored)
        .then(() => setAuthenticated(true))
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : "安全会话已失效，请重新登录。");
        })
        .finally(() => {
          setBusy(false);
          setChecking(false);
        });
    });
  }, [performRequest]);

  const signIn = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        await performRequest("/api/admin/dashboard", {}, adminKey);
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, adminKey);
        setAuthenticated(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "验证失败。");
      } finally {
        setBusy(false);
        setChecking(false);
      }
    },
    [adminKey, performRequest],
  );

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminKey("");
    setAuthenticated(false);
    setChecking(false);
    setError("");
  }, []);

  const value = useMemo<AdminSessionValue>(
    () => ({
      adminKey,
      setAdminKey,
      authenticated,
      checking,
      busy,
      setBusy,
      error,
      setError,
      request,
      signIn,
      signOut,
    }),
    [adminKey, authenticated, busy, checking, error, request, signIn, signOut],
  );

  return createElement(AdminSessionContext.Provider, { value }, children);
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error("useAdminSession must be used inside AdminSessionProvider.");
  return context;
}
