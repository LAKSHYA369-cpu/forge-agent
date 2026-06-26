import React from 'react';
import './globals.css';

export const metadata = {
  title: 'ForgeAgent Studio OS',
  description: 'Enterprise Multi-Agent Software Development Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
