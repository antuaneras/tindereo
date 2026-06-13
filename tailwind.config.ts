import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tide: {
          coral: "#FF5A5F",
          orange: "#FF8C42",
          sand: "#F5EFE6",
          cream: "#FAF7F3",
          ink: "#1A1410",
          cocoa: "#3D3630",
          stone: "#B8AFA4",
          moss: "#4ADE80",
          gold: "#FFB347"
        }
      },
      boxShadow: {
        glow: "0 22px 60px rgba(255, 90, 95, 0.22)",
        soft: "0 18px 45px rgba(26, 20, 16, 0.12)"
      },
      backgroundImage: {
        "tindereo-gradient": "linear-gradient(135deg, #FF5A5F 0%, #FF8C42 100%)"
      }
    }
  },
  plugins: []
};

export default config;
