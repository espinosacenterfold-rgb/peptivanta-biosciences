import type { Metadata } from "next";
import AdminGeneratorPage from "./AdminGeneratorPage";

export const metadata: Metadata = {
  title: "Generator Admin",
  description: "Private illustrative-order generator controls.",
  robots: { index: false, follow: false, nocache: true },
};

export default function GeneratorAdminRoute() {
  return <AdminGeneratorPage />;
}
