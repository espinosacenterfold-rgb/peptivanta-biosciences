import type { Metadata } from "next";
import AdminFeedbackPage from "./AdminFeedbackPage";
export const metadata: Metadata = { title: "Feedback Moderation", robots: { index: false, follow: false, nocache: true } };
export default function AdminFeedbackRoute() { return <AdminFeedbackPage />; }
