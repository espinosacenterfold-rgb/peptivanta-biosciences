import type { Metadata } from "next";
import CustomerFeedbackPage from "./CustomerFeedbackPage";

export const metadata: Metadata = {
  title: "Customer Feedback Area",
  description: "Private customer area for order-linked service feedback.",
  robots: { index: false, follow: false, nocache: true },
};

export default function CustomerFeedbackRoute() {
  return <CustomerFeedbackPage />;
}
