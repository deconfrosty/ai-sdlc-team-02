import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI SDLC Team 02 Todo App",
  description: "A collaborative Todo application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
