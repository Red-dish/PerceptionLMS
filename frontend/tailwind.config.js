export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          forest: '#17483f',
          'forest-light': '#276453',
          mint: '#d5e9db',
          paper: '#f5f5ef',
          ink: '#182c31',
          muted: '#60736e',
          line: '#dce5dc',
          rust: '#ad5935',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
