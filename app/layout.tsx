import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./ledger.css";
import "./coa.css";
import "./admin-orders.css";
import "./feedback.css";
import "./customer.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);

  return {
    metadataBase: origin,
    title: {
      default: "Peptivanta Biosciences | Documented Peptide Supply",
      template: "%s | Peptivanta Biosciences",
    },
    description:
      "Documented peptide supply, private-label support, and export coordination for professional customers.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Peptivanta Biosciences",
      description:
        "Documented peptide supply for qualified professional customers.",
      type: "website",
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          width: 1732,
          height: 909,
          alt: "Peptivanta Biosciences — Peptide supply, made clear.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Peptivanta Biosciences",
      description:
        "Documented peptide supply for qualified professional customers.",
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
