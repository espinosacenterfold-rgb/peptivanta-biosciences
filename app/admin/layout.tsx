import type { ReactNode } from "react";
import { AdminSessionProvider } from "./_components/useAdminSession";

/**
 * This layout persists during client-side navigation between admin modules.
 * The server still validates the bearer key on every protected API request.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
