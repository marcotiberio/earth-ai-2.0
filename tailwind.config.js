/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './slices/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      aspectRatio: {
        '4/3': '4 / 3',
        '3/4': '3 / 4',
      },
      fontFamily: {
        // Body / UI grotesk
        sans:  ['"Beausite Classic"', 'system-ui', 'sans-serif'],
        // Editorial display face used for all headlines (the italic "New Industrial Era").
        serif: ['"TWK Ghost"', 'Georgia', 'Times New Roman', 'serif'],
        serifItalic: ['"TWK Ghost"', 'Georgia', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        none: '0',
        DEFAULT: '7px'
      },
      colors: {
        // Earth AI palette
        'darkblue':  '#0D111B', // page background
        'beige': '#FAF3E4',
        'grey':  '#8A93A6', // muted captions on navy
        // Back-compat aliases (older slices referenced these).
        'black': '#050F23',
        'white': '#FAF3E4',
      },
      spacing: {
        // Spacing values using CSS variables from spacings.php
        xs: '0.5rem', // 8px, for tight UI elements
        sm: '2rem', // 32px, for moderate gaps
        md: '5rem', // 80px, for generous spacing
        lg: '8rem', // 128px, for large gaps
        xl: '12rem', // 192px, for extra large gaps
      } 
    },
  },
  plugins: [],
}
