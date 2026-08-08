"use client";

import { FormEvent, useEffect, useState } from "react";

export const ADMIN_SESSION_KEY = "peptivanta_fulfillment_admin_key";

export function useAdminSession() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request<T>(url: string, init: RequestInit = {}, key = adminKey) {
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
      }
      throw new Error(data.error ?? "操作失败，请重试。");
    }
    return data;
  }

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return;
    window.queueMicrotask(() => {
      setAdminKey(stored);
      setBusy(true);
      void request("/api/admin/dashboard", {}, stored)
        .then(() => setAuthenticated(true))
        .catch((caught) => setError(caught instanceof Error ? caught.message : "验证失败。"))
        .finally(() => setBusy(false));
    });
    // Request is stable for the tab-scoped initial check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/dashboard", {}, adminKey);
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, adminKey);
      setAuthenticated(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证失败。");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminKey("");
    setAuthenticated(false);
  }

  return {
    adminKey,
    setAdminKey,
    authenticated,
    busy,
    setBusy,
    error,
    setError,
    request,
    signIn,
    signOut,
  };
}
