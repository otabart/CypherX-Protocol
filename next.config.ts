/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: "i.imgur.com" },
      { hostname: "images.typeform.com" },
      { hostname: "landing.coingecko.com" },
      { hostname: "upload.wikimedia.org" },
      { hostname: "res.cloudinary.com" },
      { hostname: "www.google.com" },
      { hostname: "img.icons8.com" },
      { hostname: "www.alchemy.com" },
      { hostname: "lh7-us.googleusercontent.com" },
      { hostname: "elitecity.io" },
      { hostname: "images.mirror-media.xyz" },
      { hostname: "www.datocms-assets.com" },
      { hostname: "www.apple.com" },
      // Added for DexScreener and CoinGecko images
      { hostname: "assets.coingecko.com" }, // CoinGecko image domain
      { hostname: "www.coingecko.com" }, // Additional CoinGecko image domain
      { hostname: "dd.dexscreener.com" }, // DexScreener image domain
    ],
  },
  experimental: {
    appDir: true, // Keep if using App Router; remove if using Pages Router
  },
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
              connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.dexscreener.com https://*.geckoterminal.com https://base-mainnet.g.alchemy.com https://api.coingecko.com http://localhost:3000;
              img-src 'self' data: https://i.imgur.com https://images.typeform.com https://landing.coingecko.com https://upload.wikimedia.org https://res.cloudinary.com https://www.google.com https://img.icons8.com https://www.alchemy.com https://lh7-us.googleusercontent.com https://elitecity.io https://images.mirror-media.xyz https://www.datocms-assets.com https://www.apple.com https://assets.coingecko.com https://www.coingecko.com https://dd.dexscreener.com;
              style-src 'self' 'unsafe-inline' https://use.typekit.net https://fonts.googleapis.com;
              font-src 'self' data: https://fonts.gstatic.com;
            `.replace(/\s+/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;