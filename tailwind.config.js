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
    screens: {
      // Breakpoints from _variables.scss
      mobile: '640px',   // $breakpoint-mobile
      tablet: '780px',   // $breakpoint-tablet
      desktop: '1180px', // $breakpoint-desktop
      desktopWide: '1180px', // $breakpoint-desktop
      // Additional breakpoints
      sm: '640px',
      md: '780px',
      lg: '1180px',
      xl: '1680px',
    },
    extend: {
      aspectRatio: {
        '16/11': '16 / 11',
        '4/3': '4 / 3',
        '3/4': '3 / 4',
      },
      fontFamily: {
        sans:  ['"Beausite Classic"', 'system-ui', 'sans-serif'],
        sansLight:  ['"Beausite Classic Light"', 'system-ui', 'sans-serif'],
        serif: ['"TWK Ghost"', 'Georgia', 'Times New Roman', 'serif'],
        serifItalic: ['"TWK Ghost Italic"', 'Georgia', 'Times New Roman', 'serif'],
        // Section labels / eyebrows. The design specifies ABC Diatype Mono; no
        // webfont for it is served yet (nothing in /public/fonts), so it falls
        // back to the system monospace until one is added.
        mono:  ['"ABC Diatype Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
        'orange':  '#E97B39', // orange for supply bars and highlights
        // Back-compat aliases (older slices referenced these).
        'black': '#050F23',
        'white': '#FAF3E4',
      },
      spacing: {
        // Spacing values using CSS variables from spacings.php
        xs: '1rem', // 8px, for tight UI elements
        sm: '2.5rem', // 32px, for moderate gaps
        md: '6rem', // 80px, for generous spacing
        lg: '8rem', // 128px, for large gaps
        xl: '12rem', // 192px, for extra large gaps
      } 
    },
  },
  plugins: [],
}
