/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e3f2fd',
          100: '#bbdefb',
          500: '#0a66c2',
          600: '#0857a6',
          700: '#004182',
        },
      },
    },
  },
  plugins: [],
};
