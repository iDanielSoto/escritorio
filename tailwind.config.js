/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Usando las variables CSS personalizadas
        'bg-primary': 'rgb(var(--bg-primary) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--bg-secondary) / <alpha-value>)',
        'bg-tertiary': 'rgb(var(--bg-tertiary) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
        'text-disabled': 'rgb(var(--text-disabled) / <alpha-value>)',
        'accent': 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'accent-active': 'rgb(var(--accent-active) / <alpha-value>)',
        'accent-light': 'rgb(var(--accent-light) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle) / <alpha-value>)',
        'border-medium': 'rgb(var(--border-medium) / <alpha-value>)',
        'border-divider': 'rgb(var(--border-divider) / <alpha-value>)',
        'success': 'rgb(var(--success) / <alpha-value>)',
        'warning': 'rgb(var(--warning) / <alpha-value>)',
        'error': 'rgb(var(--error) / <alpha-value>)',
        'info': 'rgb(var(--info) / <alpha-value>)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
