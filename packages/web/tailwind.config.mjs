/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  // Theme is driven by a `.dark` class on <html> (set by the ThemeToggle / pre-paint script),
  // so the learner can pick Light, Dark, or Auto (follow the OS) explicitly.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic surface/text tokens — values swap between light & dark in globals.css
        page: token('page'),
        card: token('card'),
        sunken: token('sunken'),
        line: token('line'),
        ink: {
          DEFAULT: token('ink'),
          soft: token('ink-soft'),
          faint: token('ink-faint'),
        },
      },
      fontFamily: {
        sans: [
          // Devanagari-only alias for the font chosen in the header (see lib/devanagariFonts.ts)
          '"Akshara Display Devanagari"',
          'ui-rounded',
          '"SF Pro Rounded"',
          '"Nunito"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans Devanagari"',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-6deg)' },
          '75%': { transform: 'rotate(6deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        pop: 'pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        wiggle: 'wiggle 400ms ease-in-out',
      },
    },
  },
  plugins: [],
};
