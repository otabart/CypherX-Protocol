import './globals.css';
import { Providers } from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CypherX Protocol',
  icons: {
    icon: 'https://i.imgur.com/8NiARbt.png',
  },
};

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









