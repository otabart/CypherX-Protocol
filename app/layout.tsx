import type { Metadata } from "next";
import "./globals.css"; // includes Tailwind (base, components, utilities)
import { Providers } from "./providers"; // Our new combined Firebase + Query + Competition provider

export const metadata: Metadata = {
  title: "Homebase Markets",
  icons: {
    icon: "https://i.imgur.com/tucXG6S.png",
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
          {/* Web3Modal Wallet Connect Button (globally available) */}
          <w3m-button />
          {children}
        </Providers>
      </body>
    </html>
  );
}








