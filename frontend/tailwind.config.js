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
        canvas: {
          DEFAULT: '#0B0F17',
          subtle: '#0E131E',
        },
        panel: {
          DEFAULT: '#121824',
          elevated: '#172030',
          hover: '#1C263A',
        },
        line: {
          subtle: '#1C2536',
          DEFAULT: '#222E42',
          bold: '#2D3D58',
        },
        brand: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        profit: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
          muted: '#10B9811A',
        },
        loss: {
          DEFAULT: '#F43F5E',
          light: '#FB7185',
          dark: '#E11D48',
          muted: '#F43F5E1A',
        },
        cash: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
          muted: '#F59E0B1A',
        },
        corporate: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          dark: '#7C3AED',
          muted: '#8B5CF61A',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'elevated': '0 8px 30px -4px rgba(0, 0, 0, 0.6)',
        'glass': '0 12px 40px 0 rgba(0, 0, 0, 0.45)',
        'glow-blue': '0 0 35px -5px rgba(59, 130, 246, 0.25)',
        'glow-emerald': '0 0 35px -5px rgba(16, 185, 129, 0.25)',
        'inner-bevel': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
}
