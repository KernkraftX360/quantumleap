import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthBridge } from "@/components/auth-bridge";
import "./globals.css";



export const metadata: Metadata = {
  title: { default: "Quantum Leap — Your time, back", template: "%s · Quantum Leap" },
  description: "Join nearby queues remotely with live wait and travel estimates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#13795b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased"><AuthBridge />{children}</body>
    </html>
  );
}
