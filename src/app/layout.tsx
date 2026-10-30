import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hospital Follow-up Continuity Platform',
  description: 'Clinical follow-up tracking, patient continuity, and clinical governance system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
