import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scoping Review Reader",
  description: "Local paper reader and evidence workspace for scoping reviews"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
