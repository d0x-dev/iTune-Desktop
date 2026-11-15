/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#fa2d48',
          hover: '#fa586a',
          dark: '#c71530',
        },
        surface: {
          DEFAULT: '#0a0b0e',
          subtle: '#12141a',
          sidebar: '#07080a',
          border: 'rgba(255, 255, 255, 0.08)',
        }
      }
    },
  },
  plugins: [],
}
