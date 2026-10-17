import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        income: {
          DEFAULT: "hsl(var(--income))",
          foreground: "hsl(var(--income-foreground))",
        },
        expense: {
          DEFAULT: "hsl(var(--expense))",
          foreground: "hsl(var(--expense-foreground))",
        },
        account: {
          blue: {
            DEFAULT: "hsl(var(--accent-blue))",
            foreground: "hsl(var(--accent-blue-foreground))",
          },
          violet: {
            DEFAULT: "hsl(var(--accent-violet))",
            foreground: "hsl(var(--accent-violet-foreground))",
          },
          emerald: {
            DEFAULT: "hsl(var(--accent-emerald))",
            foreground: "hsl(var(--accent-emerald-foreground))",
          },
          amber: {
            DEFAULT: "hsl(var(--accent-amber))",
            foreground: "hsl(var(--accent-amber-foreground))",
          },
          rose: {
            DEFAULT: "hsl(var(--accent-rose))",
            foreground: "hsl(var(--accent-rose-foreground))",
          },
          slate: {
            DEFAULT: "hsl(var(--accent-slate))",
            foreground: "hsl(var(--accent-slate-foreground))",
          },
        },
        // Stitch surface scale and role tokens (additive). These resolve
        // classes like `bg-surface-container-lowest`, `text-on-surface-variant`,
        // `text-outline` verbatim.
        surface: {
          DEFAULT: "hsl(var(--surface))",
          "container-lowest": "hsl(var(--surface-container-lowest))",
          "container-low": "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          "container-high": "hsl(var(--surface-container-high))",
          "container-highest": "hsl(var(--surface-container-highest))",
          bright: "hsl(var(--surface-bright))",
          dim: "hsl(var(--surface-dim))",
          variant: "hsl(var(--surface-variant))",
          tint: "hsl(var(--surface-tint))",
        },
        "on-surface": {
          DEFAULT: "hsl(var(--on-surface))",
          variant: "hsl(var(--on-surface-variant))",
        },
        outline: {
          DEFAULT: "hsl(var(--outline))",
          variant: "hsl(var(--outline-variant))",
        },
        "on-primary": {
          DEFAULT: "hsl(var(--on-primary))",
          container: "hsl(var(--on-primary-container))",
          fixed: "hsl(var(--on-primary-fixed))",
          "fixed-variant": "hsl(var(--on-primary-fixed-variant))",
        },
        "primary-container": "hsl(var(--primary-container))",
        "primary-fixed": {
          DEFAULT: "hsl(var(--primary-fixed))",
          dim: "hsl(var(--primary-fixed-dim))",
        },
        "inverse-primary": "hsl(var(--inverse-primary))",
        "on-secondary": {
          DEFAULT: "hsl(var(--on-secondary))",
          container: "hsl(var(--on-secondary-container))",
          fixed: "hsl(var(--on-secondary-fixed))",
          "fixed-variant": "hsl(var(--on-secondary-fixed-variant))",
        },
        "secondary-container": "hsl(var(--secondary-container))",
        "secondary-fixed": {
          DEFAULT: "hsl(var(--secondary-fixed))",
          dim: "hsl(var(--secondary-fixed-dim))",
        },
        "tertiary-container": "hsl(var(--tertiary-container))",
        "on-tertiary-container": "hsl(var(--on-tertiary-container))",
        "tertiary-fixed": {
          DEFAULT: "hsl(var(--tertiary-fixed))",
          dim: "hsl(var(--tertiary-fixed-dim))",
        },
        "on-tertiary-fixed": {
          DEFAULT: "hsl(var(--on-tertiary-fixed))",
          variant: "hsl(var(--on-tertiary-fixed-variant))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          container: "hsl(var(--error-container))",
        },
        "on-error": {
          DEFAULT: "hsl(var(--on-error))",
          container: "hsl(var(--on-error-container))",
        },
        "inverse-surface": "hsl(var(--inverse-surface))",
        "inverse-on-surface": "hsl(var(--inverse-on-surface))",
      },
      spacing: {
        "2xs": "0.125rem",
        xs: "0.25rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "3rem",
        margin: "1rem",
        gutter: "1rem",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        "label-xs": [
          "10px",
          { lineHeight: "14px", fontWeight: "600", letterSpacing: "0.04em" },
        ],
        "label-md": [
          "12px",
          { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.01em" },
        ],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-lg": ["15px", { lineHeight: "22px", fontWeight: "400" }],
        "currency-body": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "title-md": [
          "16px",
          { lineHeight: "24px", fontWeight: "500", letterSpacing: "-0.01em" },
        ],
        "headline-sm": [
          "18px",
          { lineHeight: "26px", fontWeight: "600", letterSpacing: "-0.015em" },
        ],
        "headline-lg": [
          "24px",
          { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.02em" },
        ],
        "currency-display": [
          "28px",
          { lineHeight: "36px", fontWeight: "600", letterSpacing: "-0.02em" },
        ],
        "display-lg-mobile": [
          "26px",
          { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.02em" },
        ],
        "display-lg": [
          "32px",
          { lineHeight: "40px", fontWeight: "600", letterSpacing: "-0.025em" },
        ],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
