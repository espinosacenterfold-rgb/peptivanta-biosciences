import type { Metadata } from "next";
import AdminGeneratorPage from "./AdminGeneratorPage";

export const metadata: Metadata = {
  title: "Unified Fulfillment Admin · Generator",
  description: "Private illustrative-order generator controls for Peptivanta.",
  robots: { index: false, follow: false, nocache: true },
};

export default function GeneratorAdminRoute() {
  return <AdminGeneratorPage />;
}
