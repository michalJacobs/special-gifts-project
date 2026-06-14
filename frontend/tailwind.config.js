/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        moss: "#41624f",
        mint: "#dff3e8",
        coral: "#e46b5f",
        gold: "#d39a2f"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 31, 0.08)"
      }
    }
  },
  plugins: []
};
