/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // Newly added domains:
      "elitecity.io",
      "images.mirror-media.xyz",
      "www.datocms-assets.com",
      // Google and Apple domains for favicons:
      "www.google.com",
      "www.apple.com",
    ],
  },
  experimental: {
    appDir: true, // Enable App Router (if using Next.js 13+)
  },
};

export default nextConfig;


