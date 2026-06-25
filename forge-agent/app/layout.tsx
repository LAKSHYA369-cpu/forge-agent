import React from 'react';

export const metadata = {
  title: 'Forge-Agent OS',
  description: 'Autonomous Developer Platform Core Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0b0f19' }}>
        {children}
      </body>
    </html>
  );
}
