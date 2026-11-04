/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1B2A5C',
          'navy-light': '#243775',
          'navy-dark': '#131E42',
          red: '#D7262E',
          'red-light': '#FCE8E9',
          cream: '#FAF8F4',
          'cream-dark': '#F0EDE6',
          surface: '#FFFFFF',
          border: '#E2DED6',
          muted: '#6B7280',
          dark: '#1F2937',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
