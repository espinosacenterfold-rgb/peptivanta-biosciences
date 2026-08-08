import type { Metadata } from "next";
import CustomerAccessPage from "./CustomerAccessPage";

export const metadata: Metadata = {
  title: "Customer Access",
  description: "Lightweight account access for order-linked service feedback.",
  robots: { index: false, follow: false, nocache: true },
};

export default function CustomerAccessRoute() {
  return <CustomerAccessPage />;
}
