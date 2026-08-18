import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
          './app/**/*.{js,ts,jsx,tsx,mdx}',
          './components/**/*.{js,ts,jsx,tsx,mdx}',
        ],
    theme: {
          extend: {
                  colors: {
                            brand: {
                                        50: '#f5f3ff',
                                        100: '#ede9fe',
                                        200: '#ddd6fe',
                                        300: '#c4b5fd',
                                        400: '#a78bfa',
                                        500: '#8b5cf6',
                                        600: '#7c3aed',
                                        700: '#6d28d9',
                                        800: '#5b21b6',
                                        900: '#4c1d95',
                            },
                            gold: {
                                        50: '#fdfaf3',
                                        100: '#faf1dc',
                                        200: '#f3e0ae',
                                        300: '#e9c97c',
                                        400: '#dcae52',
                                        500: '#c8933a',
                                        600: '#a8752c',
                                        700: '#875c26',
                                        800: '#6f4b23',
                                        900: '#5c3f21',
                            },
                  },
                  fontFamily: {
                            display: ['var(--font-display)', 'Georgia', 'serif'],
                            sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
                  },
          },
    },
    plugins: [],
}

export default config
