import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./visual-workspace.css";
import "./reading-workspace.css";
import "./mobile-navigation.css";
import "./mobile-reader.css";
import "./mobile-learning.css";
import "./topic-hierarchy.css";
import "./workspace-redesign.css";
import "./learning-overview.css";
import "./learning-tutor.css";
import "./exam-simulation.css";
import "./workspace-composition.css";
import "./learning-transitions.css";
import "./flashcard-transitions.css";
import "./glossary.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

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
