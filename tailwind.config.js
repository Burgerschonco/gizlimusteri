/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'archivo': ['Archivo Black', ...defaultTheme.fontFamily.sans],
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}