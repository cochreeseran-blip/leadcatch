/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // KnockTrakr theme tokens — map Tailwind classes to CSS vars
        'kt-ink':       'var(--kt-ink)',
        'kt-navy':      'var(--kt-navy)',
        'kt-navy-2':    'var(--kt-navy-2)',
        'kt-navy-line': 'var(--kt-navy-line)',
        'kt-red':       'var(--kt-red)',
        'kt-red-deep':  'var(--kt-red-deep)',
        'kt-paper':     'var(--kt-paper)',
        'kt-mist':      'var(--kt-mist)',
        'kt-line':      'var(--kt-line)',
        'kt-text':      'var(--kt-text)',
        'kt-muted':     'var(--kt-muted)',
        'kt-muted-dark':'var(--kt-muted-dark)',
        accent: 'var(--accent-color)',
      },
      fontFamily: {
        display: ['var(--kt-font-display)'],
        body:    ['var(--kt-font-body)'],
      },
    },
  },
  plugins: [],
};
