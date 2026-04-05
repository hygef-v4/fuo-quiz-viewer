import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FUO Quiz Web Viewer",
  description: "View quiz ZIP files from Google Drive directly on the web"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
