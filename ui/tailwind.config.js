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
          DEFAULT: '#3D85C6', // Aldrin blue
          dark: '#2D6DA8',
          light: '#5A9AD6',
        },
        secondary: {
          DEFAULT: '#00C2FF', // OpenSVM accent blue
          dark: '#00A3D9',
          light: '#33CFFF',
        },
        background: '#121212', // Dark background matching both platforms
        surface: '#1E1E1E', // Card/component background
        accent: '#FF5722', // Accent color for important actions
        success: '#4CAF50', // Success indicators
        warning: '#FFC107', // Warning indicators
        error: '#F44336', // Error indicators
        text: {
          primary: '#FFFFFF', // Primary text
          secondary: '#B0BEC5', // Secondary/muted text
          muted: '#6B7280', // Very muted text
        },
        border: {
          DEFAULT: '#2D3748', // Default border color
          light: '#4A5568', // Lighter border for hover states
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
