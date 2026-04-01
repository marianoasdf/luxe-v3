import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1a1a1a',
          accent: '#2563eb',
        },
      },
    },
  },
  plugins: [],
};

export default config;
