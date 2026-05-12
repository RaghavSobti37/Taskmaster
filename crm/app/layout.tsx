import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TSC CRM | Lead Management",
  description: "CRM for sales leads, EMI tracking, and conversions",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
