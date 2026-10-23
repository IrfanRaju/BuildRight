/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#101828',
          orange: '#FF7518',
          cream: '#f8fafc',
          slate: '#e2e8f0',
        },
      },
      boxShadow: {
        soft: '0 20px 50px -20px rgba(15, 23, 42, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
