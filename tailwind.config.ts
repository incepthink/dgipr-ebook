import type { Config } from 'tailwindcss'

/** Utilities resolve to the CSS tokens in `src/styles/tokens.css`, never to copies of them. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['var(--font-mukta)', 'Nirmala UI', 'system-ui', 'sans-serif'],
        serif: ['var(--font-noto-serif)', 'Nirmala UI', 'serif'],
        display: ['var(--font-tiro)', 'var(--font-noto-serif)', 'serif'],
      },
      colors: {
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        paper: 'var(--paper)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        sunk: 'var(--sunk)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
        ok: 'var(--ok)',
        'ok-soft': 'var(--ok-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
      maxWidth: { shell: '78rem' },
    },
  },
  plugins: [],
} satisfies Config
