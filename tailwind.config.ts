import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: {
          DEFAULT: '#00FFFF',
          light: '#00E5E5',
          dark: '#00B8D4',
        },
      },
    },
  },
  plugins: [],
};

export default config;
