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
      mobile: '640px',
      tablet: '780px',
      desktop: '1180px',
      desktopWide: '1180px',
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
        mono:  ['"ABC Diatype Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        none: '0',
        DEFAULT: '7px'
      },
      colors: {
        'darkblue':  '#0D111B',
        'beige': '#FAF3E4',
        'grey':  '#8A93A6',
        'orange':  '#E97B39',
        'black': '#050F23',
        'white': '#FAF3E4',
      },
      spacing: {
        xs: '1rem',
        sm: '2.5rem',
        md: '6rem',
        lg: '8rem',
        xl: '12rem',
      } 
    },
  },
  plugins: [],
}
