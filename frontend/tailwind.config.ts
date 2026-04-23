import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
    },
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-1": "var(--bg-1)",
        "bg-2": "var(--bg-2)",
        "bg-3": "var(--bg-3)",
        fg: "var(--fg)",
        "fg-dim": "var(--fg-dim)",
        "fg-muted": "var(--fg-muted)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        "accent-glow": "var(--accent-glow)",
        success: "var(--success)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        border: "var(--line)",
        input: "var(--line-strong)",
        ring: "var(--accent)",
        background: "var(--bg)",
        foreground: "var(--fg)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "#000000",
        },
        secondary: {
          DEFAULT: "var(--bg-2)",
          foreground: "var(--fg)",
        },
        muted: {
          DEFAULT: "var(--bg-1)",
          foreground: "var(--fg-dim)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "var(--bg-1)",
          foreground: "var(--fg)",
        },
        popover: {
          DEFAULT: "var(--bg-1)",
          foreground: "var(--fg)",
        },
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"JetBrains Mono"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: {
        display: "-0.055em",
        tight2: "-0.04em",
        eyebrow: "0.14em",
        mono: "0.12em",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
      },
      keyframes: {
        glow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        glow: "glow 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
