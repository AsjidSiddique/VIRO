/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        viro: {
          blue: '#00BFFF',
          purple: '#8B5CF6',
          orange: '#F97316',
          dark: '#0A0E1A',
          card: '#0F1629',
          border: '#1E2A45',
        }
      },
      fontFamily: {
        display: ['Clash Display', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-down': 'slideDown 0.3s ease',
        'fade-in': 'fadeIn 0.4s ease',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        slideDown: { from: { opacity: 0, transform: 'translateY(-10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 10px #8B5CF640' }, '50%': { boxShadow: '0 0 25px #8B5CF680' } },
      }
    },
  },
  plugins: [],
}
