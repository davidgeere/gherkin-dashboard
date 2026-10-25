import type { Metadata } from "next";
import { Google_Sans, Google_Sans_Code } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-google-sans",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const googleSansCode = Google_Sans_Code({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-google-sans-code",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Gherkin",
  description: "Manage the phones and the agent keys.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${googleSans.variable} ${googleSansCode.variable} h-full antialiased`}
    >
      <body className={`${googleSans.className} flex min-h-full flex-col`}>{children}</body>
    </html>
  );
}
