import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODEVERSE 2.0 — The Royal Mint",
  description: "Participant command center for CODEVERSE 2.0 by DJS CodeAI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
