import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        afk: {
          black: "#0A0B0C",
          charcoal: "#141618",
          surface: "#1A1D21",
          surfaceLight: "#24282E",
          "surface-light": "#24282E",
          card: "#16191D",
          input: "#121417",
          border: "#2E343D",
          borderLight: "#3E4652",
          "border-light": "#3E4652",
          muted: "#9CA3AF",
          subtle: "#6B7280",
          offwhite: "#F5F5F0",
          cream: "#EAE9E1",
          olive: {
            dark: "#1A2219",
            muted: "#2B3828",
            DEFAULT: "#4F6348",
            light: "#708966",
            accent: "#8CA982",
          },
          gold: "#C49A45",
          danger: "#E05252",
          success: "#3EB465",
          warning: "#E59E27",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
