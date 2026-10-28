/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        border: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'on-accent': 'var(--on-accent)',
        positive: 'var(--positive)',
        'positive-soft': 'var(--positive-soft)',
        negative: 'var(--negative)',
        'negative-soft': 'var(--negative-soft)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '18px',
        field: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 12px 40px rgba(0,0,0,0.14)',
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
  plugins: [],
}
