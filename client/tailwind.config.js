/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#070b14',
          800: '#0d1424',
          700: '#111827',
          600: '#1a2234',
          500: '#1f2d40',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: '#ef4444',
          bg: '#1f0a0a',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          bg: '#1f1408',
        },
        safe: {
          DEFAULT: '#059669',
          light: '#10b981',
          bg: '#061a12',
        },
        accent: '#3b82f6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
