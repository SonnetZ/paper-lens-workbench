import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        swiss: {
          red: "#E4002B",
          surface: "#FFFFFF",
          wash: "#F7F7F8",
          ink: "#18181B",
          muted: "#71717A",
          rule: "#E4E4E7"
        }
      },
      fontFamily: {
        sans: ["Geist", "Söhne", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["Geist Mono", "SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
