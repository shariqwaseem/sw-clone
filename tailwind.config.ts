import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          DEFAULT: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          dark: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        },
        success: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#059669'
        },
        danger: {
          light: '#fee2e2',
          DEFAULT: '#f43f5e',
          dark: '#e11d48'
        }
      }
    }
  },
  plugins: []
};

export default config;
