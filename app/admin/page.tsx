import type { Metadata } from "next";
import AdminOrdersPage from "./orders/AdminOrdersPage";

export const metadata: Metadata = {
  title: "Unified Fulfillment Admin",
  description: "Private fulfillment management for Peptivanta Biosciences.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

/**
 * The memorable admin entry point. The real-order workspace is the default;
 * its header provides the one-click switch to generator controls while both
 * workspaces reuse the same tab-scoped credential.
 */
export default function UnifiedAdminRoute() {
  return <AdminOrdersPage />;
}
