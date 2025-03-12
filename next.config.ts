import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "i.imgur.com",
      "images.typeform.com",
      "landing.coingecko.com",
      "upload.wikimedia.org",
      "res.cloudinary.com",
      "google.com",
      "img.icons8.com",
      "www.alchemy.com",
      "lh7-us.googleusercontent.com",
      // Newly added:
      "elitecity.io",
      "images.mirror-media.xyz",
      "www.datocms-assets.com",
    ],
  },
};

export default nextConfig;



