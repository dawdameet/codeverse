import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted: the event LAN has no internet access.
const display = localFont({
  src: [{ path: "./fonts/Cinzel-700.ttf", weight: "700" }],
  variable: "--font-cinzel",
  display: "swap",
});
const sans = localFont({
  src: [
    { path: "./fonts/Outfit-400.ttf", weight: "400" },
    { path: "./fonts/Outfit-600.ttf", weight: "600" },
  ],
  variable: "--font-outfit",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-400.ttf", weight: "400" },
    { path: "./fonts/JetBrainsMono-600.ttf", weight: "600" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CODEVERSE 2.0 — The Royal Mint",
  description: "Participant command center for CODEVERSE 2.0 by DJS CodeAI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
