import type { Metadata } from "next";
import AdminWorkspacePage from "./AdminWorkspacePage";

export const metadata: Metadata = { title: "Operations Workspace", robots: { index: false, follow: false, nocache: true } };
export default function AdminWorkspaceRoute() { return <AdminWorkspacePage />; }
