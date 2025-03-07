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
        primary: {
          DEFAULT: '#512da8',
          dark: '#311b92',
          light: '#7e57c2',
        },
        secondary: {
          DEFAULT: '#ff9800',
          dark: '#f57c00',
          light: '#ffb74d',
        },
        background: '#121212',
        surface: '#1e1e1e',
        text: {
          primary: '#ffffff',
          secondary: '#b0bec5',
        },
      },
    },
  },
  plugins: [],
}