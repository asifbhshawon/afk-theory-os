import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        afk: {
          black: "#0E1011",
          charcoal: "#141719",
          card: "#171B1D",
          surface: "#1A1E20",
          elevated: "#202527",
          surfaceLight: "#262C2F",
          "surface-light": "#262C2F",
          input: "#121517",
          border: "#323936",
          borderLight: "#424B47",
          "border-light": "#424B47",
          borderStrong: "#515C56",
          "border-strong": "#515C56",
          offwhite: "#F4F5F1",
          secondary: "#B5BDB6",
          muted: "#8E9890",
          subtle: "#6E7770",
          cream: "#EAE9E1",
          olive: {
            dark: "#1C241B",
            muted: "#2C3A2A",
            DEFAULT: "#5A7352",
            light: "#7D9472",
            accent: "#93AA88",
          },
          gold: "#C49A45",
          danger: "#E05252",
          success: "#3EB465",
          warning: "#E59E27",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "var(--font-noto-bengali)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        bengali: [
          "var(--font-noto-bengali)",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.45rem" }],
        md: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.6rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.625rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
