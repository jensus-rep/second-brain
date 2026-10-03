import type { Metadata } from "next";
import "./globals.css";
import "./visual-workspace.css";
import "./reading-workspace.css";

export const metadata: Metadata = {
  title: "NewHope · Dein Wissensatelier",
  description: "Dein persönlicher Ort für Wissen, neue Verbindungen und eigene Lernpfade.",
  icons: {
    icon: "/brand/newhope-mark.png",
    shortcut: "/brand/newhope-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
