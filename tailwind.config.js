/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Protect QuantumChat's design-system CSS from Tailwind Preflight resets
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          emerald: '#064e3b',
          champagne: '#f8e7c9',
          bg: '#0a2a1e',
          surface: '#0d3527',
          text: '#f8e7c9',
          textMuted: '#c2b696',
        },
      },
    },
  },
  plugins: [],
};
