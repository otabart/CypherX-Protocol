/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primaryBlue: '#0052FF', // Blue for accents
        white: '#FFFFFF',      // White background
        black: '#000000',      // Black text
      },
    },
  },
  plugins: [],
};


