import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Homebase Markets",
  icons: {
    icon: "https://i.imgur.com/tucXG6S.png"
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}





