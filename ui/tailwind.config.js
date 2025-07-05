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
          DEFAULT: '#00FF00', // Classic terminal green
          dark: '#00CC00',
          light: '#33FF33',
        },
        secondary: {
          DEFAULT: '#FFFF00', // Classic terminal yellow
          dark: '#CCCC00',
          light: '#FFFF33',
        },
        background: '#000000', // Pure black background
        surface: '#1A1A1A', // Dark surface for terminals
        accent: '#FF0000', // Classic terminal red
        success: '#00FF00', // Terminal green
        warning: '#FFFF00', // Terminal yellow
        error: '#FF0000', // Terminal red
        text: {
          primary: '#00FF00', // Classic terminal green
          secondary: '#FFFF00', // Terminal yellow
          muted: '#808080', // Terminal gray
        },
        border: {
          DEFAULT: '#808080', // Gray border
          light: '#C0C0C0', // Light gray for hover
        },
        terminal: {
          amber: '#FFB000',
          cyan: '#00FFFF',
          magenta: '#FF00FF',
          white: '#FFFFFF',
          blue: '#0000FF',
        },
      },
      borderRadius: {
        DEFAULT: '0px', // No rounded corners for terminal look
        terminal: '2px', // Slight radius for retro feel
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      },
      fontFamily: {
        sans: ['Courier New', 'Monaco', 'Menlo', 'Consolas', 'monospace'],
        mono: ['Courier New', 'Monaco', 'Menlo', 'Consolas', 'monospace'],
        terminal: ['Courier New', 'Monaco', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
