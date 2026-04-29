/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f0f2f5",
        panel: "#ffffff",
        ink: "#0f172a",
        muted: "#64748b",
        line: "#e2e8f0",
        teal: "#1e40af",
        amber: "#d97706",
        gold: "#b45309"
      },
      boxShadow: {
        float: "0 28px 70px rgba(15, 23, 42, 0.12)"
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"]
      }
    }
  },
  plugins: []
};
