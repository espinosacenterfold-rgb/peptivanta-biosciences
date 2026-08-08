import type { Metadata } from "next";
import AdminMediaPage from "./AdminMediaPage";
export const metadata: Metadata = { title: "Feedback Media Library", robots: { index: false, follow: false, nocache: true } };
export default function AdminMediaRoute() { return <AdminMediaPage />; }
