export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:    '#1B3A5C',
          'navy-light': '#243E6A',
          'navy-dark':  '#132B45',
          blue:    '#2196F3',
          'blue-dark': '#1565C0',
          orange:  '#F97316',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
