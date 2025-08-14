/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          bg: '#fcfbf8',
          text: '#1b1a0e',
          secondary: '#97914e',
          button: '#f0e675',
          'button-secondary': '#f3f2e7',
          border: '#e7e5d0',
        },
        security: {
          low: '#10b981',
          medium: '#f59e0b', 
          high: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(27, 26, 14, 0.08)',
        'card': '0 4px 12px rgba(27, 26, 14, 0.1)',
      },
      borderRadius: {
        'card': '12px',
      }
    },
  },
  plugins: [],
}