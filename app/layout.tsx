import './globals.css';
import { Providers } from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CypherX - Your Edge in Crypto',
  description: 'Professional trading terminal with advanced analytics, portfolio tracking, and lightning-fast execution.',
  icons: {
    icon: 'https://i.imgur.com/vnxzC6q.png',
    shortcut: 'https://i.imgur.com/vnxzC6q.png',
    apple: 'https://i.imgur.com/vnxzC6q.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="geist antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}









