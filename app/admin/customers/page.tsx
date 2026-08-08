import type { Metadata } from "next";
import AdminCustomersPage from "./AdminCustomersPage";
export const metadata: Metadata = { title: "Customer Accounts", robots: { index: false, follow: false, nocache: true } };
export default function AdminCustomersRoute() { return <AdminCustomersPage />; }
