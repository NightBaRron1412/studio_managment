/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'Tahoma', 'Arial', 'sans-serif'],
        nums: ['"IBM Plex Sans Arabic"', 'Cairo', 'system-ui', 'sans-serif']
      },
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          subtle: 'rgb(var(--bg-subtle) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)'
        },
        brand: {
          50: '#EEF7F6',
          100: '#D6ECEA',
          200: '#AED9D5',
          300: '#7DC0BA',
          400: '#4FA39C',
          500: '#2F857F',
          600: '#226A66',
          700: '#1B5552',
          800: '#163E3C',
          900: '#0F2A29'
        },
        gold: {
          400: '#E8B85C',
          500: '#D69E2E',
          600: '#B07F1D'
        },
        good: '#16A34A',
        warn: '#D97706',
        bad: '#DC2626'
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)',
        lift: '0 4px 14px rgba(16,24,40,0.08), 0 12px 32px rgba(16,24,40,0.08)'
      }
    }
  },
  plugins: []
}
