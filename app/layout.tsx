import type { Metadata } from "next";
import "./globals.css";
import "./visual-workspace.css";
import "./reading-workspace.css";

export const metadata: Metadata = {
  title: "Second Brain · Dein Wissensatelier",
  description: "Dein persönlicher Ort für Wissen, neue Verbindungen und eigene Lernpfade.",
  icons: {
    icon: "/brand/second-brain-mark.png",
    shortcut: "/brand/second-brain-mark.png",
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
