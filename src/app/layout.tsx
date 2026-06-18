import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pgco.world"),
  title: "Provecta Group — Business Operations toolkit, and the firm that runs it",
  description:
    "Free assessments, calculators, templates, and playbooks to find where revenue leaks and operations drag — then the team that fixes it. Built on bRRAIn.",
  applicationName: "Provecta Group",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Provecta Group",
    url: "https://www.pgco.world",
    title: "Provecta Group — Business Operations on bRRAIn",
    description: "The operations toolkit, and the firm that runs it for you.",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // verification: { google: "<token>" }, // add once Search Console verification token is provided
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
