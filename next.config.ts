import type { NextConfig } from "next";
import type webpack from "webpack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "images.typeform.com" },
      { protocol: "https", hostname: "landing.coingecko.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "img.icons8.com" },
      { protocol: "https", hostname: "www.alchemy.com" },
      { protocol: "https", hostname: "lh7-us.googleusercontent.com" },
      { protocol: "https", hostname: "elitecity.io" },
      { protocol: "https", hostname: "images.mirror-media.xyz" },
      { protocol: "https", hostname: "www.datocms-assets.com" },
      { protocol: "https", hostname: "www.apple.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "www.coingecko.com" },
      { protocol: "https", hostname: "dd.dexscreener.com" },
      { protocol: "https", hostname: "images.seeklogo.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" }, // Add Firebase Storage
    ],
  },
  experimental: {},
  allowedDevOrigins: ["192.168.86.250"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.firebase.com https://*.gstatic.com;
              connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.dexscreener.com https://*.geckoterminal.com https://base-mainnet.g.alchemy.com wss://base-mainnet.g.alchemy.com https://api.coingecko.com http://localhost:3000;
              img-src 'self' data: https://i.imgur.com https://images.typeform.com https://landing.coingecko.com https://upload.wikimedia.org https://res.cloudinary.com https://www.google.com https://img.icons8.com https://www.alchemy.com https://lh7-us.googleusercontent.com https://elitecity.io https://images.mirror-media.xyz https://www.datocms-assets.com https://www.apple.com https://assets.coingecko.com https://www.coingecko.com https://dd.dexscreener.com https://images.seeklogo.com https://firebasestorage.googleapis.com;
              style-src 'self' 'unsafe-inline' https://use.typekit.net https://fonts.googleapis.com;
              font-src 'self' data: https://fonts.gstatic.com;
            `.replace(/\s+/g, " ").trim(),
          },
        ],
      },
    ];
  },
  webpack: (config: webpack.Configuration, { isServer }: { isServer: boolean }): webpack.Configuration => {
    console.log("Webpack config running, isServer:", isServer);
    if (!isServer) {
      console.log("Applying client-side Webpack fallback for Node.js modules");
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;