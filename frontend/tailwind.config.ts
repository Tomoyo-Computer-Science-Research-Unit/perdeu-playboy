import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        surface: "#111111",
        foreground: "#f2f2f2",
        muted: "#9a9a9a",
        border: "#303030",
        accent: {
          red: "#e01f1f"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
        display: ["var(--font-bebas-neue)", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0px 0px rgba(0,0,0,1)"
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem",
        DEFAULT: "0", /* overriding default rounded borders to be flat */
      }
    }
  },
  plugins: []
};

export default config;
