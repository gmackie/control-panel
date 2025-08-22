/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        primary: {
          DEFAULT: '#667eea',
          dark: '#5a67d8',
          light: '#7c3aed',
        },
        secondary: {
          DEFAULT: '#764ba2',
          dark: '#6b46c1',
          light: '#9333ea',
        },
        success: '#4ade80',
        warning: '#facc15',
        error: '#ef4444',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
}