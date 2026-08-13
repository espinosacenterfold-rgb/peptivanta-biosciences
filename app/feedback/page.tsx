import type { Metadata } from "next";
import FeedbackPage from "./FeedbackPage";

export const metadata: Metadata = {
  title: "Buyer Service Feedback",
  description: "Reviewed customer submissions.",
};

export default function FeedbackRoute() {
  return <FeedbackPage />;
}
