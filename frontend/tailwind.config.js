/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fintech: {
          dark: '#0A0F1D',
          card: '#121A2D',
          border: '#1E293B',
          accent: '#3B82F6',
          green: '#10B981',
          red: '#EF4444'
        }
      }
    },
  },
  plugins: [],
}
