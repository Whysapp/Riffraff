import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TabCraft Pro',
  description: 'Transform any song into tablature for your instrument',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

